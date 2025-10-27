# 🧪 Testing Guide - Multi-User Video Fix

## Quick Test (3 Users)

### Setup
1. Make sure server is running:
   ```bash
   ./bin/xsami
   ```

2. Open **3 different browsers/windows**:
   - Chrome (normal)
   - Chrome (Incognito)
   - Firefox

---

## Step-by-Step Test

### Step 1: First User (Host)
1. Open: `http://localhost:8080`
2. Click "Start Meeting" or go to: `http://localhost:8080/room/create`
3. Allow camera and microphone permissions
4. You should see your own video (local)
5. **Copy the room URL** from address bar
   ```
   Example: http://localhost:8080/room/abc-123-def-456
   ```

### Step 2: Second User
1. Open the **same room URL** in a second browser/window
2. Allow camera and microphone
3. Wait 2-3 seconds for connection

**✅ EXPECTED:**
- **User 1 sees**: Their own video + User 2's video (2 total)
- **User 2 sees**: Their own video + User 1's video (2 total)

### Step 3: Third User
1. Open the **same room URL** in a third browser/window
2. Allow camera and microphone
3. Wait 2-3 seconds for connections to establish

**✅ EXPECTED:**
- **User 1 sees**: Their own video + User 2's video + User 3's video (3 total)
- **User 2 sees**: Their own video + User 1's video + User 3's video (3 total)
- **User 3 sees**: Their own video + User 1's video + User 2's video (3 total)

---

## What to Look For

### ✅ Success Indicators

**Visual:**
- [ ] All users see all other participants
- [ ] Videos are playing smoothly
- [ ] Audio is working (test by speaking)
- [ ] Grid adjusts automatically (2x1, 2x2, etc.)

**Browser Console (F12):**
```javascript
WebSocket connected
Creating peer connection for peer_xxx, initiator: true
Remote track received from peer_xxx : video
Remote track received from peer_xxx : audio
Video element created for peer peer_xxx
Connection state with peer_xxx: connected
ICE connection state with peer_xxx: connected
```

**Server Logs:**
```
Peer peer_abc123 joining room xyz
Track received from peer peer_abc123: xxx, Type: video
Track received from peer peer_abc123: yyy, Type: audio
Peer Connection State: connected
ICE Connection State: connected
```

---

## ❌ Troubleshooting

### Problem: Can't see other users

**Check 1: Browser Console**
```javascript
// Look for errors like:
Failed to set remote description
Error handling signaling message
Connection state: failed
```

**Check 2: Network Tab (F12 → Network → WS)**
- WebSocket connection should be active (green)
- Should see continuous messages

**Check 3: Permissions**
- Ensure camera/mic permissions granted
- Check browser address bar for blocked icons

### Problem: Only 2 users visible (old bug)

**Solution:**
1. Hard refresh all browsers: `Ctrl + Shift + R`
2. Clear browser cache
3. Restart server:
   ```bash
   pkill -f xsami
   ./bin/xsami &
   ```

### Problem: No audio/video

**Check:**
- Camera/mic not in use by another app
- Correct devices selected (click settings icon)
- Green indicators on mic/camera buttons

---

## Advanced Testing

### Test 4+ Users
1. Open 4-6 browser windows
2. Join same room
3. Verify grid layout changes:
   - 4 users → 2×2 grid
   - 5-6 users → 3×2 grid
   - 7-9 users → 3×3 grid

### Test Screen Sharing
1. Join with 2+ users
2. User 1 clicks screen share button
3. **Expected:** All other users see User 1's screen

### Test Connection Stability
1. User 2 closes browser
2. **Expected:** User 1 and 3 see User 2's video disappear
3. Reconnect User 2
4. **Expected:** Everyone sees everyone again

### Test Chat
1. Open chat sidebar (click chat icon)
2. Send messages
3. **Expected:** All users receive messages in real-time

---

## Performance Check

### Browser Performance
Open Chrome Task Manager (Shift + Esc):
- **2 users**: ~200-300 MB RAM per tab
- **4 users**: ~400-500 MB RAM per tab
- **6 users**: ~600-800 MB RAM per tab

### Network Usage (Chrome DevTools → Network)
- **Video**: ~1-2 Mbps upload per peer
- **Audio**: ~50-100 kbps upload per peer
- **Total for 4 users**: ~3-6 Mbps upload

---

## Comparison: Before vs After

### Before Fix ❌
```
User A joins → sees self ✓
User B joins → sees self + User A ✓
User C joins → sees ONLY self ❌
User A sees → self + User B (not User C) ❌
```

### After Fix ✅
```
User A joins → sees self ✓
User B joins → sees self + User A ✓
User C joins → sees self + User A + User B ✓
User A sees → self + User B + User C ✓
User B sees → self + User A + User C ✓
```

---

## Log Analysis

### Good Session Log
```bash
# User 1 joins
11:50:00 | Peer peer_abc123 joining room xyz
11:50:00 | Track received from peer peer_abc123: track1, Type: video
11:50:00 | Track received from peer peer_abc123: track2, Type: audio

# User 2 joins
11:50:15 | Peer peer_def456 joining room xyz
11:50:15 | Track received from peer peer_def456: track3, Type: video
11:50:15 | Track received from peer peer_def456: track4, Type: audio

# User 3 joins
11:50:30 | Peer peer_ghi789 joining room xyz
11:50:30 | Track received from peer peer_ghi789: track5, Type: video
11:50:30 | Track received from peer peer_ghi789: track6, Type: audio

# Connection states
11:50:35 | Peer peer_abc123 Connection State: connected
11:50:35 | Peer peer_def456 Connection State: connected
11:50:35 | Peer peer_ghi789 Connection State: connected
```

---

## Quick Verification Checklist

Run through this checklist:

- [ ] Server starts without errors
- [ ] Can open welcome page
- [ ] Can create a room
- [ ] Camera and mic work
- [ ] Second user can join
- [ ] Both users see each other
- [ ] Third user can join
- [ ] All three users see each other
- [ ] Chat works
- [ ] Screen sharing works
- [ ] User leaving removes their video
- [ ] Participant count updates
- [ ] No console errors

---

## Expected Results Summary

| Users in Room | Grid Layout | Peer Connections per User |
|--------------|-------------|---------------------------|
| 1 | 1×1 | 0 |
| 2 | 2×1 | 1 |
| 3 | 2×2 | 2 |
| 4 | 2×2 | 3 |
| 5 | 3×2 | 4 |
| 6 | 3×2 | 5 |

Each user should see **all other users** in the meeting!

---

## Success! 🎉

If you can:
1. ✅ Open 3 browser windows
2. ✅ Join same room
3. ✅ See all 3 videos in each window
4. ✅ Hear audio from others
5. ✅ Share screen and everyone sees it

**Then the fix is working perfectly!**

Your video conferencing app now supports full multi-user meetings! 🎥✨
