
# Plan: Add Snapping and Copying Functionality for Walkways, Cable Trays, and Inverters

## Problem Summary

The snapping and copying functionality that works for **PV Arrays** is not implemented for **Walkways**, **Cable Trays**, and **Inverters**. Specifically:

1. **Missing Snapping for Ghost Previews**: When placing walkways and cable trays, the ghost preview follows the mouse directly without snapping to existing items
2. **Missing Snapping During Dragging**: When dragging walkways and cable trays, there's no snapping to maintain alignment/spacing with other items
3. **Inverter Snapping Works Partially**: Equipment snapping exists but only snaps to other equipment, not to walkways/cable trays
4. **Copy Skips Placement Options Modal**: When copying walkways/cable trays via Ctrl+C, the placement options modal is bypassed

## Current State Analysis

### What Works (PV Arrays)
- Ghost preview applies `snapPVArrayToSpacing()` to maintain minimum spacing
- Dragging applies the same snapping logic
- Shift key enables force-alignment mode
- Copy (Ctrl+C) enters placement mode with same configuration

### What's Missing (Walkways, Cable Trays)

| Feature | PV Arrays | Walkways | Cable Trays | Inverters |
|---------|-----------|----------|-------------|-----------|
| Ghost Preview Snapping | Yes | **No** | **No** | Yes (equipment only) |
| Drag Snapping | Yes | **No** | **No** | Yes (equipment only) |
| Shift Force-Align | Yes | **No** | **No** | Yes |
| minSpacing from PlacementOptions | Yes | Stored but unused | Stored but unused | Hardcoded 0.3m |

## Solution

### 1. Create Snapping Functions for Materials

Add two new functions to `src/components/floor-plan/utils/geometry.ts`:

```typescript
// Get material dimensions in pixels
export const getMaterialDimensions = (
  item: { width: number; length: number; rotation: number },
  scaleInfo: ScaleInfo
): { width: number; height: number } => { ... }

// Snap walkways and cable trays to each other
export const snapMaterialToSpacing = (
  mousePos: Point,
  ghostConfig: { width: number; length: number; rotation: number },
  existingItems: Array<{ id: string; width: number; length: number; position: Point; rotation: number }>,
  scaleInfo: ScaleInfo,
  minSpacingMeters: number,
  forceAlign: boolean = false
): { position: Point; rotation: number; snappedToId: string | null } => { ... }
```

### 2. Apply Snapping to Ghost Previews

Update `Canvas.tsx` ghost preview rendering (lines 403-429):

**Walkway Ghost Preview (before):**
```typescript
position: mouseWorldPos,
```

**Walkway Ghost Preview (after):**
```typescript
const snapResult = snapMaterialToSpacing(
  mouseWorldPos,
  { width: pendingWalkwayConfig.width, length: pendingWalkwayConfig.length, rotation: placementRotation },
  placedWalkways || [],
  scaleInfo,
  placementMinSpacing,  // From PlacementOptionsModal
  isShiftHeld
);
// Use snapResult.position and snapResult.rotation
```

Same pattern for Cable Tray ghost preview.

### 3. Apply Snapping During Dragging

Update `Canvas.tsx` drag handlers (lines 776-797):

**Walkway Dragging (before):**
```typescript
setPlacedWalkways(prev => prev.map(item => 
  item.id === draggingWalkwayId ? { ...item, position: basePos } : item
));
```

**Walkway Dragging (after):**
```typescript
const draggedWalkway = placedWalkways.find(w => w.id === draggingWalkwayId);
if (draggedWalkway) {
  const otherWalkways = placedWalkways.filter(w => w.id !== draggingWalkwayId);
  const snapResult = snapMaterialToSpacing(
    basePos,
    { width: draggedWalkway.width, length: draggedWalkway.length, rotation: draggedWalkway.rotation },
    otherWalkways,
    scaleInfo,
    placementMinSpacing,
    isShiftHeld
  );
  setPlacedWalkways(prev => prev.map(item => 
    item.id === draggingWalkwayId 
      ? { ...item, position: snapResult.position, rotation: isShiftHeld && snapResult.snappedToId ? snapResult.rotation : item.rotation } 
      : item
  ));
}
```

Same pattern for Cable Tray dragging.

### 4. Apply Snapping During Placement Click

Update `Canvas.tsx` placement handlers (lines 669-694):

**Walkway Placement (before):**
```typescript
position: worldPos,
```

**Walkway Placement (after):**
```typescript
const snapResult = snapMaterialToSpacing(
  worldPos,
  { width: pendingWalkwayConfig.width, length: pendingWalkwayConfig.length, rotation: placementRotation },
  placedWalkways || [],
  scaleInfo,
  placementMinSpacing,
  isShiftHeld
);
// Use snapResult.position and snapResult.rotation
```

Same for Cable Tray placement.

### 5. Pass `placementMinSpacing` to Canvas

Update Canvas props to receive `placementMinSpacing` from `FloorPlanMarkup.tsx`:

```typescript
interface CanvasProps {
  // ... existing props
  placementMinSpacing?: number;  // NEW
}
```

### 6. Fix Copy to Respect minSpacing

The keyboard copy handler (lines 821-841) already copies `minSpacing`, but should ensure `placementMinSpacing` state is also updated:

```typescript
// Already implemented - just verify it's working
const selectedWalkway = placedWalkways.find(w => w.id === selectedItemId);
if (selectedWalkway) {
  setPlacementRotation(selectedWalkway.rotation);
  setPlacementMinSpacing(selectedWalkway.minSpacing ?? 0.3); // Already present
  ...
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/utils/geometry.ts` | Add `getMaterialDimensions()` and `snapMaterialToSpacing()` functions |
| `src/components/floor-plan/components/Canvas.tsx` | Apply snapping to ghost previews, placement clicks, and dragging for walkways/cable trays. Add `placementMinSpacing` prop. |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | Pass `placementMinSpacing` to Canvas component |

## Technical Details

### Snapping Algorithm (Mirror of Equipment Snapping)

The `snapMaterialToSpacing` function will follow the same algorithm as `snapEquipmentToSpacing`:

1. Calculate ghost item dimensions in pixels using width/length and scaleInfo.ratio
2. For each existing item:
   - Calculate center-to-center distance
   - Apply rotation transforms to get effective bounding box
   - Calculate edge-to-edge gap distance
   - If gap < minSpacing (or forceAlign), consider as snap candidate
3. Find closest candidate and compute snap position:
   - **Normal mode**: Enforce minimum spacing, align on dominant axis
   - **Shift mode**: Align axis only, keep mouse distance

### Edge Cases

- **Mixed snapping**: Walkways should snap to other walkways, cable trays should snap to other cable trays (not cross-type for now)
- **Empty state**: When no existing items, return mouse position unchanged
- **No scale**: When scaleInfo.ratio is null, return mouse position unchanged

## Expected Behavior After Fix

1. **Ghost Preview**: Snaps to maintain minSpacing when approaching other items
2. **Shift + Move**: Forces alignment on one axis while maintaining free movement on the other
3. **Placement Click**: Applies same snapping as ghost preview
4. **Dragging**: Applies snapping while dragging existing items
5. **Copy (Ctrl+C)**: Preserves rotation and minSpacing from source item
