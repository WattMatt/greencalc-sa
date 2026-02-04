
# Plan: Snap DC Cables to Individual Solar Modules

## Problem
DC cable snapping for PV arrays currently snaps to the center of the entire array group. Users want to route cables from specific modules (e.g., the rightmost module) rather than the group center.

## Current Behavior
- PV arrays are stored with a single `position` (center of the group)
- The `snapCablePointToTarget` function adds this single position as the snap target
- Result: All DC cables snap to the center of the array, regardless of where you click

## Solution
Calculate the position of each individual solar module within the array and use each module's center as a separate snap target. This allows users to snap to any specific module in the array.

---

## Technical Implementation

### File: `src/components/floor-plan/utils/geometry.ts`

**Add a new helper function** to calculate individual module positions within a PV array:

```typescript
/**
 * Get the center positions of all individual modules in a PV array.
 * Returns an array of points representing each module's center.
 */
export const getIndividualModulePositions = (
  array: PVArrayItem,
  pvPanelConfig: PVPanelConfig,
  roofMasks: RoofMask[],
  scaleInfo: ScaleInfo
): Point[] => {
  if (!scaleInfo.ratio) return [];

  const panelIsOnMask = roofMasks.find(mask => isPointInPolygon(array.position, mask.points));
  const pitch = panelIsOnMask ? panelIsOnMask.pitch : 0;
  const pitchRad = pitch * Math.PI / 180;

  let panelW_px = pvPanelConfig.width / scaleInfo.ratio;
  let panelL_px = pvPanelConfig.length / scaleInfo.ratio;
  panelL_px *= Math.cos(pitchRad);

  const arrayPanelW = array.orientation === 'portrait' ? panelW_px : panelL_px;
  const arrayPanelL = array.orientation === 'portrait' ? panelL_px : panelW_px;

  const totalWidth = array.columns * arrayPanelW;
  const totalHeight = array.rows * arrayPanelL;

  const angleRad = array.rotation * Math.PI / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const positions: Point[] = [];

  for (let row = 0; row < array.rows; row++) {
    for (let col = 0; col < array.columns; col++) {
      // Calculate local position (relative to array center)
      const localX = -totalWidth / 2 + (col + 0.5) * arrayPanelW;
      const localY = -totalHeight / 2 + (row + 0.5) * arrayPanelL;

      // Apply rotation and translate to world coordinates
      const worldX = (localX * cosA - localY * sinA) + array.position.x;
      const worldY = (localX * sinA + localY * cosA) + array.position.y;

      positions.push({ x: worldX, y: worldY });
    }
  }

  return positions;
};
```

**Update `snapCablePointToTarget`** (lines 962-971) to use individual module positions instead of the array center:

```typescript
// DC cables can also snap to individual solar modules within PV Arrays
if (cableType === 'dc' && pvPanelConfig) {
  for (const arr of pvArrays) {
    const modulePositions = getIndividualModulePositions(arr, pvPanelConfig, roofMasks, scaleInfo);
    
    for (let i = 0; i < modulePositions.length; i++) {
      targets.push({
        id: `${arr.id}_module_${i}`,
        position: modulePositions[i],
        type: 'pvArray',
        arrayId: arr.id, // Keep reference to parent array for auto-complete logic
      });
    }
  }
}
```

**Update the `CableSnapTarget` interface** to optionally include a parent array ID:

```typescript
interface CableSnapTarget {
  id: string;
  position: Point;
  type: 'equipment' | 'pvArray';
  equipmentType?: EquipmentType;
  arrayId?: string; // Parent PV array ID for module snapping
}
```

**Update return type** to include `arrayId` for auto-complete logic in Canvas.tsx:

```typescript
): { 
  position: Point; 
  snappedToId: string | null; 
  snappedToType: 'equipment' | 'pvArray' | null; 
  equipmentType?: EquipmentType;
  arrayId?: string; // For individual module snapping
}
```

---

### File: `src/components/floor-plan/components/Canvas.tsx`

**Update auto-complete logic** to use `arrayId` for DC cables snapping to individual modules (since the `snappedToId` now includes module index):

The auto-complete check for DC cables already checks `snappedToType === 'pvArray'`, so no changes needed to the logic itself. The snap will complete when clicking any individual module.

---

## Expected Behavior After Change

| Scenario | Before | After |
|----------|--------|-------|
| DC cable snap to 10-module array | Snaps to center of group | Snaps to nearest individual module |
| Click near rightmost module | Snaps to center | Snaps to rightmost module center |
| Click near any specific module | Snaps to center | Snaps to that module's center |

## Visual Result
- Green/red snap indicator will highlight the specific module closest to the cursor
- Cable will connect to the exact module the user clicked, not the group center

---

## Files to Modify

| File | Changes |
|------|---------|
| `geometry.ts` | Add `getIndividualModulePositions` helper; Update snap targets to use individual modules |
| `Canvas.tsx` | No changes needed (existing auto-complete logic handles `pvArray` type) |

## Summary

This change enables DC cables to snap to individual solar modules within a PV array, giving users precise control over cable routing. Instead of always connecting to the center of the array group, cables can now connect to any specific module (corner, edge, or interior).
