# Annotation Feature Testing Guide

## Test Environment Setup

### Prerequisites
✅ Backend running on `http://localhost:8080`  
✅ Frontend running on `http://localhost:3000`  
✅ Two browser windows or two different browsers  
✅ Modern browser (Chrome, Firefox, Safari recommended)  

## Test Scenarios

### Test 1: Basic Annotation Flow (Single User)
**Objective**: Verify annotation UI appears and tools work

1. Open `http://localhost:3000`
2. Create a new room
3. Enter username (e.g., "Presenter")
4. Grant camera/microphone permissions
5. Click **"Share Screen"** button
6. Select screen/window to share
7. Verify "You are presenting" badge appears
8. Click **"Annotate"** button
9. ✅ **Expected**: Annotation toolbar appears at top-right
10. ✅ **Expected**: Button changes to "Stop Annotating"

### Test 2: Drawing Tools
**Objective**: Verify each drawing tool works correctly

**Pen Tool**:
1. Ensure Pen tool is selected (default)
2. Draw freehand on screen share
3. ✅ **Expected**: Red line appears following mouse movement
4. ✅ **Expected**: Line is smooth and continuous

**Line Tool**:
1. Click Line tool button (─)
2. Click and drag on screen
3. Release mouse
4. ✅ **Expected**: Straight line drawn from start to end point

**Rectangle Tool**:
1. Click Rectangle tool button (□)
2. Click and drag on screen
3. Release mouse
4. ✅ **Expected**: Rectangle outline drawn

**Circle Tool**:
1. Click Circle tool button (○)
2. Click and drag on screen
3. Release mouse
4. ✅ **Expected**: Circle/ellipse drawn

**Eraser Tool**:
1. Draw something with pen tool
2. Click Eraser tool button (🧹)
3. Drag over drawn annotations
4. ✅ **Expected**: Annotations removed where eraser passes

### Test 3: Color and Size Controls
**Objective**: Verify color and size changes work

**Color Change**:
1. Select Pen tool
2. Click Red color button
3. Draw a line
4. Click Blue color button
5. Draw another line
6. ✅ **Expected**: First line is red, second line is blue

**Size Change**:
1. Select Pen tool
2. Set size slider to 1
3. Draw a thin line
4. Set size slider to 20
5. Draw a thick line
6. ✅ **Expected**: First line is thin (1px), second line is thick (20px)

### Test 4: Clear Functionality
**Objective**: Verify clear removes all annotations

1. Draw multiple annotations (pen, line, rectangle, circle)
2. Click **"Clear All"** button (🗑️) in toolbar
3. ✅ **Expected**: All annotations disappear immediately

### Test 5: Real-time Synchronization (Two Users)
**Objective**: Verify remote participants see annotations

**Setup**:
- Browser 1: Presenter (screen sharing)
- Browser 2: Participant (viewing)

**Steps**:
1. **Browser 1**: Create room, enter as "Presenter"
2. **Browser 1**: Start screen sharing
3. **Browser 2**: Join same room, enter as "Viewer"
4. **Browser 2**: Verify presenter's screen appears in main view
5. **Browser 1**: Click "Annotate"
6. **Browser 1**: Draw with pen tool (red color)
7. ✅ **Expected (Browser 2)**: Red pen strokes appear in real-time
8. **Browser 1**: Draw a blue rectangle
9. ✅ **Expected (Browser 2)**: Blue rectangle appears immediately
10. **Browser 1**: Click "Clear All"
11. ✅ **Expected (Browser 2)**: All annotations disappear

### Test 6: Participant Cannot Annotate
**Objective**: Verify only presenter can annotate

**Setup**:
- Browser 1: Presenter (screen sharing)
- Browser 2: Participant (viewing)

**Steps**:
1. **Browser 1**: Start screen sharing and annotate
2. **Browser 2**: Look for "Annotate" button
3. ✅ **Expected**: "Annotate" button does NOT appear for Browser 2
4. ✅ **Expected**: Browser 2 sees annotations but cannot interact

### Test 7: Stop Annotating
**Objective**: Verify annotation mode can be exited

**Method 1 - Control Button**:
1. Enable annotations
2. Click **"Stop Annotating"** button in controls
3. ✅ **Expected**: Toolbar disappears
4. ✅ **Expected**: Canvas becomes non-interactive
5. ✅ **Expected**: Button changes back to "Annotate"

**Method 2 - Toolbar Close**:
1. Enable annotations
2. Click **X** button on toolbar
3. ✅ **Expected**: Toolbar disappears
4. ✅ **Expected**: Annotations remain visible but no new drawing

### Test 8: Annotations Persist During Session
**Objective**: Verify annotations stay visible until cleared

1. Draw multiple annotations
2. Stop annotating (click "Stop Annotating")
3. Wait 10 seconds
4. ✅ **Expected**: Annotations still visible
5. Click "Annotate" again
6. ✅ **Expected**: Previous annotations still present
7. Click "Clear All"
8. ✅ **Expected**: All annotations removed

### Test 9: Multiple Participants See Same Annotations
**Objective**: Verify sync works with 3+ participants

**Setup**:
- Browser 1: Presenter
- Browser 2: Viewer 1
- Browser 3: Viewer 2

**Steps**:
1. **Browser 1**: Start screen sharing and annotate
2. **Browser 1**: Draw various annotations (different tools and colors)
3. ✅ **Expected (Browser 2 & 3)**: Both see identical annotations in real-time
4. **Browser 1**: Clear all
5. ✅ **Expected (Browser 2 & 3)**: Both see annotations disappear simultaneously

### Test 10: Screen Share Stop Clears Annotations
**Objective**: Verify annotations reset when screen sharing stops

1. Start screen sharing
2. Draw annotations
3. Click **"Stop Sharing"** button
4. ✅ **Expected**: Screen share stops
5. ✅ **Expected**: "Annotate" button disappears
6. Start screen sharing again
7. Click "Annotate"
8. ✅ **Expected**: Canvas is blank (previous annotations cleared)

### Test 11: Console Logging
**Objective**: Verify proper logging for debugging

1. Open Browser DevTools (F12)
2. Go to Console tab
3. Enable annotations and draw
4. ✅ **Expected**: See logs like:
   - `✏️ Annotation draw received: pen`
   - `🧹 Annotation clear received`

**Backend Logs** (check terminal):
1. Draw annotations
2. ✅ **Expected**: See logs like:
   - `✏️ Annotation draw from peer: [peerId]`
   - `🧹 Annotation clear from peer: [peerId]`

### Test 12: Browser Compatibility
**Objective**: Verify cross-browser support

**Chrome/Edge**:
1. Test all annotation features
2. ✅ **Expected**: All tools work smoothly

**Firefox**:
1. Test all annotation features
2. ✅ **Expected**: All tools work (may have slight rendering differences)

**Safari** (if available):
1. Test all annotation features
2. ✅ **Expected**: All tools work

### Test 13: Without Screen Share
**Objective**: Verify annotation button only shows when sharing

1. Join room without screen sharing
2. ✅ **Expected**: "Annotate" button NOT visible
3. Click where "Annotate" button would be
4. ✅ **Expected**: Nothing happens (button truly hidden)

### Test 14: Rapid Drawing
**Objective**: Verify performance with many annotations

1. Start annotating with pen tool
2. Draw rapidly and continuously for 30 seconds
3. ✅ **Expected**: Drawing follows mouse smoothly
4. ✅ **Expected**: No lag or stuttering
5. ✅ **Expected**: Remote viewers see smooth animations

### Test 15: Network Interruption Recovery
**Objective**: Verify annotation recovery after disconnect

1. **Browser 1**: Start annotating
2. **Browser 2**: Disconnect internet briefly (or close/reopen tab)
3. **Browser 2**: Reconnect/rejoin room
4. **Browser 1**: Draw new annotations
5. ✅ **Expected (Browser 2)**: New annotations appear (old ones may be lost)

## Edge Cases & Error Handling

### Edge Case 1: Click Annotate Without Screen Share
**Steps**:
1. Try to access annotation mode without sharing screen
2. ✅ **Expected**: Button not visible OR alert "Start screen sharing first"

### Edge Case 2: Canvas Resizing
**Steps**:
1. Start annotating
2. Resize browser window
3. Continue drawing
4. ✅ **Expected**: Annotations may shift but no crashes
5. ✅ **Recommendation**: Refresh if annotations appear misaligned

### Edge Case 3: Multiple Tool Switches
**Steps**:
1. Rapidly switch between tools while drawing
2. ✅ **Expected**: Tool changes immediately, no lag

### Edge Case 4: Maximum Annotations
**Steps**:
1. Draw 100+ annotation objects
2. ✅ **Expected**: Performance may degrade but no crashes
3. Click "Clear All"
4. ✅ **Expected**: All clear immediately, performance restored

## Performance Benchmarks

### Expected Performance:
- **Drawing Latency**: < 50ms (local)
- **Network Sync**: < 200ms (LAN), < 500ms (WAN)
- **Canvas Redraw**: < 16ms (60 FPS)
- **Tool Switch**: < 10ms
- **Clear All**: < 50ms

### Monitor:
- Browser CPU usage (should stay < 50% with 100 annotations)
- Memory usage (should not exceed 200MB for annotations)
- Network traffic (annotation events should be < 1KB each)

## Known Issues Checklist
During testing, mark if you encounter:

- [ ] Annotations offset from mouse cursor
- [ ] Remote annotations delayed > 1 second
- [ ] Canvas not clearing properly
- [ ] Toolbar not appearing
- [ ] Tools not switching
- [ ] Colors not applying
- [ ] Size slider not working
- [ ] Clear button not working
- [ ] Memory leaks after extended use
- [ ] WebSocket disconnections
- [ ] Browser crashes

## Success Criteria
All tests should pass with ✅ for feature to be considered complete and ready for production.

**Current Status**: 
- Backend: ✅ Handlers implemented
- Frontend: ✅ Components created
- Integration: ✅ WebSocket connected
- TypeScript: ✅ No compilation errors
- Testing: ⏳ Pending multi-user tests

## Next Steps After Testing
1. Document any bugs found
2. Fix critical issues
3. Implement enhancements (undo/redo, text tool)
4. Add touch support for mobile
5. Performance optimization if needed
6. User feedback collection
