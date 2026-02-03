
# Fix: Cable Tray Not Moving "Right to Left" in Set Distance Tool

## Problem Analysis

After extensive analysis of the `calculateNewPositionAtDistance` geometry function, the algorithm appears mathematically correct for all directional cases. However, the user reports that moving objects "from right to left" fails while "left to right" works.

### Potential Root Causes Identified

1. **Numerical Precision Issues**: When objects are very close together, `centerDist` approaches zero, causing the direction vector to become unstable or the fallback (always move RIGHT) to trigger incorrectly.

2. **Edge Offset Calculation**: The weighted edge offset formula `halfWidth * absDx + halfHeight * absDy` may produce incorrect results when objects are nearly aligned on one axis.

3. **Stale Closure in State Check**: The `placedCableTrays.find()` check in `handleDimensionApply` uses the closure value rather than checking inside the updater function.

---

## Solution

### Part 1: Add Numerical Stability to calculateNewPositionAtDistance

**File**: `src/components/floor-plan/utils/geometry.ts`

The current code has a fallback for `centerDist === 0` that always moves Object1 to the RIGHT. This should be enhanced to handle near-zero distances and consider the current relative positions more carefully.

```typescript
export const calculateNewPositionAtDistance = (
  object1Pos: Point,
  object1Dims: { width: number; height: number },
  object1Rotation: number,
  object2Pos: Point,
  object2Dims: { width: number; height: number },
  object2Rotation: number,
  targetDistanceMeters: number,
  scaleRatio: number
): Point => {
  const dx = object1Pos.x - object2Pos.x;
  const dy = object1Pos.y - object2Pos.y;
  const centerDist = Math.hypot(dx, dy);
  
  // Get effective half-dimensions considering rotation
  const edges1 = getObjectEdges(object1Pos, object1Dims, object1Rotation);
  const edges2 = getObjectEdges(object2Pos, object2Dims, object2Rotation);
  
  const halfWidth1 = (edges1.right - edges1.left) / 2;
  const halfHeight1 = (edges1.bottom - edges1.top) / 2;
  const halfWidth2 = (edges2.right - edges2.left) / 2;
  const halfHeight2 = (edges2.bottom - edges2.top) / 2;
  
  // NEW: Use a small epsilon for near-zero detection
  const EPSILON = 0.001; // 1/1000th of a pixel
  
  if (centerDist < EPSILON) {
    // Objects at effectively same position
    // Determine which direction to move based on current edge positions
    const gapX = Math.max(edges1.left - edges2.right, edges2.left - edges1.right);
    const gapY = Math.max(edges1.top - edges2.bottom, edges2.top - edges1.bottom);
    
    // Move along the axis with the larger gap, or default to X
    if (Math.abs(gapY) > Math.abs(gapX)) {
      const signY = gapY >= 0 ? 1 : -1;
      const edgeToEdgeOffset = halfHeight1 + halfHeight2 + (targetDistanceMeters / scaleRatio);
      return {
        x: object2Pos.x,
        y: object2Pos.y + signY * edgeToEdgeOffset,
      };
    } else {
      const signX = gapX >= 0 ? 1 : -1;
      const edgeToEdgeOffset = halfWidth1 + halfWidth2 + (targetDistanceMeters / scaleRatio);
      return {
        x: object2Pos.x + signX * edgeToEdgeOffset,
        y: object2Pos.y,
      };
    }
  }
  
  // Normalize direction
  const unitX = dx / centerDist;
  const unitY = dy / centerDist;
  
  // Calculate edge offsets in direction of movement
  const absDx = Math.abs(unitX);
  const absDy = Math.abs(unitY);
  
  // Weighted average of half-dimensions based on direction
  const edgeOffset1 = halfWidth1 * absDx + halfHeight1 * absDy;
  const edgeOffset2 = halfWidth2 * absDx + halfHeight2 * absDy;
  
  // Target center-to-center distance = edge1 + gap + edge2
  const targetCenterDist = edgeOffset1 + (targetDistanceMeters / scaleRatio) + edgeOffset2;
  
  return {
    x: object2Pos.x + unitX * targetCenterDist,
    y: object2Pos.y + unitY * targetCenterDist,
  };
};
```

### Part 2: Add Console Logging for Debugging

**File**: `src/components/floor-plan/FloorPlanMarkup.tsx`

Add temporary console logs to `handleDimensionApply` to trace the calculation:

```typescript
const handleDimensionApply = useCallback((newDistance: number) => {
  if (!dimensionObject1Id || !dimensionObject2Id || !scaleInfo.ratio) return;
  
  const pos1 = getObjectPosition(dimensionObject1Id);
  const pos2 = getObjectPosition(dimensionObject2Id);
  const dims1 = getObjectDimensions(dimensionObject1Id);
  const dims2 = getObjectDimensions(dimensionObject2Id);
  
  if (!pos1 || !pos2 || !dims1 || !dims2) return;
  
  console.log('[Set Distance] Input:', {
    object1Id: dimensionObject1Id,
    pos1, dims1,
    object2Id: dimensionObject2Id,
    pos2, dims2,
    newDistance,
    scaleRatio: scaleInfo.ratio,
  });
  
  const newPos = calculateNewPositionAtDistance(
    pos1,
    { width: dims1.width, height: dims1.height },
    dims1.rotation,
    pos2,
    { width: dims2.width, height: dims2.height },
    dims2.rotation,
    newDistance,
    scaleInfo.ratio
  );
  
  console.log('[Set Distance] Result:', {
    oldPos: pos1,
    newPos,
    delta: { x: newPos.x - pos1.x, y: newPos.y - pos1.y },
  });
  
  // ... rest of the function
}, [...]);
```

---

## Testing Plan

1. Open the PV Layout editor
2. Place a cable tray to the RIGHT of a PV array
3. Use the "Distance Between" tool to set a smaller distance (e.g., 50mm)
4. Check console logs to verify:
   - `pos1` and `pos2` have correct X values (Object1 should have higher X)
   - `newPos.x` should be SMALLER than `pos1.x` (moving left)
5. Verify the cable tray moves correctly
6. Repeat with cable tray to the LEFT, setting distance to verify movement in both directions

---

## Technical Summary

| File | Change |
|------|--------|
| `src/components/floor-plan/utils/geometry.ts` | Add EPSILON check for near-zero center distance, improve fallback direction logic |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | Add debug logging to trace position calculations (can be removed after fix verification) |

The primary fix addresses numerical edge cases where the center-to-center distance is extremely small, which could cause the direction vector to be undefined or the fallback to always push objects in the positive X direction.
