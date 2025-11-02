package webrtc

import (
	"log"
	"sync"

	"github.com/gofiber/websocket/v2"
	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v3"
)

// PeerConnectionState represents a WebRTC peer connection
type PeerConnectionState struct {
	PeerConnection *webrtc.PeerConnection
	Websocket      *ThreadSafeWriter
	PeerID         string
	Username       string // Added to store peer username
}

// ThreadSafeWriter wraps websocket connection with mutex for thread safety
type ThreadSafeWriter struct {
	*websocket.Conn
	sync.Mutex
}

// WriteJSON writes JSON to websocket in a thread-safe manner
func (t *ThreadSafeWriter) WriteJSON(v interface{}) error {
	t.Lock()
	defer t.Unlock()
	return t.Conn.WriteJSON(v)
}

// Peers manages all peer connections in a room
type Peers struct {
	ListLock    sync.RWMutex
	Connections []PeerConnectionState
	TrackLocals map[string]*webrtc.TrackLocalStaticRTP
	// Track which tracks belong to which peer (peerID -> trackID -> track)
	PeerTracks  map[string]map[string]*webrtc.TrackLocalStaticRTP
}

// AddTrack adds a new track to the peer connections
func (p *Peers) AddTrack(t *webrtc.TrackRemote, peerID string) *webrtc.TrackLocalStaticRTP {
	p.ListLock.Lock()
	defer func() {
		p.ListLock.Unlock()
		p.SignalPeerConnections()
	}()

	// Initialize peer tracks map if needed
	if p.PeerTracks == nil {
		p.PeerTracks = make(map[string]map[string]*webrtc.TrackLocalStaticRTP)
	}
	if p.PeerTracks[peerID] == nil {
		p.PeerTracks[peerID] = make(map[string]*webrtc.TrackLocalStaticRTP)
	}

	// Check if this peer already has a track of the same kind
	var oldTrack *webrtc.TrackLocalStaticRTP
	for trackID, track := range p.PeerTracks[peerID] {
		if track.Kind() == t.Kind() {
			oldTrack = track
			delete(p.TrackLocals, trackID)
			delete(p.PeerTracks[peerID], trackID)
			log.Printf("Replacing old %s track %s with new track %s for peer %s", t.Kind(), trackID, t.ID(), peerID)
			break
		}
	}

	// Create a new track
	trackLocal, err := webrtc.NewTrackLocalStaticRTP(
		t.Codec().RTPCodecCapability,
		t.ID(),
		t.StreamID(),
	)
	if err != nil {
		log.Println("Error creating track:", err)
		return nil
	}

	p.TrackLocals[t.ID()] = trackLocal
	p.PeerTracks[peerID][t.ID()] = trackLocal

	// If we had an old track, we need to replace it in all peer connections
	if oldTrack != nil {
		// Replace the old track with the new one in all peer connections
		for i := range p.Connections {
			if p.Connections[i].PeerConnection.ConnectionState() == webrtc.PeerConnectionStateConnected {
				// Find the sender for the old track and replace it
				senders := p.Connections[i].PeerConnection.GetSenders()
				for _, sender := range senders {
					if sender.Track() == oldTrack {
						if replaceErr := sender.ReplaceTrack(trackLocal); replaceErr != nil {
							log.Printf("Error replacing track for peer %s: %v", p.Connections[i].PeerID, replaceErr)
						} else {
							log.Printf("Replaced track for peer %s", p.Connections[i].PeerID)
						}
						break
					}
				}
			}
		}
	} else {
		// Add this track to all existing peer connections that are connected
		for i := range p.Connections {
			// Only add track to connected peer connections
			if p.Connections[i].PeerConnection.ConnectionState() == webrtc.PeerConnectionStateConnected {
				if rtpSender, addTrackErr := p.Connections[i].PeerConnection.AddTrack(trackLocal); addTrackErr != nil {
					log.Printf("Error adding track to peer %s: %v", p.Connections[i].PeerID, addTrackErr)
				} else {
					log.Printf("Added track %s to connected peer %s", trackLocal.ID(), p.Connections[i].PeerID)
					// Read RTCP packets to keep connection alive
					go func(sender *webrtc.RTPSender, peerID string) {
						rtcpBuf := make([]byte, 1500)
						for {
							if _, _, rtcpErr := sender.Read(rtcpBuf); rtcpErr != nil {
								return
							}
						}
					}(rtpSender, p.Connections[i].PeerID)
				}
			} else {
				log.Printf("Skipping track addition to peer %s (not connected, state: %s)", p.Connections[i].PeerID, p.Connections[i].PeerConnection.ConnectionState())
			}
		}
	}

	return trackLocal
}

// RemoveTrack removes a track from peer connections
func (p *Peers) RemoveTrack(t *webrtc.TrackLocalStaticRTP) {
	p.ListLock.Lock()
	defer func() {
		p.ListLock.Unlock()
		p.SignalPeerConnections()
	}()

	delete(p.TrackLocals, t.ID())
}

// SignalPeerConnections triggers renegotiation for all peer connections
func (p *Peers) SignalPeerConnections() {
	p.ListLock.Lock()
	defer func() {
		p.ListLock.Unlock()
		p.DispatchKeyFrame()
	}()

	// Trigger renegotiation for each peer
	for syncAttempt := 0; ; syncAttempt++ {
		if syncAttempt == 25 {
			// Give up after 25 attempts
			return
		}

		if !p.dispatchKeyFrameFunc() {
			break
		}
	}
}

// DispatchKeyFrame sends keyframe request to all peers
func (p *Peers) DispatchKeyFrame() {
	p.ListLock.Lock()
	defer p.ListLock.Unlock()

	p.dispatchKeyFrameFunc()
}

func (p *Peers) dispatchKeyFrameFunc() bool {
	var activeSenders []*webrtc.RTPSender

	for i := range p.Connections {
		if p.Connections[i].PeerConnection.ConnectionState() == webrtc.PeerConnectionStateClosed {
			p.Connections = append(p.Connections[:i], p.Connections[i+1:]...)
			log.Println("Removed closed peer connection")
			return true
		}

		// Collect all senders
		for _, sender := range p.Connections[i].PeerConnection.GetSenders() {
			if sender.Track() != nil {
				activeSenders = append(activeSenders, sender)
			}
		}
	}

	// Send PLI (Picture Loss Indication) to request keyframe
	for i := range p.Connections {
		for _, sender := range p.Connections[i].PeerConnection.GetSenders() {
			if sender.Track() != nil {
				_ = p.Connections[i].PeerConnection.WriteRTCP([]rtcp.Packet{
					&rtcp.PictureLossIndication{
						MediaSSRC: 0, // Request keyframe for all streams
					},
				})
			}
		}
	}

	return false
}

// AddPeerConnection adds a new peer connection to the room
func (p *Peers) AddPeerConnection(peerConnection *webrtc.PeerConnection, ws *websocket.Conn) {
	p.AddPeerConnectionWithID(peerConnection, ws, "", "Guest")
}

// AddPeerConnectionWithID adds a new peer connection with a specific ID
func (p *Peers) AddPeerConnectionWithID(peerConnection *webrtc.PeerConnection, ws *websocket.Conn, peerID string, username string) {
	p.ListLock.Lock()
	defer p.ListLock.Unlock()

	p.Connections = append(p.Connections, PeerConnectionState{
		PeerConnection: peerConnection,
		Websocket: &ThreadSafeWriter{
			Conn: ws,
		},
		PeerID:   peerID,
		Username: username,
	})
}

// RemovePeerConnection removes a peer connection from the room
func (p *Peers) RemovePeerConnection(peerConnection *webrtc.PeerConnection) {
	p.ListLock.Lock()
	defer p.ListLock.Unlock()

	for i, conn := range p.Connections {
		if conn.PeerConnection == peerConnection {
			p.Connections = append(p.Connections[:i], p.Connections[i+1:]...)
			log.Println("Removed peer connection")
			return
		}
	}
}

// BroadcastMessage sends a message to all peers in the room
func (p *Peers) BroadcastMessage(message interface{}) {
	p.ListLock.RLock()
	defer p.ListLock.RUnlock()

	for _, conn := range p.Connections {
		if err := conn.Websocket.WriteJSON(message); err != nil {
			log.Println("Error broadcasting message:", err)
		}
	}
}

// BroadcastToOthers sends a message to all peers except the specified one
func (p *Peers) BroadcastToOthers(message interface{}, excludePeerID string) {
	p.ListLock.RLock()
	defer p.ListLock.RUnlock()

	for _, conn := range p.Connections {
		if conn.PeerID != excludePeerID {
			if err := conn.Websocket.WriteJSON(message); err != nil {
				log.Println("Error broadcasting message:", err)
			}
		}
	}
}

// SendToPeer sends a message to a specific peer
func (p *Peers) SendToPeer(message interface{}, peerID string) {
	p.ListLock.RLock()
	defer p.ListLock.RUnlock()

	for _, conn := range p.Connections {
		if conn.PeerID == peerID {
			if err := conn.Websocket.WriteJSON(message); err != nil {
				log.Println("Error sending message to peer:", err)
			}
			return
		}
	}
	log.Printf("Peer %s not found", peerID)
}

// WebSocketMessage represents messages exchanged via WebSocket
type WebSocketMessage struct {
	Event string                    `json:"event"`
	Data  map[string]interface{}    `json:"data"`
}

// GetConnectionCount returns the number of active connections
func (p *Peers) GetConnectionCount() int {
	p.ListLock.RLock()
	defer p.ListLock.RUnlock()
	return len(p.Connections)
}

// BroadcastToAll sends a message to all peers including the sender
func (p *Peers) BroadcastToAll(message map[string]interface{}) {
	p.ListLock.RLock()
	defer p.ListLock.RUnlock()
	
	for _, conn := range p.Connections {
		if err := conn.Websocket.WriteJSON(message); err != nil {
			log.Println("Error broadcasting to peer:", err)
		}
	}
}

// RemovePeer removes a peer by their peer ID
func (p *Peers) RemovePeer(peerID string) {
	p.ListLock.Lock()
	defer p.ListLock.Unlock()
	
	for i, conn := range p.Connections {
		if conn.PeerID == peerID {
			// Close the peer connection
			if conn.PeerConnection != nil {
				conn.PeerConnection.Close()
			}
			// Close websocket
			if conn.Websocket != nil {
				conn.Websocket.Close()
			}
			// Remove from list
			p.Connections = append(p.Connections[:i], p.Connections[i+1:]...)
			log.Printf("Removed peer: %s", peerID)
			return
		}
	}
}