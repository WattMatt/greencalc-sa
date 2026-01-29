

# Fix: Walkways and Cable Trays Showing Default Data

## Problem
The Summary Panel displays walkway and cable tray quantities even when the user hasn't defined or placed any. This happens because:

1. **Default Configuration**: The `defaultPlantSetupConfig` in `types.ts` includes pre-populated default walkways and cable trays
2. **Data Source Confusion**: The Summary Panel reads from `plantSetupConfig.walkways` and `plantSetupConfig.cableTrays`, which are **configuration entries** (equipment specs for the BOM), not actually **placed items on the canvas**

## Root Cause
```typescript
// src/components/floor-plan/types.ts (lines 142-147)
export const defaultPlantSetupConfig: PlantSetupConfig = {
  solarModules: [],
  inverters: [],
  walkways: [{ id: 'default-walkway', name: 'Standard', width: 0.6, length: 10 }],  // ← Default data!
  cableTrays: [{ id: 'default-tray', name: 'Standard', width: 0.3, length: 10 }],   // ← Default data!
};
```

## Solution
Remove the default walkway and cable tray entries so the Plant Setup starts empty - users must explicitly add items.

### File: `src/components/floor-plan/types.ts`

Change the `defaultPlantSetupConfig` to have empty arrays for walkways and cable trays:

```typescript
export const defaultPlantSetupConfig: PlantSetupConfig = {
  solarModules: [],
  inverters: [],
  walkways: [],     // Start empty
  cableTrays: [],   // Start empty
};
```

## Result
After this change:
- The Summary Panel will show **0 m** for Walkways and Cable Trays by default
- The detail dropdowns will show "No walkways defined" and "No cable trays defined"
- Users can add entries via the Plant Setup modal as needed

## Technical Note
This change only affects the **initial state**. Existing layouts that have been saved with walkways/cable trays will continue to load their saved data correctly since the persistence layer restores `plantSetupConfig` from the database.

