

# Plan: Rename "PV Setup" to "Plant Setup" with Extended Configuration

## Overview

Transform the current "PV Setup" section into a comprehensive "Plant Setup" section that allows configuration of multiple types of plant equipment. Each equipment type will support multiple configurations (e.g., different module types across different roof sections, multiple inverter models).

## Plant Setup Components

The new Plant Setup section will include:

1. **Solar Modules** - Panel specifications (loaded from Simulation, editable here)
2. **Inverters** - Inverter specifications (loaded from Simulation, editable here)
3. **Walkways** - Walkway/maintenance path dimensions
4. **Cable Trays** - Cable tray width and specifications

Each component supports **multiple entries** to accommodate different equipment across the plant.

---

## Technical Implementation

### Step 1: Extend Types
**File:** `src/components/floor-plan/types.ts`

Add new types for plant equipment:

```typescript
export interface SolarModuleConfig {
  id: string;
  name: string;
  width: number;      // meters
  length: number;     // meters
  wattage: number;    // Wp
  isDefault?: boolean;
}

export interface InverterLayoutConfig {
  id: string;
  name: string;
  acCapacity: number; // kW
  count: number;
  isDefault?: boolean;
}

export interface WalkwayConfig {
  id: string;
  name: string;
  width: number;      // meters (default 0.6m)
}

export interface CableTrayConfig {
  id: string;
  name: string;
  width: number;      // meters (default 0.3m)
}

export interface PlantSetupConfig {
  solarModules: SolarModuleConfig[];
  inverters: InverterLayoutConfig[];
  walkways: WalkwayConfig[];
  cableTrays: CableTrayConfig[];
}
```

### Step 2: Create Plant Setup Modal
**File:** `src/components/floor-plan/components/PlantSetupModal.tsx` (NEW)

A comprehensive modal with tabs for each equipment type:

```text
+----------------------------------------------+
|   Plant Setup                            [X] |
+----------------------------------------------+
| [Solar Modules] [Inverters] [Walkways] [Cable]|
+----------------------------------------------+
| Solar Modules                                 |
| +-----------------------------------------+  |
| | JA Solar 545W (Default)      [Edit][Del]|  |
| | 1.134m x 2.278m | 545 Wp                |  |
| +-----------------------------------------+  |
| [+ Add Module]                               |
+----------------------------------------------+
|              [Apply]  [Cancel]               |
+----------------------------------------------+
```

Features:
- **Tabs**: Solar Modules, Inverters, Walkways, Cable Trays
- **List View**: Shows configured items with edit/delete actions
- **Add New**: Button to add additional configurations
- **Default Marker**: First item marked as default for array placement
- **Sync from Simulation**: Button to reload values from Simulation tab

### Step 3: Update Toolbar
**File:** `src/components/floor-plan/components/Toolbar.tsx`

Changes:
- Rename section from "PV Setup" to "Plant Setup"
- Replace single "View Panel Config" button with "Configure Plant"
- Show summary badges for each configured type

```tsx
<CollapsibleSection 
  title="Plant Setup"
  isOpen={openSections.plantSetup}
  onToggle={() => toggleSection('plantSetup')}
>
  <Button onClick={onOpenPlantSetup}>
    <Settings className="h-4 w-4 mr-2" />
    <span className="text-xs">Configure Plant</span>
  </Button>
  {/* Summary badges */}
  <div className="flex flex-wrap gap-1 px-1 mt-1">
    <Badge variant="outline" className="text-[10px]">
      {plantSetup.solarModules.length} Modules
    </Badge>
    <Badge variant="outline" className="text-[10px]">
      {plantSetup.inverters.length} Inverters
    </Badge>
  </div>
</CollapsibleSection>
```

### Step 4: Update FloorPlanMarkup State
**File:** `src/components/floor-plan/FloorPlanMarkup.tsx`

Add state for plant setup:

```typescript
const [plantSetupConfig, setPlantSetupConfig] = useState<PlantSetupConfig>({
  solarModules: [],
  inverters: [],
  walkways: [{ id: 'default', name: 'Standard', width: 0.6 }],
  cableTrays: [{ id: 'default', name: 'Standard', width: 0.3 }],
});
```

Load from simulation on mount:

```typescript
// In the existing useEffect that loads project data
if (simData?.results_json?.inverterConfig) {
  const inverterConfig = simData.results_json.inverterConfig;
  
  // Sync solar module
  const module = getModulePresetById(inverterConfig.selectedModuleId) 
    || inverterConfig.customModule 
    || getDefaultModulePreset();
  
  setPlantSetupConfig(prev => ({
    ...prev,
    solarModules: [{
      id: 'sim-module',
      name: module.name,
      width: module.width_m,
      length: module.length_m,
      wattage: module.power_wp,
      isDefault: true,
    }],
    inverters: [{
      id: 'sim-inverter',
      name: `${inverterConfig.inverterSize}kW Inverter`,
      acCapacity: inverterConfig.inverterSize,
      count: inverterConfig.inverterCount,
      isDefault: true,
    }],
  }));
}
```

### Step 5: Persist in Layout Data
**File:** `src/components/floor-plan/FloorPlanMarkup.tsx`

Update save/load to include plant setup:

```typescript
// In handleSave
const layoutData = {
  // ...existing fields
  plant_setup: plantSetupConfig,
};

// In loadLayout
if (data.plant_setup) {
  setPlantSetupConfig(data.plant_setup as PlantSetupConfig);
}
```

---

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `src/components/floor-plan/types.ts` | Modify | Add PlantSetupConfig and related interfaces |
| `src/components/floor-plan/components/PlantSetupModal.tsx` | Create | New modal with tabbed interface for plant configuration |
| `src/components/floor-plan/components/Toolbar.tsx` | Modify | Rename section, update button, add summary badges |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | Modify | Add state, load from simulation, pass props |
| `src/components/floor-plan/constants.ts` | Modify | Add default walkway/cable tray dimensions |

---

## User Experience

1. **Initial State**: Plant Setup auto-loads Solar Module and Inverter settings from the Simulation tab
2. **Editing**: Users can override values locally for the layout tool without affecting the Simulation
3. **Multiple Configs**: Users can add additional modules/inverters for complex sites with mixed equipment
4. **Walkways/Cable Trays**: Pre-configured with industry-standard defaults (0.6m walkway, 0.3m cable tray)
5. **Visual Feedback**: Toolbar shows count badges for each configured equipment type

---

## Data Flow

```text
Simulation Tab (Source of Truth)
         |
         v
    On Layout Load
         |
         v
  Plant Setup Config (Local State)
    - Editable in modal
    - Persisted per layout
         |
         v
  Canvas Drawing Tools
    - Use active module for PV arrays
    - Use walkway width for walkway tool (future)
    - Use cable tray width for tray tool (future)
```

