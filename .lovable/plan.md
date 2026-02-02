
# Fix: Summary Panel Showing Plant Setup Templates Instead of Placed Instances

## Problem Summary

The Summary Panel incorrectly displays Plant Setup templates (walkway/cable tray configurations from the library) as if they were placed instances on the canvas. Your screenshots clearly show:
- **Walkways showing "6m"** when no walkways have been placed
- **Cable Trays showing "9m"** (sum of 3m + 3m + 3m) from the three templates

This happens because the code conflates two distinct concepts:
1. **Plant Setup Templates**: Library of available types (e.g., "Onvlee 76×76", "Onvlee 152×76")
2. **Placed Instances**: Actual items placed on the canvas

## Root Cause

In `src/components/floor-plan/FloorPlanMarkup.tsx` (lines 291-309), when loading a layout:

```typescript
// BUGGY CODE - converts templates to placed instances
placedWalkways: (plantSetup?.walkways?.map(w => ({
  id: w.id,
  configId: w.id,
  name: w.name,
  width: w.width,
  length: w.length,
  position: { x: 0, y: 0 },  // Fake position!
  rotation: 0,
})) || []) as PlacedWalkway[],
```

The code is taking templates and creating "placed" items from them with dummy positions. Additionally, the save function never persists actual placed instances.

## Solution

### 1. Database: Extend plant_setup JSONB Structure

Add `placedWalkways` and `placedCableTrays` keys within the existing `plant_setup` column:

```typescript
// Current structure
plant_setup: {
  solarModules: [...],
  inverters: [...],
  walkways: WalkwayConfig[],      // Templates
  cableTrays: CableTrayConfig[],  // Templates
}

// New structure
plant_setup: {
  solarModules: [...],
  inverters: [...],
  walkways: WalkwayConfig[],      // Templates (unchanged)
  cableTrays: CableTrayConfig[],  // Templates (unchanged)
  placedWalkways: PlacedWalkway[],    // NEW: Actual placed instances
  placedCableTrays: PlacedCableTray[], // NEW: Actual placed instances
}
```

### 2. Fix Loading Logic

Update `loadLayout` in `FloorPlanMarkup.tsx`:

```typescript
// FIXED: Load placed instances separately from templates
const loadedState: DesignState = {
  roofMasks: (data.roof_masks as unknown as RoofMask[]) || [],
  pvArrays: (data.pv_arrays as unknown as any[]) || [],
  equipment: (data.equipment as unknown as any[]) || [],
  lines: (data.cables as unknown as any[]) || [],
  // Load actual placed instances, NOT templates
  placedWalkways: (plantSetup?.placedWalkways || []) as PlacedWalkway[],
  placedCableTrays: (plantSetup?.placedCableTrays || []) as PlacedCableTray[],
};
```

### 3. Fix Saving Logic

Update `saveLayout` to persist placed instances:

```typescript
const layoutData: any = {
  // ... existing fields ...
  plant_setup: {
    ...plantSetupConfig,
    // Include placed instances in plant_setup
    placedWalkways: placedWalkways,
    placedCableTrays: placedCableTrays,
  },
};
```

### 4. Update Type Definition (Optional but Recommended)

Extend `PlantSetupConfig` type to include placed instances:

```typescript
export interface PlantSetupConfig {
  solarModules: SolarModuleConfig[];
  inverters: InverterLayoutConfig[];
  walkways: WalkwayConfig[];        // Templates
  cableTrays: CableTrayConfig[];    // Templates
  placedWalkways?: PlacedWalkway[]; // Placed instances
  placedCableTrays?: PlacedCableTray[]; // Placed instances
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/FloorPlanMarkup.tsx` | Fix `loadLayout` (lines 286-309), fix `saveLayout` (lines 571-583) |
| `src/components/floor-plan/types.ts` | Optionally extend `PlantSetupConfig` interface |

## Expected Result After Fix

- **Summary Panel Metrics Grid**: Shows "0 m" for Walkways and Cable Trays when nothing is placed
- **Collapsible Sections**: Show "No walkways placed" / "No cable trays placed" when empty
- **After Placement**: Only items actually clicked onto the canvas appear in the Summary Panel
- **Plant Setup Modal**: Remains a separate library of templates, unaffected by Summary Panel

## Technical Diagram

```text
+---------------------------+
|      Plant Setup Modal    |  <-- Template Library
|  - Onvlee 76x76           |
|  - Onvlee 152x76          |
|  - Onvlee 304x76          |
+---------------------------+
           |
           v (select template)
+---------------------------+
|      Canvas Click         |  <-- Creates PlacedCableTray instance
+---------------------------+
           |
           v (instance created)
+---------------------------+
|     Summary Panel         |  <-- Shows only placed instances
|  - Cable Trays: 3m        |      (NOT templates)
|    └ Onvlee 76x76 (1x)    |
+---------------------------+
```

No database migration needed - uses existing JSONB column.
