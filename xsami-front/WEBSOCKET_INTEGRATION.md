# WebSocket Integration Guide

## Overview
This document describes the WebSocket events used in the XSAMI video conferencing application and provides implementation guidance for backend developers.

## Connection Flow

### 1. Client Connects
- Client connects to: `ws://backend-url/room/{roomId}/websocket`
- Client sends `join` event with username
- Server responds with `peers` event containing room state

```typescript
// Client → Server
{
  event: 'join',
  data: {
    peerId: 'peer_abc123',
    username: 'John Doe'
  }
}

// Server → Client  
{
  event: 'peers',
  data: {
    yourId: 'peer_abc123',
    peers: ['peer_xyz789', 'peer_def456'],
    isHost: true,
    hostId: 'peer_abc123',
    roomLocked: false
  }
}
```

## Core WebRTC Signaling Events

### Offer/Answer/ICE Candidate
Used for WebRTC peer connection establishment.

```typescript
// Offer
{
  event: 'offer',
  data: {
    peerId: 'sender_id',
    targetPeerId: 'receiver_id',
    username: 'John Doe',
    sdp: '...' // SDP offer string
  }
}

// Answer
{
  event: 'answer',
  data: {
    peerId: 'sender_id',
    targetPeerId: 'receiver_id',
    sdp: '...' // SDP answer string
  }
}

// ICE Candidate
{
  event: 'candidate',
  data: {
    peerId: 'sender_id',
    targetPeerId: 'receiver_id',
    candidate: '...' // JSON stringified RTCIceCandidate
  }
}
```

## Room Management Events

### Peer Join/Leave
```typescript
// Peer Joined (broadcast to all except joiner)
{
  event: 'peer-joined',
  data: {
    peerId: 'new_peer_id',
    username: 'Jane Smith'
  }
}

// Peer Left (broadcast to all)
{
  event: 'peer-left',
  data: {
    peerId: 'leaving_peer_id'
  }
}
```

### Room Lock/Unlock
```typescript
// Lock Room (host only)
{
  event: 'room-locked',
  data: {}
}

// Unlock Room (host only)
{
  event: 'room-unlocked',
  data: {}
}
```

### Kick Participant
```typescript
// Host → Server
{
  event: 'kicked',
  data: {
    targetPeerId: 'peer_to_remove'
  }
}

// Server → Kicked Participant
{
  event: 'kicked',
  data: {}
}
```

## Interactive Features

### Raised Hands
```typescript
// Raise Hand
{
  event: 'raise-hand',
  data: {
    peerId: 'peer_abc123',
    username: 'John Doe'
  }
}

// Lower Hand
{
  event: 'lower-hand',
  data: {
    peerId: 'peer_abc123'
  }
}
```

**Backend Implementation:**
- Maintain a Map<roomId, Set<raisedHandData>> on server
- Broadcast raise-hand to all participants in room
- Broadcast lower-hand to all participants
- Clear raised hands when participant leaves

### Reactions
```typescript
{
  event: 'reaction',
  data: {
    peerId: 'peer_abc123',
    emoji: '👍' // One of: '👍' | '❤️' | '😂' | '🎉' | '👏' | '🤔'
  }
}
```

**Backend Implementation:**
- Broadcast to all other participants in room
- No need to persist (transient feature)

### Chat Messages
```typescript
{
  event: 'chat-message',
  data: {
    id: 'msg_abc123',
    username: 'John Doe',
    message: 'Hello everyone!',
    timestamp: 1698500000000,
    peerId: 'peer_abc123'
  }
}
```

**Backend Implementation:**
- Broadcast to all participants
- Optionally persist in database
- Check if chat is enabled for the room

### Chat Enable/Disable
```typescript
// Enable Chat (host only)
{
  event: 'chat-enabled',
  data: {}
}

// Disable Chat (host only)
{
  event: 'chat-disabled',
  data: {}
}
```

### Screen Sharing
```typescript
// Start Sharing
{
  event: 'screen-share-start',
  data: {
    peerId: 'peer_abc123'
  }
}

// Stop Sharing
{
  event: 'screen-share-stop',
  data: {
    peerId: 'peer_abc123'
  }
}
```

## Advanced Features (Optional)

### Mute Participant (Host Only)
```typescript
{
  event: 'mute-participant',
  data: {
    targetPeerId: 'peer_to_mute'
  }
}
```

**Note:** Currently not implemented in frontend. Would require backend support to force mute.

### Promote to Co-Host
```typescript
{
  event: 'promote-co-host',
  data: {
    targetPeerId: 'peer_to_promote'
  }
}
```

**Note:** Currently not implemented. Would require role management system.

## Security Considerations

### Authentication & Authorization
- Verify user identity before allowing room join
- Validate host permissions before processing admin actions
- Rate limit WebSocket messages to prevent abuse

### Host-Only Actions
The following events should only be accepted from the room host:
- `room-locked` / `room-unlocked`
- `chat-enabled` / `chat-disabled`
- `kicked` (removing participants)
- `mute-participant` (if implemented)
- `promote-co-host` (if implemented)

### Validation
- Validate `peerId` format and existence
- Sanitize usernames and chat messages
- Validate emoji types for reactions
- Check room capacity limits

## Error Handling

### Connection Errors
```typescript
{
  event: 'error',
  data: {
    code: 'ROOM_FULL' | 'ROOM_LOCKED' | 'INVALID_ROOM' | 'UNAUTHORIZED',
    message: 'Error description'
  }
}
```

### Best Practices
1. **Reconnection Logic:** Client should attempt reconnection with exponential backoff
2. **Heartbeat/Ping:** Implement ping/pong to detect dead connections
3. **Message Ordering:** Ensure critical events (peer-joined, peer-left) are processed in order
4. **State Sync:** Provide state recovery mechanism for reconnecting clients

## Backend Implementation Checklist

### Core Functionality
- [ ] WebSocket connection handling
- [ ] Room creation and management
- [ ] Peer join/leave events
- [ ] WebRTC signaling relay (offer/answer/candidate)
- [ ] Host assignment (first joiner or designated)

### Interactive Features
- [ ] Chat message broadcasting
- [ ] Chat enable/disable
- [ ] Raised hands tracking
- [ ] Reactions broadcasting
- [ ] Screen share notifications

### Admin Features
- [ ] Room lock/unlock
- [ ] Participant kick/removal
- [ ] Host validation for admin actions

### Optional Advanced Features
- [ ] Force mute participant
- [ ] Co-host role management
- [ ] Waiting room
- [ ] Recording
- [ ] Breakout rooms

## Testing Recommendations

### Unit Tests
- Message parsing and validation
- Permission checking (host-only actions)
- State management (room state, participants)

### Integration Tests
- Multiple client connections
- Peer connection establishment
- Message broadcasting
- Reconnection handling

### Load Tests
- Maximum participants per room
- Message throughput
- Connection stability under load

## Example Server Implementation (Node.js/TypeScript)

```typescript
import WebSocket from 'ws';

interface Room {
  id: string;
  hostId: string;
  participants: Map<string, Participant>;
  isLocked: boolean;
  isChatEnabled: boolean;
  raisedHands: Set<string>;
}

interface Participant {
  peerId: string;
  username: string;
  ws: WebSocket;
}

class RoomManager {
  private rooms = new Map<string, Room>();

  handleMessage(ws: WebSocket, peerId: string, message: WebSocketMessage) {
    const room = this.getRoomForPeer(peerId);
    if (!room) return;

    switch (message.event) {
      case 'raise-hand':
        room.raisedHands.add(peerId);
        this.broadcast(room, message, peerId);
        break;

      case 'reaction':
        this.broadcast(room, message, peerId);
        break;

      case 'chat-message':
        if (room.isChatEnabled) {
          this.broadcast(room, message);
        }
        break;

      case 'room-locked':
        if (peerId === room.hostId) {
          room.isLocked = true;
          this.broadcast(room, message);
        }
        break;

      // ... handle other events
    }
  }

  private broadcast(room: Room, message: any, excludePeerId?: string) {
    room.participants.forEach((participant) => {
      if (participant.peerId !== excludePeerId) {
        participant.ws.send(JSON.stringify(message));
      }
    });
  }
}
```

## Client-Side Integration

The frontend automatically handles:
- WebSocket connection establishment
- Automatic event handling in `useWebRTCSignaling` hook
- State management through Zustand store
- UI updates based on incoming events

All WebSocket sends are done through:
```typescript
import { webSocketService } from '@/services/websocket.service';

webSocketService.send({
  event: 'event-name',
  data: { /* event data */ }
});
```

## Support

For questions or issues with WebSocket integration:
- Check browser console for WebSocket connection errors
- Verify WebSocket URL format: `ws://host/room/{roomId}/websocket`
- Ensure backend is handling CORS properly for WebSocket connections
- Test with multiple browser tabs to verify real-time sync
