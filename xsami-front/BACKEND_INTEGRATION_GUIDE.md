# Backend WebSocket Events - Implementation Guide

This document lists the new WebSocket events that need to be implemented in the Go backend to support the newly added frontend features.

## 🔄 New Events Overview

The frontend now sends **4 new events** that the backend needs to handle:

1. `admit-participant` - Admit a waiting participant to the room
2. `deny-participant` - Deny a waiting participant from joining
3. `recording-started` - Notify that recording has started
4. `recording-stopped` - Notify that recording has stopped

---

## 📥 Events Received by Backend (From Frontend)

### 1. admit-participant

**When:** Host clicks "Admit" button in Waiting Room tab

**Payload:**
```json
{
  "event": "admit-participant",
  "data": {
    "peerId": "peer-uuid-123"
  }
}
```

**Backend Action Required:**
- Remove participant from waiting list
- Send `peer-joined` event to all participants
- Allow the participant's connection to proceed
- Add participant to room's active participants list

**Response to Send:**
```json
// To all participants:
{
  "event": "peer-joined",
  "data": {
    "peerId": "peer-uuid-123",
    "username": "John Doe"
  }
}
```

---

### 2. deny-participant

**When:** Host clicks "Deny" button in Waiting Room tab

**Payload:**
```json
{
  "event": "deny-participant",
  "data": {
    "peerId": "peer-uuid-123"
  }
}
```

**Backend Action Required:**
- Remove participant from waiting list
- Close WebSocket connection for that participant
- Send rejection message to the denied participant
- Log the denial event

**Response to Send:**
```json
// To denied participant only:
{
  "event": "kicked",
  "data": {
    "reason": "denied"
  }
}
```

---

### 3. recording-started

**When:** Host clicks "Start Recording" in Recording tab

**Payload:**
```json
{
  "event": "recording-started",
  "data": {
    "recordingId": "rec-1730150400-abc123"
  }
}
```

**Backend Action Required:**
- Initialize recording process (if implementing server-side recording)
- Store recording metadata (start time, host, room ID)
- Notify all participants that recording has started
- Update room state to indicate recording in progress

**Response to Send:**
```json
// To all participants:
{
  "event": "recording-started",
  "data": {
    "recordingId": "rec-1730150400-abc123",
    "startedBy": "host-peer-id",
    "startTime": "2025-10-28T10:30:00Z"
  }
}
```

---

### 4. recording-stopped

**When:** Host clicks "Stop Recording" in Recording tab

**Payload:**
```json
{
  "event": "recording-stopped",
  "data": {
    "recordingId": "rec-1730150400-abc123"
  }
}
```

**Backend Action Required:**
- Stop recording process
- Finalize recording file (if implementing server-side recording)
- Calculate total duration
- Notify all participants that recording has stopped
- Update room state

**Response to Send:**
```json
// To all participants:
{
  "event": "recording-stopped",
  "data": {
    "recordingId": "rec-1730150400-abc123",
    "duration": 1245, // seconds
    "stoppedAt": "2025-10-28T10:50:45Z"
  }
}
```

---

## 📤 Events Sent by Backend (To Frontend)

### waiting-participant-joined

**When:** A new participant tries to join a locked room

**Purpose:** Notify host that someone is waiting

**Payload:**
```json
{
  "event": "waiting-participant-joined",
  "data": {
    "peerId": "peer-uuid-456",
    "username": "Jane Smith",
    "timestamp": "2025-10-28T10:35:00Z"
  }
}
```

**Send to:** Host only (or all co-hosts)

---

## 🔧 Backend Implementation Guide

### File: `internal/handler/room.go`

Add these new event handlers after the existing ones:

```go
// Handle admit-participant event
func handleAdmitParticipant(c *websocket.Conn, room *webrtc.Room, data map[string]interface{}) {
    peerId, ok := data["peerId"].(string)
    if !ok {
        log.Println("Invalid peerId in admit-participant")
        return
    }
    
    // Remove from waiting list
    room.RemoveWaitingParticipant(peerId)
    
    // Get participant username
    username := room.GetWaitingParticipantUsername(peerId)
    
    // Notify all participants
    room.Broadcast(map[string]interface{}{
        "event": "peer-joined",
        "data": map[string]interface{}{
            "peerId": peerId,
            "username": username,
        },
    })
    
    log.Printf("Admitted participant %s (%s) to room", username, peerId)
}

// Handle deny-participant event
func handleDenyParticipant(c *websocket.Conn, room *webrtc.Room, data map[string]interface{}) {
    peerId, ok := data["peerId"].(string)
    if !ok {
        log.Println("Invalid peerId in deny-participant")
        return
    }
    
    // Get participant connection
    conn := room.GetWaitingParticipantConnection(peerId)
    if conn != nil {
        // Send kicked message
        conn.WriteJSON(map[string]interface{}{
            "event": "kicked",
            "data": map[string]interface{}{
                "reason": "denied",
            },
        })
        
        // Close connection
        conn.Close()
    }
    
    // Remove from waiting list
    room.RemoveWaitingParticipant(peerId)
    
    log.Printf("Denied participant %s from room", peerId)
}

// Handle recording-started event
func handleRecordingStarted(c *websocket.Conn, room *webrtc.Room, data map[string]interface{}) {
    recordingId, ok := data["recordingId"].(string)
    if !ok {
        log.Println("Invalid recordingId in recording-started")
        return
    }
    
    // Update room state
    room.SetRecordingState(true, recordingId)
    
    // Notify all participants
    room.Broadcast(map[string]interface{}{
        "event": "recording-started",
        "data": map[string]interface{}{
            "recordingId": recordingId,
            "startedBy": room.GetHostId(),
            "startTime": time.Now().Format(time.RFC3339),
        },
    })
    
    log.Printf("Recording started: %s", recordingId)
}

// Handle recording-stopped event
func handleRecordingStopped(c *websocket.Conn, room *webrtc.Room, data map[string]interface{}) {
    recordingId, ok := data["recordingId"].(string)
    if !ok {
        log.Println("Invalid recordingId in recording-stopped")
        return
    }
    
    // Calculate duration
    duration := room.GetRecordingDuration()
    
    // Update room state
    room.SetRecordingState(false, "")
    
    // Notify all participants
    room.Broadcast(map[string]interface{}{
        "event": "recording-stopped",
        "data": map[string]interface{}{
            "recordingId": recordingId,
            "duration": duration,
            "stoppedAt": time.Now().Format(time.RFC3339),
        },
    })
    
    log.Printf("Recording stopped: %s (duration: %d seconds)", recordingId, duration)
}
```

### Add Event Handlers to Switch Statement

In the main message handler, add these cases:

```go
switch event {
    // ... existing cases ...
    
    case "admit-participant":
        handleAdmitParticipant(c, room, data)
        
    case "deny-participant":
        handleDenyParticipant(c, room, data)
        
    case "recording-started":
        handleRecordingStarted(c, room, data)
        
    case "recording-stopped":
        handleRecordingStopped(c, room, data)
}
```

---

## 🏗️ Room Structure Updates

### File: `pkg/webrtc/room.go`

Add these fields and methods:

```go
type Room struct {
    // ... existing fields ...
    
    // New fields
    WaitingParticipants map[string]*WaitingParticipant
    IsRecording         bool
    RecordingId         string
    RecordingStartTime  time.Time
}

type WaitingParticipant struct {
    PeerId     string
    Username   string
    Connection *websocket.Conn
    Timestamp  time.Time
}

// New methods
func (r *Room) AddWaitingParticipant(peerId, username string, conn *websocket.Conn) {
    r.mu.Lock()
    defer r.mu.Unlock()
    
    r.WaitingParticipants[peerId] = &WaitingParticipant{
        PeerId:     peerId,
        Username:   username,
        Connection: conn,
        Timestamp:  time.Now(),
    }
}

func (r *Room) RemoveWaitingParticipant(peerId string) {
    r.mu.Lock()
    defer r.mu.Unlock()
    
    delete(r.WaitingParticipants, peerId)
}

func (r *Room) GetWaitingParticipantUsername(peerId string) string {
    r.mu.RLock()
    defer r.mu.RUnlock()
    
    if wp, exists := r.WaitingParticipants[peerId]; exists {
        return wp.Username
    }
    return ""
}

func (r *Room) SetRecordingState(isRecording bool, recordingId string) {
    r.mu.Lock()
    defer r.mu.Unlock()
    
    r.IsRecording = isRecording
    r.RecordingId = recordingId
    
    if isRecording {
        r.RecordingStartTime = time.Now()
    }
}

func (r *Room) GetRecordingDuration() int64 {
    r.mu.RLock()
    defer r.mu.RUnlock()
    
    if r.RecordingStartTime.IsZero() {
        return 0
    }
    
    return int64(time.Since(r.RecordingStartTime).Seconds())
}
```

---

## ✅ Testing Checklist

- [ ] Test admit-participant event with locked room
- [ ] Test deny-participant event with locked room
- [ ] Test recording-started event broadcasts to all participants
- [ ] Test recording-stopped event with correct duration
- [ ] Test waiting room with multiple waiting participants
- [ ] Test recording state persists correctly
- [ ] Test edge cases (invalid peerId, missing data, etc.)
- [ ] Verify WebSocket connection handling
- [ ] Test concurrent operations (multiple admits/denies)
- [ ] Verify memory cleanup (remove waiting participants properly)

---

## 🔍 Debugging

Enable verbose logging for these events:

```go
log.Printf("📥 Received event: %s from peer: %s", event, peerId)
log.Printf("📤 Broadcasting event: %s to %d participants", event, len(room.Participants))
log.Printf("⏳ Waiting participants: %d", len(room.WaitingParticipants))
log.Printf("🎥 Recording state: %v (ID: %s)", room.IsRecording, room.RecordingId)
```

---

## 📊 Expected Flow

### Waiting Room Flow:
1. User tries to join locked room
2. Backend adds to `WaitingParticipants` map
3. Backend sends `waiting-participant-joined` to host
4. Host sees user in Waiting Room tab
5. Host clicks "Admit" → Backend receives `admit-participant`
6. Backend broadcasts `peer-joined` to all
7. User enters room successfully

### Recording Flow:
1. Host clicks "Start Recording"
2. Frontend sends `recording-started` with unique ID
3. Backend updates room state, starts timer
4. Backend broadcasts to all participants
5. All participants see recording indicator
6. Host clicks "Stop Recording"
7. Frontend sends `recording-stopped`
8. Backend calculates duration, broadcasts
9. Recording indicator disappears for all

---

## 🚀 Deployment Notes

- Ensure backwards compatibility with existing events
- Add rate limiting for admit/deny to prevent abuse
- Consider adding authentication for recording operations
- Log all recording events for audit trail
- Implement proper cleanup when host disconnects during recording

---

**Last Updated:** October 28, 2025  
**Version:** 1.0  
**Status:** Ready for Backend Implementation
