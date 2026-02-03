
# Fix: Snapping Triggers From Too Far Away

## Problem Analysis

When placing walkways or cable trays, the snapping functionality is activating regardless of how far the mouse is from existing objects. The ghost preview immediately aligns to the horizontal or vertical axis of distant objects instead of only snapping when near them.

### Root Cause

The `snapMaterialToSpacing` function in `geometry.ts` uses `minSpacingPx` (the desired gap between objects) as the threshold for when snapping should activate:

```typescript
if (!forceAlign && minEdgeDistance >= minSpacingPx) {
  continue;
}
```

This logic says: "Skip this item if the edge distance exceeds the minimum spacing."

The problem is that `minSpacingPx` is the **spacing to enforce** (e.g., 30cm gap between objects), not the **proximity threshold** for when snapping should begin. These are two different concepts:

1. **Proximity threshold**: How close you must be to an object before snapping activates (should be ~50-100 pixels in screen space, or a fixed real-world distance like 0.5-1m)
2. **Minimum spacing**: The gap to maintain between objects once snapping is active

Currently, if `minSpacingPx` is small (30cm = ~30 pixels), objects farther than 30 pixels away won't trigger snapping - which is correct. But if the scale ratio makes `minSpacingPx` larger (e.g., 300 pixels at fine scales), snapping will trigger from very far away.

Additionally, when `forceAlign` is true (Shift held), there is NO distance check at all - every item on the canvas is considered for alignment.

---

## Solution

Introduce a dedicated **snap proximity threshold** that determines when snapping should begin, separate from the minimum spacing value.

### Changes to `src/components/floor-plan/utils/geometry.ts`

**1. Add a proximity threshold constant or parameter:**

```typescript
// Add near the top of the file
const SNAP_PROXIMITY_THRESHOLD_METERS = 1.0; // Only snap when within 1 meter of an object
```

**2. Modify `snapMaterialToSpacing` function:**

```typescript
export const snapMaterialToSpacing = (
  mousePos: Point,
  ghostConfig: { width: number; length: number; rotation: number },
  existingItems: Array<{ id: string; width: number; length: number; position: Point; rotation: number }>,
  scaleInfo: ScaleInfo,
  minSpacingMeters: number,
  forceAlign: boolean = false
): { position: Point; rotation: number; snappedToId: string | null } => {
  if (!scaleInfo.ratio || existingItems.length === 0) {
    return { position: mousePos, rotation: ghostConfig.rotation, snappedToId: null };
  }

  // Proximity threshold: how close (edge-to-edge) before snapping activates
  // Use a fixed real-world distance (1m) rather than the min spacing value
  const proximityThresholdPx = SNAP_PROXIMITY_THRESHOLD_METERS / scaleInfo.ratio;
  
  // Minimum spacing to enforce when snapped
  const effectiveMinSpacing = Math.max(0.01, minSpacingMeters);
  const minSpacingPx = effectiveMinSpacing / scaleInfo.ratio;

  // ... existing dimension calculations ...

  for (const item of existingItems) {
    // ... existing dimension calculations for item ...
    
    // Calculate edge-to-edge distance
    const gapX = Math.max(0, edgeDistX);
    const gapY = Math.max(0, edgeDistY);
    const minEdgeDistance = Math.hypot(gapX, gapY);

    // Skip items outside the proximity threshold
    // For forceAlign (Shift), use a larger threshold but still limit range
    const activeThreshold = forceAlign 
      ? proximityThresholdPx * 3  // 3m range when Shift held
      : proximityThresholdPx;     // 1m range for normal snapping
    
    if (minEdgeDistance > activeThreshold) {
      continue;
    }

    // ... rest of existing snapping logic ...
  }
  // ...
};
```

**3. Apply the same fix to `snapPVArrayToSpacing` and `snapEquipmentToSpacing`:**

Both functions have the same issue with their proximity thresholds.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/floor-plan/utils/geometry.ts` | Add proximity threshold constant; update `snapMaterialToSpacing`, `snapPVArrayToSpacing`, and `snapEquipmentToSpacing` to use proximity threshold instead of min spacing for activation |

---

## Testing Plan

1. Open the PV Layout editor
2. Place a single walkway on the canvas
3. Select the cable tray tool and move the mouse around the canvas
4. **Verify**: The ghost preview should NOT snap to align with the walkway unless you're within approximately 1 meter of it
5. Move the mouse close to the walkway (within 1m edge-to-edge)
6. **Verify**: Snapping activates and aligns the cable tray
7. Hold Shift and move the mouse - snapping should activate from a larger distance (3m) but still not from across the entire canvas
8. Repeat with PV arrays and equipment to verify consistent behavior
