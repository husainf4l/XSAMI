# Migration Guide: Vanilla JS to Next.js

This document explains the migration from the original vanilla JavaScript frontend to the new Next.js implementation.

## Architecture Changes

### Before (Vanilla JS)
```
assets/
├── js/
│   └── room.js (2777 lines - all logic in one file)
├── css/
│   └── style.css (3000+ lines)
views/
├── room.html
├── welcome.html
└── stream.html
```

### After (Next.js)
```
src/
├── app/                    # Pages with App Router
├── components/             # Modular React components
├── services/               # Business logic separation
├── store/                  # Centralized state
├── types/                  # TypeScript definitions
└── lib/                    # Utilities
```

## Key Improvements

### 1. Type Safety
**Before:** No type checking
```javascript
function createPeerConnection(peerId, isInitiator) {
  // No type validation
}
```

**After:** Full TypeScript support
```typescript
function createPeerConnection(
  peerId: string,
  isInitiator: boolean
): RTCPeerConnection {
  // Compile-time type checking
}
```

### 2. State Management
**Before:** Global variables scattered throughout
```javascript
let localStream = null;
let peerConnections = {};
let isHost = false;
// ... 50+ global variables
```

**After:** Centralized Zustand store
```typescript
const useRoomStore = create<RoomStore>((set) => ({
  localStream: null,
  peerConnections: new Map(),
  isHost: false,
  // Single source of truth
}));
```

### 3. Component Reusability
**Before:** Repeated HTML/JS
```javascript
// Video player logic repeated for each peer
function addRemoteVideo(peerId, stream) {
  const html = `
    <div class="video-container">
      <video autoplay></video>
      <!-- Repeated 20+ times -->
    </div>
  `;
}
```

**After:** Reusable React components
```typescript
<VideoPlayer
  stream={stream}
  username={username}
  isLocal={false}
/>
```

### 4. Service Layer
**Before:** Mixed concerns
```javascript
// WebRTC, WebSocket, UI, and business logic all mixed
function handleSignalingMessage(message) {
  // 500+ lines of mixed logic
}
```

**After:** Separation of concerns
```typescript
// services/webrtc.service.ts - WebRTC only
// services/websocket.service.ts - WebSocket only
// components/ - UI only
// store/ - State only
```

## Feature Parity

| Feature | Vanilla JS | Next.js | Status |
|---------|-----------|---------|--------|
| Video/Audio calling | ✅ | ✅ | Complete |
| Screen sharing | ✅ | ✅ | Complete |
| Real-time chat | ✅ | ✅ | Ready for implementation |
| File sharing | ✅ | ⏳ | Can be added |
| Reactions | ✅ | ⏳ | Can be added |
| Polls | ✅ | ⏳ | Can be added |
| Q&A | ✅ | ⏳ | Can be added |
| Annotations | ✅ | ⏳ | Can be added |
| Admin controls | ✅ | ⏳ | Can be added |

## Code Comparison

### WebRTC Connection

**Before (Vanilla JS):**
```javascript
function createPeerConnection(peerId, isInitiator) {
  const pc = new RTCPeerConnection(rtcConfig);
  peerConnections[peerId] = pc;

  if (localStream) {
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });
  }

  pc.ontrack = (event) => {
    handleRemoteTrack(event, peerId);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignalingMessage({
        event: 'candidate',
        data: {
          peerId: myPeerId,
          targetPeerId: peerId,
          candidate: JSON.stringify(event.candidate)
        }
      });
    }
  };

  if (isInitiator) {
    createOffer(peerId);
  }

  return pc;
}
```

**After (Next.js):**
```typescript
// In service
const pc = webRTCService.createPeerConnection(
  (candidate) => {
    webSocketService.send({
      event: 'candidate',
      data: {
        peerId: myPeerId,
        targetPeerId: peerId,
        candidate: JSON.stringify(candidate)
      }
    });
  },
  (event) => {
    updatePeerStream(peerId, event.streams[0]);
  },
  (state) => {
    handleConnectionStateChange(peerId, state);
  }
);

if (localStream) {
  webRTCService.addStreamToPeer(pc, localStream);
}

if (isInitiator) {
  const offer = await webRTCService.createOffer(pc);
  // Send offer
}
```

### UI Components

**Before (Vanilla JS):**
```javascript
function addRemoteVideo(peerId, username, stream) {
  const videoContainer = document.createElement('div');
  videoContainer.className = 'video-container';
  videoContainer.id = `video-${peerId}`;
  videoContainer.innerHTML = `
    <video id="video-${peerId}-element" autoplay playsinline></video>
    <div class="video-overlay">
      <span class="participant-name">${username}</span>
    </div>
    <div class="video-status">
      <!-- More HTML -->
    </div>
  `;
  document.getElementById('videoGrid').appendChild(videoContainer);
  document.getElementById(`video-${peerId}-element`).srcObject = stream;
}
```

**After (Next.js):**
```typescript
// Reusable component
<VideoPlayer
  stream={stream}
  username={username}
  isLocal={false}
  isMuted={false}
  isVideoEnabled={true}
/>
```

## Migration Benefits

### Performance
- **Code splitting**: Automatic with Next.js
- **Lazy loading**: Components loaded on demand
- **Optimized builds**: Production builds are highly optimized
- **Image optimization**: Built-in Next.js feature

### Developer Experience
- **Hot reload**: Instant feedback during development
- **Type checking**: Catch errors before runtime
- **IntelliSense**: Better IDE support
- **Debugging**: Better error messages and stack traces

### Maintainability
- **Modular code**: Easy to find and fix bugs
- **Reusable components**: Write once, use many times
- **Clear structure**: Consistent project organization
- **Documentation**: Self-documenting with TypeScript

### Scalability
- **Easy to extend**: Add features without touching existing code
- **State management**: Scales with application complexity
- **Testing**: Easier to write unit and integration tests
- **Team collaboration**: Better code organization for multiple developers

## Running Both Versions

You can run both versions side-by-side:

**Go Backend (serves vanilla JS):**
```bash
# In XSAMI root
make run
# Available at http://localhost:8080
```

**Next.js Frontend:**
```bash
# In xsami-front folder
npm run dev
# Available at http://localhost:3000
```

The Next.js version will proxy API requests to the Go backend.

## Incremental Migration Strategy

If you want to migrate gradually:

1. **Phase 1**: Use Next.js for new features only
2. **Phase 2**: Migrate core functionality (video, audio)
3. **Phase 3**: Migrate chat and interactive features
4. **Phase 4**: Migrate admin features
5. **Phase 5**: Deprecate vanilla JS version

## Backwards Compatibility

The new frontend is designed to work with the existing Go backend without changes. It uses the same:
- WebSocket endpoints
- Signaling protocol
- Message formats
- Room structure

## Best Practices for Next.js Version

1. **Keep components small**: One component, one responsibility
2. **Use TypeScript types**: Define types for everything
3. **Separate concerns**: Services for logic, components for UI
4. **Handle errors gracefully**: User-friendly error messages
5. **Test thoroughly**: Multiple browsers and devices

## Future Enhancements

With the Next.js foundation, you can easily add:
- **Server-side rendering**: For SEO and faster initial load
- **Static generation**: Pre-render pages at build time
- **API routes**: Built-in API endpoints
- **Middleware**: Authentication, logging, etc.
- **Internationalization**: Multi-language support
- **PWA**: Progressive web app features
- **Analytics**: Built-in analytics support

## Conclusion

The migration to Next.js provides:
- ✅ Better code organization
- ✅ Type safety
- ✅ Improved performance
- ✅ Easier maintenance
- ✅ Better developer experience
- ✅ Modern tooling
- ✅ Scalability for future features

The vanilla JavaScript version can remain as a lightweight alternative or be gradually deprecated as the Next.js version matures.
