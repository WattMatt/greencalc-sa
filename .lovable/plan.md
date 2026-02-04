

# Plan: Snap Cables to Cable Tray Centerline (Continuous Projection)

## Overview

Update the cable snapping behavior so that when placing AC or DC cables near a matching cable tray, the cable endpoint snaps to the **closest point along the entire centerline** of the cable tray - not just the endpoints and center. This creates a smooth, intuitive experience where the cable follows along the tray as you move your mouse.

## Current Behavior (Problem)

Looking at `getCableTraySnapPoints()` (lines 1007-1042) and its usage in `snapCablePointToTarget()` (lines 1115-1130):

- Currently returns exactly 3 discrete points: left endpoint, center, right endpoint
- Cable snapping finds the closest of these 3 fixed points
- Result: Cables "jump" between these 3 positions instead of smoothly tracking along the tray

## Desired Behavior

- When mouse is near a cable tray, project the mouse position perpendicularly onto the tray's centerline
- The projected point can be anywhere along the centerline (clamped to endpoints)
- Cable endpoint smoothly follows the tray as you move the mouse along it

## Implementation

### File: `src/components/floor-plan/utils/geometry.ts`

#### 1. Add New Helper Function: `getClosestPointOnCableTray()`

This function calculates the perpendicular projection of a point onto a cable tray's centerline:

```typescript
/**
 * Get the closest point on a cable tray's centerline to a given position.
 * Uses perpendicular projection clamped to the tray's endpoints.
 */
export const getClosestPointOnCableTray = (
  mousePos: Point,
  tray: PlacedCableTray,
  scaleInfo: ScaleInfo
): { point: Point; distanceToLine: number } | null => {
  if (!scaleInfo.ratio) return null;
  
  // Get tray length in pixels
  const lengthPx = tray.length / scaleInfo.ratio;
  const halfLength = lengthPx / 2;
  
  // Apply rotation to get world positions of endpoints
  const angleRad = tray.rotation * Math.PI / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);
  
  // Calculate the two endpoints of the tray's centerline
  const endpoint1: Point = {
    x: tray.position.x - halfLength * cosA,
    y: tray.position.y - halfLength * sinA,
  };
  
  const endpoint2: Point = {
    x: tray.position.x + halfLength * cosA,
    y: tray.position.y + halfLength * sinA,
  };
  
  // Vector from endpoint1 to endpoint2
  const dx = endpoint2.x - endpoint1.x;
  const dy = endpoint2.y - endpoint1.y;
  const lengthSq = dx * dx + dy * dy;
  
  if (lengthSq === 0) {
    // Degenerate case: tray is a point
    return { 
      point: tray.position, 
      distanceToLine: distance(mousePos, tray.position) 
    };
  }
  
  // Calculate projection parameter t (clamped to 0-1 to stay on segment)
  const t = Math.max(0, Math.min(1, 
    ((mousePos.x - endpoint1.x) * dx + (mousePos.y - endpoint1.y) * dy) / lengthSq
  ));
  
  // Calculate the projected point on the centerline
  const projectedPoint: Point = {
    x: endpoint1.x + t * dx,
    y: endpoint1.y + t * dy,
  };
  
  // Calculate perpendicular distance from mouse to the centerline
  const distanceToLine = distance(mousePos, projectedPoint);
  
  return { point: projectedPoint, distanceToLine };
};
```

#### 2. Update `snapCablePointToTarget()` Cable Tray Handling

Replace the discrete point logic with continuous projection:

**Current code (lines 1115-1130):**
```typescript
// Cable trays of matching type are valid snap targets
if (placedCableTrays) {
  for (const tray of placedCableTrays) {
    if (tray.cableType === cableType) {
      const traySnapPoints = getCableTraySnapPoints(tray, scaleInfo);
      for (let i = 0; i < traySnapPoints.length; i++) {
        targets.push({
          id: `${tray.id}_snap_${i}`,
          position: traySnapPoints[i],
          type: 'cableTray',
          trayId: tray.id,
        });
      }
    }
  }
}
```

**New code:**
```typescript
// Cable trays of matching type - use centerline projection
if (placedCableTrays) {
  for (const tray of placedCableTrays) {
    if (tray.cableType === cableType) {
      // Project mouse position onto the tray's centerline
      const projection = getClosestPointOnCableTray(mousePos, tray, scaleInfo);
      if (projection) {
        targets.push({
          id: tray.id,
          position: projection.point,
          type: 'cableTray',
          trayId: tray.id,
          // Store distance for later threshold check
          _distanceToLine: projection.distanceToLine,
        });
      }
    }
  }
}
```

#### 3. Update Snap Threshold Logic for Cable Trays

Since cable trays are linear objects, the distance check should use the perpendicular distance to the centerline, not the distance to the projected point:

```typescript
// In the target finding loop, handle cable trays specially
for (const target of targets) {
  let distForThreshold: number;
  
  if (target.type === 'cableTray' && (target as any)._distanceToLine !== undefined) {
    // For cable trays, use perpendicular distance to centerline
    distForThreshold = (target as any)._distanceToLine;
  } else {
    // For other targets, use distance to target position
    distForThreshold = distance(mousePos, target.position);
  }
  
  if (distForThreshold < adjustedThreshold && distForThreshold < closestDist) {
    closestDist = distForThreshold;
    closestTarget = target;
  }
}
```

## Technical Flow

```text
Mouse Position (near cable tray)
      │
      ▼
┌─────────────────────────────────────────────────┐
│ For each matching cable tray (AC→AC, DC→DC):    │
│   1. Calculate tray centerline (endpoint1→2)    │
│   2. Project mouse perpendicularly onto line    │
│   3. Clamp to tray endpoints (t ∈ [0,1])        │
│   4. Calculate perpendicular distance           │
│   5. Add projected point as snap target         │
└─────────────────────────────────────────────────┘
      │
      ▼
Compare all targets (equipment, PV, tray projections)
using perpendicular distance for trays
      │
      ▼
Snap cable endpoint to closest valid target
```

## Visual Behavior

**Before (discrete points):**
```
  [●]════════════════[●]════════════════[●]
  ↑                   ↑                   ↑
  Snap here      Snap here          Snap here
  (3 positions only)
```

**After (continuous centerline):**
```
  [═══════════════════════════════════════]
  ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
  Snap anywhere along the centerline
  (infinite positions, tracks mouse smoothly)
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/utils/geometry.ts` | Add `getClosestPointOnCableTray()`, update cable tray handling in `snapCablePointToTarget()` |

## Backward Compatibility

- Equipment and PV array snapping remains completely unchanged
- The existing `getCableTraySnapPoints()` function can remain for potential other uses
- Cables still only snap to cable trays of matching type (AC→AC, DC→DC)

