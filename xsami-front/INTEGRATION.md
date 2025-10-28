# Integration Guide: Next.js Frontend with Go Backend

This guide explains how the Next.js frontend integrates with your existing Go backend.

## Overview

The new Next.js frontend (`xsami-front/`) runs as a separate application but communicates with your Go backend through:
1. REST API endpoints
2. WebSocket connections for signaling
3. WebSocket connections for chat

## Architecture Diagram

```
┌─────────────────────┐         ┌──────────────────────┐
│   Next.js Frontend  │         │    Go Backend        │
│   (Port 3000)       │         │    (Port 8080)       │
│                     │         │                      │
│  - React Components │◄───────►│  - Fiber HTTP Server │
│  - WebRTC Service   │  HTTP   │  - WebSocket Handler │
│  - WebSocket Service│ WebSocket│  - Room Management   │
│  - Zustand Store    │         │  - Peer Management   │
└─────────────────────┘         └──────────────────────┘
```

## Running Both Applications

### Option 1: Development Mode (Recommended)

**Terminal 1 - Go Backend:**
```bash
cd /home/husain/XSAMI
make run
# Runs on http://localhost:8080
```

**Terminal 2 - Next.js Frontend:**
```bash
cd /home/husain/XSAMI/xsami-front
npm run dev
# Runs on http://localhost:3000
```

### Option 2: Production Mode

**Go Backend:**
```bash
cd /home/husain/XSAMI
make build
./bin/xsami
```

**Next.js Frontend:**
```bash
cd /home/husain/XSAMI/xsami-front
npm run build
npm start
```

## API Endpoints Used

The Next.js frontend expects these endpoints from the Go backend:

### HTTP Endpoints

| Method | Endpoint | Purpose | Used By |
|--------|----------|---------|---------|
| GET | `/` | Welcome page | Not used (Next.js serves its own) |
| GET | `/room/create` | Create new room | Frontend redirects after creating ID |
| GET | `/room/{id}` | Join room | Not used (Next.js serves its own) |

### WebSocket Endpoints

| Endpoint | Purpose | Protocol |
|----------|---------|----------|
| `/room/{id}/websocket` | WebRTC signaling | WebSocket |
| `/room/{id}/chat/websocket` | Chat messages | WebSocket |
| `/room/{id}/viewer/websocket` | Viewer updates | WebSocket |

## WebSocket Message Format

Both applications use the same message format:

```typescript
{
  "event": "join" | "peers" | "offer" | "answer" | "candidate" | ...,
  "data": {
    // Event-specific data
  }
}
```

### Signaling Messages

**1. Join Room:**
```json
{
  "event": "join",
  "data": {
    "peerId": "peer_abc123",
    "username": "John Doe"
  }
}
```

**2. Peer List:**
```json
{
  "event": "peers",
  "data": {
    "yourId": "peer_abc123",
    "peers": ["peer_def456", "peer_ghi789"],
    "isHost": true,
    "hostId": "peer_abc123"
  }
}
```

**3. WebRTC Offer:**
```json
{
  "event": "offer",
  "data": {
    "peerId": "peer_abc123",
    "targetPeerId": "peer_def456",
    "sdp": "v=0\r\no=- ...",
    "username": "John Doe"
  }
}
```

**4. WebRTC Answer:**
```json
{
  "event": "answer",
  "data": {
    "peerId": "peer_def456",
    "targetPeerId": "peer_abc123",
    "sdp": "v=0\r\no=- ..."
  }
}
```

**5. ICE Candidate:**
```json
{
  "event": "candidate",
  "data": {
    "peerId": "peer_abc123",
    "targetPeerId": "peer_def456",
    "candidate": "{\"candidate\":\"...\", \"sdpMid\":\"0\", ...}"
  }
}
```

## Backend Requirements

Your Go backend should handle these WebSocket events:

### Signaling WebSocket Handler

```go
// Example: internal/handler/room.go
func handleWebSocket(c *websocket.Conn) {
    for {
        var msg WebSocketMessage
        err := c.ReadJSON(&msg)
        if err != nil {
            break
        }

        switch msg.Event {
        case "join":
            // Add peer to room
            // Send "peers" message with existing peers
            // Broadcast "peer-joined" to others
        
        case "offer":
            // Forward offer to target peer
        
        case "answer":
            // Forward answer to target peer
        
        case "candidate":
            // Forward ICE candidate to target peer
        
        case "leave":
            // Remove peer from room
            // Broadcast "peer-left" to others
        }
    }
}
```

## CORS Configuration

Your Go backend needs to allow requests from the Next.js frontend:

```go
// In your main.go or server setup
import "github.com/gofiber/fiber/v2/middleware/cors"

app.Use(cors.New(cors.Config{
    AllowOrigins: "http://localhost:3000",
    AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
    AllowHeaders: "Origin, Content-Type, Accept",
    AllowCredentials: true,
}))
```

For production:
```go
AllowOrigins: "https://yourdomain.com"
```

## Environment Configuration

### Next.js (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

### Go Backend
No changes needed - it should already be configured to:
- Serve HTTP on port 8080
- Handle WebSocket upgrades
- Manage rooms and peers

## Data Flow Example

### Creating and Joining a Room

```
1. User visits Next.js app (localhost:3000)
   └─> Next.js serves Home page

2. User clicks "Start Meeting"
   └─> Next.js generates room ID (client-side)
   └─> Navigates to /room/{id}

3. Room page loads
   └─> Next.js serves Room page
   └─> Prompts for username
   └─> Requests camera/microphone access

4. WebSocket connection established
   Frontend: ws://localhost:8080/room/{id}/websocket
   └─> Go backend receives connection
   └─> Registers peer in room

5. Frontend sends "join" message
   {
     "event": "join",
     "data": { "peerId": "peer_abc123", "username": "John" }
   }

6. Backend responds with "peers" message
   {
     "event": "peers",
     "data": {
       "yourId": "peer_abc123",
       "peers": [],
       "isHost": true,
       "hostId": "peer_abc123"
     }
   }

7. Second user joins same room
   └─> Backend sends "peer-joined" to first user
   └─> First user creates RTCPeerConnection
   └─> WebRTC offer/answer exchange begins
```

## Testing the Integration

### 1. Start Backend
```bash
cd /home/husain/XSAMI
make run
```

Check that it's running:
```bash
curl http://localhost:8080/
# Should return HTML or JSON response
```

### 2. Start Frontend
```bash
cd /home/husain/XSAMI/xsami-front
npm run dev
```

### 3. Test WebSocket Connection

Open browser console at `http://localhost:3000` and create a room.

You should see in the console:
```
WebSocket connected
Received message: { event: 'peers', data: { ... } }
```

### 4. Test Peer Connection

1. Open room in Browser Window 1
2. Copy room link
3. Open same link in Browser Window 2
4. Both should see each other's video

## Troubleshooting

### WebSocket Connection Failed

**Problem:** "WebSocket connection failed"

**Solutions:**
1. Check Go backend is running: `curl http://localhost:8080`
2. Check CORS configuration in Go
3. Verify WebSocket upgrade is working
4. Check browser console for errors

### Video Not Showing

**Problem:** "Camera access denied" or black screen

**Solutions:**
1. Grant camera/microphone permissions in browser
2. Check `getUserMedia` constraints
3. Try in a secure context (HTTPS or localhost)
4. Check browser DevTools → Application → Permissions

### Peer Connection Failed

**Problem:** "ICE connection failed"

**Solutions:**
1. Check STUN server configuration
2. Verify WebSocket messages are being forwarded
3. Check firewall settings
4. Consider adding TURN server for NAT traversal

### 404 Not Found

**Problem:** API requests return 404

**Solutions:**
1. Verify Go backend routes are registered
2. Check URL paths match between frontend and backend
3. Review Next.js proxy configuration in `next.config.mjs`

## Performance Considerations

### Development
- Hot reload increases memory usage (normal)
- Source maps enable better debugging
- CORS may slow down requests slightly

### Production
- Build Next.js for optimized bundles: `npm run build`
- Consider CDN for static assets
- Enable gzip/brotli compression on Go backend
- Use WebSocket connection pooling

## Security Checklist

- [ ] CORS properly configured (not wildcard in production)
- [ ] HTTPS/WSS in production
- [ ] Input validation on both frontend and backend
- [ ] Rate limiting on WebSocket connections
- [ ] Room ID validation (prevent injection)
- [ ] User authentication (if needed)
- [ ] Content Security Policy headers

## Deployment Options

### Option 1: Separate Deployments
- Next.js on Vercel/Netlify (port 3000 → 443)
- Go backend on VPS/Cloud (port 8080 → 443)
- Update CORS and environment variables

### Option 2: Same Server
- Go backend serves on port 8080
- Nginx reverse proxy:
  - `yourdomain.com/` → Next.js (port 3000)
  - `yourdomain.com/api` → Go backend (port 8080)
  - `yourdomain.com/ws` → Go WebSocket (port 8080)

### Option 3: Docker Compose
```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "8080:8080"
  
  frontend:
    build: ./xsami-front
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8080
```

## Migration Path

### Phase 1: Parallel Run (Current)
- Both vanilla JS and Next.js run simultaneously
- Test Next.js with real users
- Fix any integration issues

### Phase 2: Feature Parity
- Implement all features in Next.js
- Match vanilla JS functionality
- User acceptance testing

### Phase 3: Switch (Future)
- Make Next.js the default
- Keep vanilla JS as fallback
- Monitor for issues

### Phase 4: Deprecation
- Remove vanilla JS views
- Go backend only provides API/WebSocket
- Full Next.js deployment

## Support

If you encounter integration issues:

1. **Check Logs:**
   - Go backend: Check console output
   - Next.js: Check browser console and terminal

2. **Verify Endpoints:**
   - Test with `curl` or Postman
   - Check WebSocket with tools like Postwoman

3. **Network Tab:**
   - Open browser DevTools → Network
   - Check WebSocket messages (WS tab)
   - Verify request/response data

4. **Review Documentation:**
   - SETUP.md for frontend setup
   - MIGRATION.md for code comparisons
   - PROJECT_SUMMARY.md for overview

## Conclusion

The Next.js frontend integrates seamlessly with your Go backend:
- ✅ Uses existing WebSocket protocol
- ✅ No backend changes required
- ✅ Can run in parallel with vanilla JS version
- ✅ Easy to test and debug
- ✅ Production-ready architecture

Ready to start? Run the quick-start script:
```bash
cd xsami-front
./quick-start.sh
```
