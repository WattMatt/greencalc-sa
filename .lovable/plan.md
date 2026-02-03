

# Fix: Distance Between Tool Not Moving Objects to Correct Position

## Problem Identified

The "Set Distance Between Objects" tool works for some object types but fails for **cable trays and walkways**. The issue is a **double rotation bug** where dimensions are being rotated twice:

1. **First rotation**: `getMaterialDimensions()` applies rotation to calculate the effective bounding box dimensions
2. **Second rotation**: `getObjectEdges()` applies rotation again when calculating edge positions

This causes incorrect edge calculations, resulting in `calculateNewPositionAtDistance()` producing wrong position values.

### Evidence from Code

```text
FloorPlanMarkup.tsx (getObjectDimensions - lines 1094-1105):
─────────────────────────────────────────────────────────────
const dims = getMaterialDimensions(walkway, scaleInfo);  // ← Already rotated!
return { width: dims.width, height: dims.height, rotation: walkway.rotation };
                                                         ↓
getObjectEdges() applies rotation AGAIN → Wrong edges → Wrong position
```

**Compare with correct implementations:**

```text
drawing.ts (findObjectForHighlight - lines 108-112):
────────────────────────────────────────────────────
dimensions: { 
  width: walkway.width / params.scaleInfo.ratio,   // ← Raw dimensions
  height: walkway.length / params.scaleInfo.ratio  // ← No rotation applied
}

useMultiSelection.ts (getItemInfo - lines 119-125):
────────────────────────────────────────────────────
dimensions: { 
  width: walkway.width / scaleInfo.ratio,   // ← Raw dimensions
  height: walkway.length / scaleInfo.ratio  // ← No rotation applied
}
```

---

## Solution

Modify `getObjectDimensions()` in `FloorPlanMarkup.tsx` to return **raw dimensions** for walkways and cable trays, matching the pattern used in `drawing.ts` and `useMultiSelection.ts`.

### File: `src/components/floor-plan/FloorPlanMarkup.tsx`

**Change 1**: Update walkway dimension calculation (lines ~1094-1098)

```typescript
// BEFORE (incorrect - double rotation):
const walkway = placedWalkways.find(w => w.id === id);
if (walkway && scaleInfo.ratio) {
  const dims = getMaterialDimensions(walkway, scaleInfo);
  return { width: dims.width, height: dims.height, rotation: walkway.rotation };
}

// AFTER (correct - raw dimensions):
const walkway = placedWalkways.find(w => w.id === id);
if (walkway && scaleInfo.ratio) {
  return { 
    width: walkway.width / scaleInfo.ratio, 
    height: walkway.length / scaleInfo.ratio, 
    rotation: walkway.rotation 
  };
}
```

**Change 2**: Update cable tray dimension calculation (lines ~1101-1105)

```typescript
// BEFORE (incorrect - double rotation):
const cableTray = placedCableTrays.find(c => c.id === id);
if (cableTray && scaleInfo.ratio) {
  const dims = getMaterialDimensions(cableTray, scaleInfo);
  return { width: dims.width, height: dims.height, rotation: cableTray.rotation };
}

// AFTER (correct - raw dimensions):
const cableTray = placedCableTrays.find(c => c.id === id);
if (cableTray && scaleInfo.ratio) {
  return { 
    width: cableTray.width / scaleInfo.ratio, 
    height: cableTray.length / scaleInfo.ratio, 
    rotation: cableTray.rotation 
  };
}
```

---

## Expected Behavior After Fix

| Object Pair | Distance Tool | Align Edges Tool |
|-------------|---------------|------------------|
| Cable Tray ↔ Cable Tray | Works correctly | Works correctly |
| Walkway ↔ Walkway | Works correctly | Works correctly |
| Solar Module ↔ Solar Module | Works correctly | Works correctly |
| Cable Tray ↔ Walkway | Works correctly | Works correctly |
| Cable Tray ↔ Solar Module | Works correctly | Works correctly |
| Walkway ↔ Solar Module | Works correctly | Works correctly |
| Any ↔ Inverter/Equipment | Works correctly | Works correctly |

---

## Testing Scenarios

1. **Cable Tray to Cable Tray**: Place two cable trays, use Distance Between tool, set distance to 0.5m → verify actual distance is 0.5m
2. **Walkway to Walkway**: Same test with walkways
3. **Cross-type**: Set distance between cable tray and walkway → verify correct positioning
4. **Solar Module to Cable Tray**: Ensure PV arrays work with materials
5. **Rotated Objects**: Test with objects at 45°, 90° rotations to ensure rotation is applied correctly once
6. **Align Edges**: Verify left/right/top/bottom edge alignment works for all object combinations

