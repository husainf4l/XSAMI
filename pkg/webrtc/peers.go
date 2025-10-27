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
}

// AddTrack adds a new track to the peer connections
func (p *Peers) AddTrack(t *webrtc.TrackRemote) *webrtc.TrackLocalStaticRTP {
	p.ListLock.Lock()
	defer func() {
		p.ListLock.Unlock()
		p.SignalPeerConnections()
	}()

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
	p.AddPeerConnectionWithID(peerConnection, ws, "")
}

// AddPeerConnectionWithID adds a new peer connection with a specific ID
func (p *Peers) AddPeerConnectionWithID(peerConnection *webrtc.PeerConnection, ws *websocket.Conn, peerID string) {
	p.ListLock.Lock()
	defer p.ListLock.Unlock()

	p.Connections = append(p.Connections, PeerConnectionState{
		PeerConnection: peerConnection,
		Websocket: &ThreadSafeWriter{
			Conn: ws,
		},
		PeerID: peerID,
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