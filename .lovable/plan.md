

## Summary

This plan fixes two bugs in the PV Layout System Details panel:

1. **DC/AC ratio showing as 0** - When inverters are placed, they don't get a `configId` linking them to the inverter configuration, so the AC capacity lookup returns 0.

2. **Solar module size not syncing with selected simulation** - When a simulation is selected via the dropdown, the `pvPanelConfig` and `plantSetupConfig` are not updated, causing incorrect module dimensions.

---

## Root Cause Analysis

### Issue 1: DC/AC Ratio = 0

```text
getInverterAcCapacity(inv, plantSetupConfig)
  └── if (!inv.configId) return 0   <-- NO configId on placed inverters!
  └── config = plantSetupConfig.inverters.find(i => i.id === inv.configId)
  └── return config?.acCapacity || 0
```

When inverters are placed (Canvas.tsx lines 1414-1419), no `configId` is assigned:

```typescript
setEquipment(prev => [...prev, {
  id: `eq-${Date.now()}`,
  type: eqType,
  position: snapResult.position,
  rotation: placementRotation,
  // MISSING: configId: ??? 
}]);
```

### Issue 2: Module Config Not Synced

When a simulation is selected via the dropdown, `handleSimulationChange` only updates:
- `assignedSimulationId`
- `assignedSimulation` (the simulation data)

It does NOT update:
- `pvPanelConfig` (module dimensions and wattage)
- `plantSetupConfig` (inverter templates)

---

## Solution

### Fix 1: Assign configId When Placing Inverters

Modify the inverter placement logic in Canvas.tsx to assign the default inverter configId:

**File: `src/components/floor-plan/components/Canvas.tsx`**

```typescript
// When placing inverter, find default inverter config from plantSetupConfig
const getDefaultInverterConfigId = (config?: PlantSetupConfig): string | undefined => {
  if (!config?.inverters?.length) return undefined;
  // Find default or use first
  const defaultInv = config.inverters.find(i => i.isDefault);
  return defaultInv?.id || config.inverters[0]?.id;
};

// In click handler for Tool.PLACE_INVERTER:
setEquipment(prev => [...prev, {
  id: `eq-${Date.now()}`,
  type: eqType,
  position: snapResult.position,
  rotation: snapResult.snappedToId ? snapResult.rotation : placementRotation,
  // NEW: Assign configId for inverters
  ...(eqType === EquipmentType.INVERTER && {
    configId: getDefaultInverterConfigId(plantSetupConfig),
  }),
}]);
```

### Fix 2: Sync pvPanelConfig and plantSetupConfig When Simulation Changes

Modify `handleSimulationChange` in FloorPlanMarkup.tsx to also sync the module and inverter configurations:

**File: `src/components/floor-plan/FloorPlanMarkup.tsx`**

```typescript
const handleSimulationChange = useCallback((simulationId: string | null, simulation: any) => {
  setAssignedSimulationId(simulationId);
  
  if (simulation) {
    setAssignedSimulation({
      id: simulation.id,
      name: simulation.name,
      solar_capacity_kwp: simulation.solar_capacity_kwp,
      battery_capacity_kwh: null,
      battery_power_kw: null,
      annual_solar_savings: null,
      roi_percentage: null,
      results_json: simulation.results_json,
    });
    
    // NEW: Sync pvPanelConfig and plantSetupConfig from simulation
    const resultsJson = simulation.results_json as any;
    const inverterConfig = resultsJson?.inverterConfig;
    
    if (inverterConfig) {
      let module: SolarModulePreset;
      if (inverterConfig.selectedModuleId === "custom" && inverterConfig.customModule) {
        module = inverterConfig.customModule;
        setModuleName(inverterConfig.customModule.name || 'Custom Module');
      } else {
        module = getModulePresetById(inverterConfig.selectedModuleId) || getDefaultModulePreset();
        setModuleName(module.name);
      }
      
      setPvPanelConfig({
        width: module.width_m,
        length: module.length_m,
        wattage: module.power_wp,
      });
      
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
        inverters: inverterConfig.inverterSize ? [{
          id: 'sim-inverter',
          name: `${inverterConfig.inverterSize}kW Inverter`,
          acCapacity: inverterConfig.inverterSize,
          count: inverterConfig.inverterCount || 1,
          isDefault: true,
        }] : prev.inverters,
      }));
    }
  } else {
    setAssignedSimulation(null);
  }
  setHasUnsavedChanges(true);
}, []);
```

### Fix 3: Also Sync On Layout Load

When loading a layout with an assigned simulation, the pvPanelConfig should also sync:

**File: `src/components/floor-plan/FloorPlanMarkup.tsx`**

In the `loadLayout` function, after fetching the assigned simulation, sync the config:

```typescript
if (!simError && simData) {
  setAssignedSimulation(simData);
  
  // NEW: Sync pvPanelConfig from loaded simulation
  const resultsJson = simData.results_json as any;
  const inverterConfig = resultsJson?.inverterConfig;
  
  if (inverterConfig) {
    let module: SolarModulePreset;
    if (inverterConfig.selectedModuleId === "custom" && inverterConfig.customModule) {
      module = inverterConfig.customModule;
      setModuleName(inverterConfig.customModule.name || 'Custom Module');
    } else {
      module = getModulePresetById(inverterConfig.selectedModuleId) || getDefaultModulePreset();
      setModuleName(module.name);
    }
    
    setPvPanelConfig({
      width: module.width_m,
      length: module.length_m,
      wattage: module.power_wp,
    });
    
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
      inverters: inverterConfig.inverterSize ? [{
        id: 'sim-inverter',
        name: `${inverterConfig.inverterSize}kW Inverter`,
        acCapacity: inverterConfig.inverterSize,
        count: inverterConfig.inverterCount || 1,
        isDefault: true,
      }] : prev.inverters,
    }));
  }
}
```

---

## Technical Notes

- The `sim-inverter` configId is used consistently across the codebase for simulation-derived inverters
- Existing inverters without a configId will still show DC/AC as 0.00 - this is expected since we cannot retroactively assign them
- Newly placed inverters will automatically use the default inverter from plantSetupConfig
- The config sync happens both on simulation selection AND on layout load
- The "Sync from Simulation" button remains as a manual override option

---

## Files to Modify

1. **`src/components/floor-plan/components/Canvas.tsx`** - Assign configId when placing inverters
2. **`src/components/floor-plan/FloorPlanMarkup.tsx`** - Sync pvPanelConfig and plantSetupConfig when simulation changes and when layout loads

