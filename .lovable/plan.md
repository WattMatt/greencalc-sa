
# Plan: Improve Roof Mask Completion UX

## Problem
When drawing a roof mask boundary, users have no indication of how to complete/close the polygon. The current implementation requires a **double-click** to finish, but this is not communicated anywhere in the UI.

## Solution
Implement multiple ways to complete the roof mask drawing with clear visual feedback:

### 1. Add Visual Instructions While Drawing
Show a contextual hint at the bottom of the canvas when the roof mask tool is active and drawing is in progress:
- "Click to add points. **Double-click** or press **Enter** to close. **Escape** to cancel."

### 2. Add Keyboard Shortcuts
- **Enter**: Complete the polygon (if 3+ points)
- **Escape**: Cancel the current drawing

### 3. Add "Close to Start" Auto-Completion
When the user clicks near the starting point (within a threshold), automatically close the polygon.

### 4. Visual Start Point Indicator
Draw a small circle at the first point when drawing, making it clear where to click to close the shape.

---

## Technical Changes

### File: `src/components/floor-plan/components/Canvas.tsx`

1. **Add keyboard event listener** for Enter and Escape keys during drawing
2. **Implement snap-to-start detection**: When clicking within ~15 pixels of the start point, auto-close
3. **Draw start point indicator**: Render a small filled circle at `currentDrawing[0]` while drawing
4. **Add floating instruction overlay**: Display contextual help text when `activeTool === Tool.ROOF_MASK` and `currentDrawing.length > 0`

```text
Approximate Changes:
- Add useEffect for keyboard shortcuts (Enter/Escape)
- Modify handleMouseDown to detect click near start point
- Update render useEffect to draw start point indicator
- Add a small overlay div showing instructions
```

### Constants
- Snap threshold: 15 world units (adjusted for zoom)
- Start point indicator radius: 8 pixels

---

## User Experience After Implementation

1. User selects "Draw Roof Mask" tool
2. Clicks to place first point - sees a small circle indicator
3. Continues clicking to add vertices - sees instruction: "Double-click, Enter to close. Escape to cancel."
4. Can complete by:
   - Double-clicking anywhere
   - Pressing Enter
   - Clicking on/near the start point circle
5. Can cancel by pressing Escape

