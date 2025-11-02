# Annotation Feature Quick Start Guide

## How to Use Annotations

### Step 1: Start Screen Sharing
1. Click the **"Share Screen"** button in the controls bar
2. Select the screen/window you want to share
3. Wait for "You are presenting" badge to appear

### Step 2: Enable Annotations
1. Click the **"Annotate"** button (appears after you start sharing)
2. Annotation toolbar appears at top-right of your screen share
3. The button changes to "Stop Annotating"

### Step 3: Draw on Your Screen
1. Select a tool from the toolbar:
   - **Pen** (✏️) - Freehand drawing
   - **Eraser** (🧹) - Erase drawn content
   - **Line** (─) - Draw straight lines
   - **Rectangle** (□) - Draw rectangles
   - **Circle** (○) - Draw circles

2. Choose a color (6 available):
   - Red, Blue, Green, Yellow, Black, White

3. Adjust brush size with the slider (1-20px)

4. Draw on your screen share:
   - Click and drag to draw
   - Release to finish
   - All participants see your annotations in real-time

### Step 4: Clear Annotations
- Click the **"Clear All"** button (🗑️) in the toolbar to remove all annotations
- This broadcasts the clear to all participants

### Step 5: Stop Annotating
- Click **"Stop Annotating"** button in controls bar, OR
- Click the **X** button on the annotation toolbar

## Tips & Tricks

### For Best Results
- Use **pen** for freehand notes and arrows
- Use **line** for underlines and pointers
- Use **rectangle** to highlight areas
- Use **circle** to draw attention to specific spots
- Adjust **size** based on your screen resolution (3-5px works well for most screens)

### Color Recommendations
- **Red** - Highlight errors or important points
- **Blue** - General notes and annotations
- **Green** - Success or approval indicators
- **Yellow** - Warnings or areas to review
- **Black** - General purpose, high contrast
- **White** - Use on dark backgrounds

### Eraser Usage
- Select **eraser** tool
- Drag over annotations to remove them
- Or use **Clear All** to remove everything at once

## What Participants See

### As a Presenter
- Your screen share with your annotations
- Toolbar to control annotation tools
- Immediate feedback as you draw

### As a Viewer
- Presenter's screen share
- All annotations in real-time as presenter draws
- **Cannot** interact with or add annotations (view-only)
- Annotations disappear when presenter clears them

## Keyboard Shortcuts
*(Currently not implemented, but planned)*
- P - Pen tool
- E - Eraser tool
- L - Line tool
- R - Rectangle tool
- C - Circle tool
- Del - Clear all annotations
- Esc - Stop annotating

## Troubleshooting

### "Start screen sharing first to enable annotations" Alert
**Problem**: You clicked "Annotate" without sharing your screen first  
**Solution**: Click "Share Screen" button first, then click "Annotate"

### Annotations Not Appearing for Remote Users
**Problem**: Remote participants don't see your annotations  
**Solution**: 
1. Check your internet connection
2. Ensure backend WebSocket server is running
3. Ask participants to refresh their browser
4. Check browser console for WebSocket errors

### Canvas Not Matching Screen Size
**Problem**: Drawing appears offset or misaligned  
**Solution**: 
1. Refresh the browser
2. Stop and restart screen sharing
3. Ensure browser window is not zoomed (100% zoom recommended)

### Cannot Draw or Click Tools
**Problem**: Toolbar buttons don't respond  
**Solution**:
1. Ensure you are the one sharing the screen (not a participant)
2. Check that "Annotate" button is active (blue/primary color)
3. Refresh the page and try again

## Feature Limitations

### Current Limitations
- ❌ Text tool UI exists but not fully functional
- ❌ No undo/redo functionality
- ❌ No annotation history
- ❌ Annotations cleared when presenter stops sharing
- ❌ No touch/mobile support yet
- ❌ Only presenter can annotate (not co-hosts)

### Coming Soon
- ✅ Undo/Redo buttons
- ✅ Annotation history
- ✅ Text tool with text input
- ✅ Arrow/pointer tool
- ✅ Touch support for tablets
- ✅ Co-host annotation permissions
- ✅ Save annotations as image

## Technical Notes

### Browser Compatibility
- ✅ Chrome/Edge (Chromium) - Fully supported
- ✅ Firefox - Fully supported
- ✅ Safari - Fully supported
- ❌ Mobile browsers - Not yet tested

### Performance
- Optimized for up to 100 annotation objects
- Canvas redraws efficiently on each update
- WebSocket broadcasts are minimal (only draw data)

### Privacy & Security
- Annotations are NOT saved or recorded
- Annotations exist only during screen share session
- No annotation data sent to external servers
- All communication through secure WebSocket

## Support & Feedback
For issues or feature requests, please check:
- Console logs (F12 → Console) for error messages
- Network tab (F12 → Network) for WebSocket status
- Backend logs for server-side issues

Look for these emojis in console:
- ✏️ - Annotation draw events
- 🧹 - Annotation clear events
- ❌ - Errors
- ✅ - Success messages
