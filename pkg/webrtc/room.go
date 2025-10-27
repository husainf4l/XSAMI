package webrtc

import (
	"log"
	"sync"
	"time"
	"videochat/pkg/chat"

	"github.com/pion/webrtc/v3"
)

// Room represents a video conference room with comprehensive host controls
type Room struct {
	Peers            *Peers
	Hub              *chat.Hub
	
	// Host & Admin Controls
	HostPeerID       string            // First person to join is the host
	CoHosts          map[string]bool   // Co-hosts who can manage meeting
	
	// Permissions & Security
	ScreenSharePerms map[string]bool   // Permissions for screen sharing
	IsLocked         bool              // Room locked - no new participants
	IsChatDisabled   bool              // Chat disabled by host
	MutedParticipants map[string]bool  // Participants muted by host
	
	// Waiting Room
	WaitingRoom      map[string]*WaitingParticipant // Participants waiting to join
	
	// Recording
	IsRecording      bool              // Recording status
	RecordingStartTime time.Time       // When recording started
	
	PermLock         sync.RWMutex      // Lock for permissions and settings
}

// WaitingParticipant represents someone in the waiting room
type WaitingParticipant struct {
	PeerID      string
	Name        string
	JoinTime    time.Time
	Conn        interface{} // WebSocket connection
}

var (
	// Rooms stores all active video conference rooms
	Rooms     = make(map[string]*Room)
	RoomsLock sync.RWMutex

	// Streams stores all active live streams
	Streams     = make(map[string]*Room)
	StreamsLock sync.RWMutex
)

// RoomConfig configuration for WebRTC
var RoomConfig = webrtc.Configuration{
	ICEServers: []webrtc.ICEServer{
		{
			URLs: []string{"stun:stun.l.google.com:19302"},
		},
	},
}

// CreateRoom creates or gets an existing room
func CreateRoom(uuid string) *Room {
	RoomsLock.Lock()
	defer RoomsLock.Unlock()

	if room, exists := Rooms[uuid]; exists {
		return room
	}

	// Create new room
	hub := chat.NewHub()
	go hub.Run()

	room := &Room{
		Peers: &Peers{
			TrackLocals: make(map[string]*webrtc.TrackLocalStaticRTP),
			Connections: []PeerConnectionState{},
		},
		Hub:               hub,
		HostPeerID:        "",                      // Will be set when first person joins
		CoHosts:           make(map[string]bool),
		ScreenSharePerms:  make(map[string]bool),   // Track who can share screen
		MutedParticipants: make(map[string]bool),
		WaitingRoom:       make(map[string]*WaitingParticipant),
		IsLocked:          false,
		IsChatDisabled:    false,
		IsRecording:       false,
	}

	Rooms[uuid] = room
	log.Printf("Room created: %s", uuid)

	return room
}

// GetRoom retrieves a room by UUID
func GetRoom(uuid string) (*Room, bool) {
	RoomsLock.RLock()
	defer RoomsLock.RUnlock()

	room, exists := Rooms[uuid]
	return room, exists
}

// DeleteRoom removes a room when empty
func DeleteRoom(uuid string) {
	RoomsLock.Lock()
	defer RoomsLock.Unlock()

	if room, exists := Rooms[uuid]; exists {
		if room.Peers.GetConnectionCount() == 0 {
			delete(Rooms, uuid)
			log.Printf("Room deleted: %s", uuid)
		}
	}
}

// CreateStream creates or gets an existing stream
func CreateStream(uuid string) *Room {
	StreamsLock.Lock()
	defer StreamsLock.Unlock()

	if stream, exists := Streams[uuid]; exists {
		return stream
	}

	// Create new stream
	hub := chat.NewHub()
	go hub.Run()

	stream := &Room{
		Peers: &Peers{
			TrackLocals: make(map[string]*webrtc.TrackLocalStaticRTP),
			Connections: []PeerConnectionState{},
		},
		Hub: hub,
	}

	Streams[uuid] = stream
	log.Printf("Stream created: %s", uuid)

	return stream
}

// GetStream retrieves a stream by UUID
func GetStream(uuid string) (*Room, bool) {
	StreamsLock.RLock()
	defer StreamsLock.RUnlock()

	stream, exists := Streams[uuid]
	return stream, exists
}

// StartKeyFrameDispatcher starts periodic keyframe requests for smooth video
func StartKeyFrameDispatcher() {
	go func() {
		for range time.NewTicker(3 * time.Second).C {
			DispatchKeyFrames()
		}
	}()
}

// DispatchKeyFrames sends keyframe requests to all rooms and streams
func DispatchKeyFrames() {
	// Dispatch for rooms
	RoomsLock.RLock()
	for _, room := range Rooms {
		room.Peers.DispatchKeyFrame()
	}
	RoomsLock.RUnlock()

	// Dispatch for streams
	StreamsLock.RLock()
	for _, stream := range Streams {
		stream.Peers.DispatchKeyFrame()
	}
	StreamsLock.RUnlock()
}

// GetRoomCount returns the number of active rooms
func GetRoomCount() int {
	RoomsLock.RLock()
	defer RoomsLock.RUnlock()
	return len(Rooms)
}

// GetStreamCount returns the number of active streams
func GetStreamCount() int {
	StreamsLock.RLock()
	defer StreamsLock.RUnlock()
	return len(Streams)
}

// SetHost sets the host/admin of the room (first person to join)
func (r *Room) SetHost(peerID string) {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	
	if r.HostPeerID == "" {
		r.HostPeerID = peerID
		r.ScreenSharePerms[peerID] = true // Host can always share screen
		log.Printf("Host set to peer: %s", peerID)
	}
}

// IsHost checks if a peer is the host
func (r *Room) IsHost(peerID string) bool {
	r.PermLock.RLock()
	defer r.PermLock.RUnlock()
	return r.HostPeerID == peerID
}

// GrantScreenShare gives screen sharing permission to a peer
func (r *Room) GrantScreenShare(peerID string) {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	r.ScreenSharePerms[peerID] = true
	log.Printf("Screen share granted to peer: %s", peerID)
}

// RevokeScreenShare removes screen sharing permission from a peer
func (r *Room) RevokeScreenShare(peerID string) {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	
	// Cannot revoke host's permission
	if peerID != r.HostPeerID {
		r.ScreenSharePerms[peerID] = false
		log.Printf("Screen share revoked for peer: %s", peerID)
	}
}

// CanShareScreen checks if a peer has screen sharing permission
func (r *Room) CanShareScreen(peerID string) bool {
	r.PermLock.RLock()
	defer r.PermLock.RUnlock()
	return r.ScreenSharePerms[peerID]
}

// GetHostPeerID returns the current host's peer ID
func (r *Room) GetHostPeerID() string {
	r.PermLock.RLock()
	defer r.PermLock.RUnlock()
	return r.HostPeerID
}

// ============= CO-HOST MANAGEMENT =============

// AddCoHost promotes a participant to co-host
func (r *Room) AddCoHost(peerID string) {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	r.CoHosts[peerID] = true
	r.ScreenSharePerms[peerID] = true // Co-hosts can share screen
	log.Printf("Co-host added: %s", peerID)
}

// RemoveCoHost demotes a co-host
func (r *Room) RemoveCoHost(peerID string) {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	delete(r.CoHosts, peerID)
	log.Printf("Co-host removed: %s", peerID)
}

// IsCoHost checks if a peer is a co-host
func (r *Room) IsCoHost(peerID string) bool {
	r.PermLock.RLock()
	defer r.PermLock.RUnlock()
	return r.CoHosts[peerID]
}

// IsHostOrCoHost checks if a peer has admin privileges
func (r *Room) IsHostOrCoHost(peerID string) bool {
	r.PermLock.RLock()
	defer r.PermLock.RUnlock()
	return r.HostPeerID == peerID || r.CoHosts[peerID]
}

// ============= ROOM SECURITY =============

// LockRoom prevents new participants from joining
func (r *Room) LockRoom() {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	r.IsLocked = true
	log.Println("Room locked")
}

// UnlockRoom allows new participants to join
func (r *Room) UnlockRoom() {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	r.IsLocked = false
	log.Println("Room unlocked")
}

// IsRoomLocked checks if room is locked
func (r *Room) IsRoomLocked() bool {
	r.PermLock.RLock()
	defer r.PermLock.RUnlock()
	return r.IsLocked
}

// ============= CHAT CONTROLS =============

// DisableChat disables chat for all participants
func (r *Room) DisableChat() {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	r.IsChatDisabled = true
	log.Println("Chat disabled")
}

// EnableChat enables chat for all participants
func (r *Room) EnableChat() {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	r.IsChatDisabled = false
	log.Println("Chat enabled")
}

// IsChatEnabled checks if chat is enabled
func (r *Room) IsChatEnabled() bool {
	r.PermLock.RLock()
	defer r.PermLock.RUnlock()
	return !r.IsChatDisabled
}

// ============= MUTE CONTROLS =============

// MuteParticipant mutes a specific participant
func (r *Room) MuteParticipant(peerID string) {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	r.MutedParticipants[peerID] = true
	log.Printf("Participant muted: %s", peerID)
}

// UnmuteParticipant unmutes a specific participant
func (r *Room) UnmuteParticipant(peerID string) {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	delete(r.MutedParticipants, peerID)
	log.Printf("Participant unmuted: %s", peerID)
}

// IsParticipantMuted checks if a participant is muted
func (r *Room) IsParticipantMuted(peerID string) bool {
	r.PermLock.RLock()
	defer r.PermLock.RUnlock()
	return r.MutedParticipants[peerID]
}

// MuteAll mutes all participants except host and co-hosts
func (r *Room) MuteAll() {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	
	r.Peers.ListLock.RLock()
	for _, conn := range r.Peers.Connections {
		// Don't mute host or co-hosts
		if conn.PeerID != r.HostPeerID && !r.CoHosts[conn.PeerID] {
			r.MutedParticipants[conn.PeerID] = true
		}
	}
	r.Peers.ListLock.RUnlock()
	log.Println("All participants muted")
}

// UnmuteAll unmutes all participants
func (r *Room) UnmuteAll() {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	r.MutedParticipants = make(map[string]bool)
	log.Println("All participants unmuted")
}

// ============= WAITING ROOM =============

// AddToWaitingRoom adds a participant to the waiting room
func (r *Room) AddToWaitingRoom(peerID, name string, conn interface{}) {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	
	r.WaitingRoom[peerID] = &WaitingParticipant{
		PeerID:   peerID,
		Name:     name,
		JoinTime: time.Now(),
		Conn:     conn,
	}
	log.Printf("Added to waiting room: %s (%s)", name, peerID)
}

// AdmitFromWaitingRoom admits a participant from waiting room
func (r *Room) AdmitFromWaitingRoom(peerID string) *WaitingParticipant {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	
	participant := r.WaitingRoom[peerID]
	if participant != nil {
		delete(r.WaitingRoom, peerID)
		log.Printf("Admitted from waiting room: %s", peerID)
	}
	return participant
}

// RemoveFromWaitingRoom removes a participant from waiting room (deny entry)
func (r *Room) RemoveFromWaitingRoom(peerID string) {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	delete(r.WaitingRoom, peerID)
	log.Printf("Removed from waiting room: %s", peerID)
}

// GetWaitingParticipants returns all participants in waiting room
func (r *Room) GetWaitingParticipants() []*WaitingParticipant {
	r.PermLock.RLock()
	defer r.PermLock.RUnlock()
	
	participants := make([]*WaitingParticipant, 0, len(r.WaitingRoom))
	for _, p := range r.WaitingRoom {
		participants = append(participants, p)
	}
	return participants
}

// ============= RECORDING =============

// StartRecording starts recording the session
func (r *Room) StartRecording() {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	
	if !r.IsRecording {
		r.IsRecording = true
		r.RecordingStartTime = time.Now()
		log.Println("Recording started")
	}
}

// StopRecording stops recording the session
func (r *Room) StopRecording() time.Duration {
	r.PermLock.Lock()
	defer r.PermLock.Unlock()
	
	var duration time.Duration
	if r.IsRecording {
		duration = time.Since(r.RecordingStartTime)
		r.IsRecording = false
		log.Printf("Recording stopped. Duration: %v", duration)
	}
	return duration
}

// IsRecordingActive checks if recording is active
func (r *Room) IsRecordingActive() bool {
	r.PermLock.RLock()
	defer r.PermLock.RUnlock()
	return r.IsRecording
}

// GetRecordingDuration returns current recording duration
func (r *Room) GetRecordingDuration() time.Duration {
	r.PermLock.RLock()
	defer r.PermLock.RUnlock()
	
	if r.IsRecording {
		return time.Since(r.RecordingStartTime)
	}
	return 0
}

// RequestScreenShare handles a screen share request
func (r *Room) RequestScreenShare(peerID string) {
	// Auto-approve for host
	if r.IsHost(peerID) {
		r.GrantScreenShare(peerID)
		return
	}
	
	// For others, send request to host
	log.Printf("Peer %s requesting screen share permission", peerID)
}
