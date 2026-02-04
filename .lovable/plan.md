
# Plan: Cable Tray Type Property (AC/DC) with Cable Snapping

## Overview

Add a new property to cable trays that designates them as either "AC Cable Tray" or "DC Cable Tray". This property will determine which type of cables (AC or DC) can be associated with and routed through that cable tray. Cables of the matching type will snap to their corresponding cable trays during placement.

## Current State Analysis

- **PlacedCableTray** interface (types.ts) currently has: `id`, `configId`, `name`, `width`, `length`, `position`, `rotation`, `minSpacing`
- **ObjectConfigModal** has a "Properties" section that is currently grayed out with the message "No editable properties for this object type"
- Cable snapping currently targets: Inverters, Main Boards (AC), and PV Arrays (DC)
- Cable trays are not currently considered as snap targets for cables

## Implementation Steps

### Phase 1: Update Data Types

**File: `src/components/floor-plan/types.ts`**

1. Create a new type for cable tray designation:
```typescript
export type CableTrayType = 'ac' | 'dc';
```

2. Add the `cableType` property to `PlacedCableTray`:
```typescript
export interface PlacedCableTray {
  id: string;
  configId: string;
  name: string;
  width: number;
  length: number;
  position: Point;
  rotation: number;
  minSpacing?: number;
  cableType?: CableTrayType; // NEW: Designates AC or DC cable tray
}
```

3. Optionally add `cableType` to `CableTrayConfig` template as well (for default value when placing).

### Phase 2: Update ObjectConfigModal for Cable Tray Properties

**File: `src/components/floor-plan/components/ObjectConfigModal.tsx`**

1. Add `cableType` to the `ObjectProperties` interface:
```typescript
export interface ObjectProperties {
  length?: number;
  name?: string;
  rows?: number;
  columns?: number;
  orientation?: PanelOrientation;
  cableType?: CableTrayType; // NEW
}
```

2. Update `hasEditableProperties` to return `true` for `cableTray` object type.

3. Update `renderPropertiesContent()` to show a dropdown for cable trays:
```
+----------------------------------+
|  Properties                    V |
+----------------------------------+
|  Cable Type                      |
|  +----------------------------+  |
|  | AC Cable Tray           V  |  |
|  +----------------------------+  |
+----------------------------------+
```

Options will be:
- AC Cable Tray
- DC Cable Tray

4. Add state for `cableType` and include it in `handleApply()`.

### Phase 3: Update FloorPlanMarkup to Handle cableType

**File: `src/components/floor-plan/FloorPlanMarkup.tsx`**

1. Update `handleContextMenuOpen` to extract `cableType` from the selected cable tray(s).

2. Update `handleApplyConfig` to apply the `cableType` property when updating cable trays:
```typescript
case 'cableTray':
  setPlacedCableTrays(prev => prev.map(t =>
    configModalObjectIds.includes(t.id)
      ? { 
          ...t, 
          configId: newConfigId || t.configId,
          cableType: properties?.cableType // Apply cableType from properties
        }
      : t
  ));
  break;
```

### Phase 4: Add Cable Snapping to Cable Trays

**File: `src/components/floor-plan/utils/geometry.ts`**

1. Update `snapCablePointToTarget` function signature to accept `placedCableTrays`:
```typescript
export const snapCablePointToTarget = (
  mousePos: Point,
  cableType: CableType,
  equipment: EquipmentItem[],
  pvArrays: PVArrayItem[],
  pvPanelConfig: PVPanelConfig | null,
  roofMasks: RoofMask[],
  scaleInfo: ScaleInfo,
  viewState: { zoom: number },
  plantSetupConfig?: PlantSetupConfig,
  placedCableTrays?: PlacedCableTray[] // NEW
): ...
```

2. Add cable tray snap target logic:
```typescript
// Cable trays of matching type are valid snap targets
if (placedCableTrays) {
  for (const tray of placedCableTrays) {
    // Only snap if tray type matches cable type
    if (tray.cableType === cableType) {
      // Calculate snap points along the tray (start, center, end)
      const traySnapPoints = getCableTraySnapPoints(tray, scaleInfo);
      for (const point of traySnapPoints) {
        targets.push({
          id: tray.id,
          position: point,
          type: 'cableTray',
        });
      }
    }
  }
}
```

3. Create helper function `getCableTraySnapPoints()` to return snap positions along the cable tray (e.g., endpoints and center of the tray's centerline).

4. Update `CableSnapTarget` interface:
```typescript
interface CableSnapTarget {
  id: string;
  position: Point;
  type: 'equipment' | 'pvArray' | 'cableTray'; // Add 'cableTray'
  equipmentType?: EquipmentType;
  arrayId?: string;
}
```

### Phase 5: Update Canvas to Pass Cable Trays for Snapping

**File: `src/components/floor-plan/components/Canvas.tsx`**

1. Update all calls to `snapCablePointToTarget` to include `placedCableTrays`:
```typescript
const snapResult = snapCablePointToTarget(
  worldPos,
  cableType,
  equipment,
  pvArrays,
  pvPanelConfig,
  roofMasks,
  scaleInfo,
  viewState,
  plantSetupConfig,
  placedCableTrays // NEW parameter
);
```

### Phase 6: Visual Feedback for Cable Tray Type

**File: `src/components/floor-plan/utils/drawing.ts`**

Consider adding visual differentiation for AC vs DC cable trays:
- Different color coding or pattern
- Label overlay showing "AC" or "DC"

This is optional but would improve usability.

## Technical Flow

```text
+----------------+     +------------------+     +-------------------+
| User places    |     | Cable Tray has   |     | When drawing      |
| Cable Tray     | --> | default type or  | --> | cables, snap to   |
|                |     | user sets via    |     | matching tray     |
|                |     | right-click menu |     | type only         |
+----------------+     +------------------+     +-------------------+
                              |
                              v
                    +------------------+
                    | Properties       |
                    | dropdown shows   |
                    | AC/DC selection  |
                    +------------------+
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/types.ts` | Add `CableTrayType`, add `cableType` to `PlacedCableTray` |
| `src/components/floor-plan/components/ObjectConfigModal.tsx` | Add cableType dropdown in Properties section for cable trays |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | Handle cableType in context menu handlers |
| `src/components/floor-plan/utils/geometry.ts` | Update `snapCablePointToTarget` to include cable trays |
| `src/components/floor-plan/components/Canvas.tsx` | Pass cable trays to snap function |
| `src/components/floor-plan/utils/drawing.ts` | (Optional) Visual distinction for AC/DC trays |

## User Experience

1. User places a cable tray on the canvas
2. User right-clicks on the cable tray
3. The "Properties" dropdown is now enabled (no longer grayed out)
4. User expands Properties and sees "Cable Type" dropdown
5. User selects "DC Cable Tray" or "AC Cable Tray"
6. When drawing DC cables, they will snap to DC cable trays
7. When drawing AC cables, they will snap to AC cable trays

## Backward Compatibility

- Existing cable trays without `cableType` will not participate in cable snapping until a type is assigned
- The dropdown will show a placeholder ("Select cable type...") for trays without a type set
- Both single and multi-selection will work for setting the cable type
