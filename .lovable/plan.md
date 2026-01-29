

# Fix: Separate Plant Setup Configuration from Placed Items

## Problem Understanding

The current system conflates two different concepts for Walkways and Cable Trays:

1. **Plant Setup Configuration** (left toolbar) = Templates/definitions of equipment types available to place (e.g., "Standard Walkway - 0.6m wide")
2. **Project Summary** (right panel) = Should show placed instances on the canvas

Currently, both areas read from and modify the same `plantSetupConfig.walkways` and `plantSetupConfig.cableTrays` arrays. When you delete from the Project Summary, it removes the template from Plant Setup.

### How Other Items Work Correctly
- **PV Arrays**: Defined by `pvPanelConfig` (template) → Placed as `pvArrays[]` (instances)
- **Equipment/Inverters**: Placed as `equipment[]` array in `DesignState`
- **Roof Masks**: Placed as `roofMasks[]` array in `DesignState`
- **Cabling**: Placed as `lines[]` array in `DesignState`

### Current Walkway/Cable Tray Issue
- Walkways: Only exist in `plantSetupConfig.walkways[]` (template AND instance combined)
- Cable Trays: Only exist in `plantSetupConfig.cableTrays[]` (template AND instance combined)

## Solution: Add Placed Item Arrays to DesignState

We need to separate templates from placed instances by adding new arrays to track what's actually been placed on the project.

### 1. Update Types (`src/components/floor-plan/types.ts`)

Add new interfaces for placed walkway and cable tray instances:

```typescript
// Placed instance of a walkway on the canvas
export interface PlacedWalkway {
  id: string;
  configId: string;  // Reference to WalkwayConfig template
  name: string;
  width: number;     // meters
  length: number;    // meters (specific to this placement)
  position?: Point;  // Optional canvas position
}

// Placed instance of a cable tray on the canvas
export interface PlacedCableTray {
  id: string;
  configId: string;  // Reference to CableTrayConfig template
  name: string;
  width: number;     // meters
  length: number;    // meters (specific to this placement)
  position?: Point;  // Optional canvas position
}

// Update DesignState to include placed walkways and cable trays
export interface DesignState {
  equipment: EquipmentItem[];
  lines: SupplyLine[];
  roofMasks: RoofMask[];
  pvArrays: PVArrayItem[];
  placedWalkways: PlacedWalkway[];    // NEW
  placedCableTrays: PlacedCableTray[]; // NEW
}
```

### 2. Update Initial State (`src/components/floor-plan/types.ts`)

```typescript
export const initialDesignState: DesignState = {
  equipment: [],
  lines: [],
  roofMasks: [],
  pvArrays: [],
  placedWalkways: [],    // NEW
  placedCableTrays: [],  // NEW
};
```

### 3. Update FloorPlanMarkup.tsx

- Add state setters for placed walkways and cable trays
- Update `handleDeletePlantSetupItem` to delete from `placedWalkways`/`placedCableTrays` instead of `plantSetupConfig`
- Update save/load logic to persist these new arrays

### 4. Update SummaryPanel.tsx

Change the Walkways and Cable Trays sections to read from `placedWalkways` and `placedCableTrays` props instead of `plantSetupConfig.walkways/cableTrays`.

**Summary Card Metrics:**
- Walkways card: Sum of `placedWalkways[].length`
- Cable Trays card: Sum of `placedCableTrays[].length`

**Dropdown Lists:**
- Walkways dropdown: List items from `placedWalkways[]`
- Cable Trays dropdown: List items from `placedCableTrays[]`

### 5. Add "Place" Functionality (Future Enhancement)

To add walkways/cable trays to the project, users will need:
- Select a template from Plant Setup
- Either click to place OR manually add an instance with specific length

For immediate fix, we'll add an "Add to Project" flow that creates a placed instance from a template.

## Data Flow After Fix

```text
Plant Setup Modal                    Project Summary
┌─────────────────────┐              ┌─────────────────────┐
│ Templates (Config)  │              │ Placed Instances    │
├─────────────────────┤              ├─────────────────────┤
│ walkwayConfig[]     │─── Copy ───> │ placedWalkways[]    │
│ cableTrayConfig[]   │              │ placedCableTrays[]  │
└─────────────────────┘              └─────────────────────┘
     (Left toolbar)                       (Right panel)
```

## Files to Modify

1. **`src/components/floor-plan/types.ts`**
   - Add `PlacedWalkway` and `PlacedCableTray` interfaces
   - Update `DesignState` interface
   - Update `initialDesignState`

2. **`src/components/floor-plan/FloorPlanMarkup.tsx`**
   - Add setters for new placed arrays
   - Update delete handler to target placed items
   - Update persistence (save/load) to include new arrays
   - Add handler to add placed instance from template

3. **`src/components/floor-plan/components/SummaryPanel.tsx`**
   - Add new props: `placedWalkways`, `placedCableTrays`
   - Update metrics calculation to use placed arrays
   - Update dropdown lists to show placed items
   - Update delete callback to target placed items

4. **`src/components/floor-plan/components/Toolbar.tsx`** (if needed)
   - Add "Add to Project" action in Plant Setup section

## Migration Consideration

For existing layouts that have walkways/cableTrays in `plantSetupConfig`, the load function should:
- Keep them in config (as templates)
- Optionally migrate them to `placedWalkways`/`placedCableTrays` if they represent actual placements

