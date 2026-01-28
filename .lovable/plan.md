

# Plan: Shift-Key 45-Degree Angle Snapping for Line Drawing

## Overview

When drawing lines on the PV Layout canvas (DC cables, AC cables, scale line, or roof mask outlines), holding the Shift key will snap the line segment to the nearest 45-degree angle (0, 45, 90, 135, 180, 225, 270, or 315 degrees).

## How It Works

When the user holds Shift while moving the mouse:
1. Calculate the angle from the last point to the current mouse position
2. Snap to the nearest 45-degree increment
3. Project the mouse position onto that snapped angle line

## Implementation Details

### Step 1: Add Snapping Utility Function
**File:** `src/components/floor-plan/utils/geometry.ts`

Add a new function that takes two points (anchor and target) and returns a snapped point:

```typescript
/**
 * Snap a point to the nearest 45-degree angle from an anchor point
 */
export const snapTo45Degrees = (anchor: Point, target: Point): Point => {
  const dx = target.x - anchor.x;
  const dy = target.y - anchor.y;
  const distance = Math.hypot(dx, dy);
  
  if (distance === 0) return target;
  
  // Get angle in radians, then convert to degrees
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = angleRad * (180 / Math.PI);
  
  // Snap to nearest 45-degree increment
  const snappedDeg = Math.round(angleDeg / 45) * 45;
  const snappedRad = snappedDeg * (Math.PI / 180);
  
  // Return point at same distance but snapped angle
  return {
    x: anchor.x + distance * Math.cos(snappedRad),
    y: anchor.y + distance * Math.sin(snappedRad),
  };
};
```

### Step 2: Track Shift Key State in Canvas
**File:** `src/components/floor-plan/components/Canvas.tsx`

Add state and keyboard event listeners to track when Shift is held:

```typescript
const [isShiftHeld, setIsShiftHeld] = useState(false);

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Shift') setIsShiftHeld(true);
  };
  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') setIsShiftHeld(false);
  };
  
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}, []);
```

### Step 3: Apply Snapping in Mouse Handlers
**File:** `src/components/floor-plan/components/Canvas.tsx`

Modify `handleMouseMove` and `handleMouseDown` to apply snapping when Shift is held:

**In `handleMouseMove`:**
- For line drawing preview: snap `previewPoint` relative to the last point in `currentDrawing`
- For scale line: snap `scaleLine.end` relative to `scaleLine.start`

**In `handleMouseDown`:**
- When adding a new point to `currentDrawing`, snap it if Shift is held

### Affected Tools

The snapping will apply to:
- `Tool.LINE_DC` - DC cable drawing
- `Tool.LINE_AC` - AC cable drawing  
- `Tool.ROOF_MASK` - Roof mask polygon drawing
- `Tool.SCALE` - Scale reference line

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/utils/geometry.ts` | Add `snapTo45Degrees` utility function |
| `src/components/floor-plan/components/Canvas.tsx` | Add Shift key tracking and apply snapping logic to mouse handlers |

## User Experience

- **No Shift held**: Lines draw freely following the cursor
- **Shift held**: Lines snap to 0, 45, 90, 135, 180, 225, 270, or 315 degree angles
- Visual feedback is immediate through the preview line
- Works consistently across all line-drawing tools

