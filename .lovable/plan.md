
# Plan: Auto-populate PV Panel Configuration from Simulation

## Overview

Replace the manual PV Panel Configuration dialog in the PV Layout tool with an auto-populated configuration that reads the solar module settings from the Simulation tab. The user has already configured panel dimensions and wattage in the Simulation page, so the PV Layout should use those values automatically.

## Current State

**PV Layout Tool:**
- Has a "Panel Config" button that opens `PVConfigModal`
- Allows manual entry of Width (m), Length (m), and Wattage (Wp)
- Uses `DEFAULT_PV_PANEL_CONFIG` as fallback (1.134m × 2.278m, 550W)

**Simulation Tab:**
- Stores `inverterConfig` in `project_simulations.results_json`
- Contains `selectedModuleId` (preset ID or "custom")
- Contains `customModule` object with `width_m`, `length_m`, `power_wp`, etc.

## Solution

Fetch the latest simulation's `inverterConfig` on mount and use it to populate the `pvPanelConfig` state automatically. The dialog changes from a manual entry form to an **informational display** showing the current configuration sourced from the Simulation tab.

## Data Flow

```text
project_simulations table
         |
         v
   results_json.inverterConfig
         |
         +-- selectedModuleId (preset or "custom")
         +-- customModule (if custom)
         |
         v
   [Resolve module from presets or custom]
         |
         v
   PVPanelConfig {
     width: module.width_m,
     length: module.length_m,
     wattage: module.power_wp
   }
         |
         v
   FloorPlanMarkup (pvPanelConfig state)
         |
         v
   Canvas (panel rendering)
```

## File Changes

### 1. Modify `src/components/floor-plan/FloorPlanMarkup.tsx`

Add logic to fetch the latest simulation's module configuration:

- On mount, fetch from `project_simulations` table
- Extract `inverterConfig` from `results_json`
- Resolve the module (either from presets or custom module)
- Convert to `PVPanelConfig` format and set state
- If no simulation exists, use `DEFAULT_PV_PANEL_CONFIG`

**Changes:**
- Add fetch for `project_simulations.results_json`
- Import `getModulePresetById` and `getDefaultModulePreset` from `SolarModulePresets.ts`
- Populate `pvPanelConfig` from simulation data on initial load
- Remove the ability to manually override (or make it read-only display)

### 2. Modify `src/components/floor-plan/components/PVConfigModal.tsx`

Transform from an editable form to an **informational display**:

- Show the current panel configuration (Width, Length, Wattage, Area, Power Density)
- Display the module name/source (e.g., "Custom Module" or "JA Solar 545W")
- Add a note directing users to the Simulation tab if they need to change values
- Change the action button from "Save Configuration" to "Close" or "OK"

**UI Design:**
```text
+-----------------------------------------------------------+
|  PV Panel Configuration                              [X]  |
+-----------------------------------------------------------+
|                                                           |
|  Module: Custom Module                                    |
|  Source: Simulation Tab Configuration                     |
|                                                           |
|  +-------------------------+  +-------------------------+ |
|  |  Width                  |  |  Length                 | |
|  |  1.134 m                |  |  2.278 m                | |
|  +-------------------------+  +-------------------------+ |
|                                                           |
|  +-------------------------+                              |
|  |  Wattage                |                              |
|  |  615 Wp                 |                              |
|  +-------------------------+                              |
|                                                           |
|  +-------------------------------------------------------+|
|  |  Panel Area: 2.583 m²                                 ||
|  |  Power Density: 238.1 W/m²                            ||
|  +-------------------------------------------------------+|
|                                                           |
|  [Info icon] To change panel specs, go to the Simulation  |
|  tab and update the Solar Module configuration.          |
|                                                           |
|                                        [ OK ]             |
|                                                           |
+-----------------------------------------------------------+
```

### 3. Update `src/components/floor-plan/components/Toolbar.tsx`

- Update the "Panel Config" button to show "View Panel Config" or keep as is
- The button now opens an informational modal instead of an edit modal
- Could add a badge/indicator showing the currently loaded module name

## Technical Details

### Fetching Simulation Config (in FloorPlanMarkup.tsx)

```typescript
// In the existing useEffect that loads layout
const { data: simData } = await supabase
  .from('project_simulations')
  .select('results_json')
  .eq('project_id', projectId)
  .order('updated_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (simData?.results_json) {
  const resultsJson = simData.results_json as any;
  const inverterConfig = resultsJson.inverterConfig;
  
  if (inverterConfig) {
    let module: SolarModulePreset;
    
    if (inverterConfig.selectedModuleId === "custom" && inverterConfig.customModule) {
      module = inverterConfig.customModule;
    } else {
      module = getModulePresetById(inverterConfig.selectedModuleId) || getDefaultModulePreset();
    }
    
    setPvPanelConfig({
      width: module.width_m,
      length: module.length_m,
      wattage: module.power_wp,
    });
  }
}
```

### Updated PVConfigModal Props

```typescript
interface PVConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: PVPanelConfig | null;
  moduleName?: string;  // New: display module name
}
```

## Edge Cases

1. **No simulation exists**: Fall back to `DEFAULT_PV_PANEL_CONFIG`
2. **Invalid module ID**: Use `getDefaultModulePreset()` as fallback
3. **Layout already has saved `pv_config`**: Prefer simulation config (fresh source of truth)
4. **User navigates between tabs**: Reload config when tab becomes active (optional enhancement)

## Benefits

1. **Single source of truth**: Panel specs are defined once in Simulation, used everywhere
2. **Reduced user friction**: No need to re-enter the same data in multiple places
3. **Consistency**: PV Layout panels match exactly what was configured in simulation
4. **Clear data flow**: Users understand that Simulation is the master configuration

## Implementation Steps

1. Update `FloorPlanMarkup.tsx` to fetch simulation config on mount
2. Refactor `PVConfigModal.tsx` to be informational (read-only)
3. Update Toolbar button text/behavior if needed
4. Test with both preset modules and custom modules
5. Test fallback when no simulation exists
