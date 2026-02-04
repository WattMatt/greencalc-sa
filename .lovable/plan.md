
# Plan: Right-Click Configuration Menu for Canvas Objects

## Overview

Add a right-click context menu system to the PV Layout canvas that allows users to change the configuration/type of selected objects. When right-clicking on objects of the same type (single or multi-selected), a configuration popup will appear allowing the user to switch between configured templates.

## Supported Object Types and Configuration Options

| Object Type | Current Reference | Configuration Change Options |
|-------------|-------------------|------------------------------|
| DC Cables | `thickness` (number) | Switch between DC cable templates (diameter, material) |
| AC Cables | `thickness` (number) | Switch between AC cable templates (diameter, material) |
| Walkways | `configId` (string) | Switch between walkway templates |
| Cable Trays | `configId` (string) | Switch between cable tray templates |
| Inverters | None | Switch between inverter templates (adds `configId`) |
| PV Arrays | None | Switch between solar module templates (adds `moduleConfigId`) |

## Implementation Steps

### Phase 1: Update Data Types

**File: `src/components/floor-plan/types.ts`**

1. Add `configId` to `SupplyLine` interface for cable template reference:
```typescript
export interface SupplyLine {
  id: string;
  name: string;
  type: 'dc' | 'ac';
  points: Point[];
  length: number;
  from?: string;
  to?: string;
  thickness?: number;
  configId?: string;    // NEW: Reference to DCCableConfig or ACCableConfig
  material?: CableMaterial; // NEW: Store material directly
}
```

2. Add `configId` to `EquipmentItem` for inverter template reference:
```typescript
export interface EquipmentItem {
  id: string;
  type: EquipmentType;
  position: Point;
  rotation: number;
  name?: string;
  configId?: string;    // NEW: Reference to InverterLayoutConfig (for Inverters)
}
```

3. Add `moduleConfigId` to `PVArrayItem` for module template reference:
```typescript
export interface PVArrayItem {
  id: string;
  position: Point;
  rows: number;
  columns: number;
  orientation: PanelOrientation;
  rotation: number;
  roofMaskId?: string;
  minSpacing?: number;
  moduleConfigId?: string; // NEW: Reference to SolarModuleConfig
}
```

### Phase 2: Create Context Menu Modal Component

**New File: `src/components/floor-plan/components/ObjectConfigModal.tsx`**

Create a reusable modal for changing object configurations:

```text
+----------------------------------+
|  Change Configuration            |
+----------------------------------+
|  Applying to: 3 DC Cables        |
|                                  |
|  Select Cable Type:              |
|  +----------------------------+  |
|  | (o) 6mm Copper             |  |
|  | ( ) 10mm Copper            |  |
|  | ( ) 16mm Aluminum          |  |
|  +----------------------------+  |
|                                  |
|  [Cancel]              [Apply]   |
+----------------------------------+
```

Props:
- `isOpen`: boolean
- `onClose`: callback
- `objectType`: 'dcCable' | 'acCable' | 'walkway' | 'cableTray' | 'inverter' | 'pvArray'
- `selectedCount`: number
- `currentConfigId`: string | null (for single selection)
- `availableConfigs`: array of config options
- `onApply`: (newConfigId: string) => void

### Phase 3: Add Context Menu Handler to Canvas

**File: `src/components/floor-plan/components/Canvas.tsx`**

1. Add `onContextMenu` event handler to the canvas
2. On right-click:
   - Check if click is on a selectable object (using existing hit-testing logic)
   - If the clicked object is already selected (part of multi-selection), use entire selection
   - If clicked object is not selected, select it and use as single selection
   - Determine the object type(s) of the selection
   - If all selected objects are the same type, trigger context menu callback

3. Add new props to Canvas:
```typescript
onContextMenuOpen?: (
  objectType: 'dcCable' | 'acCable' | 'walkway' | 'cableTray' | 'inverter' | 'pvArray',
  objectIds: string[]
) => void;
```

### Phase 4: Integrate in FloorPlanMarkup

**File: `src/components/floor-plan/FloorPlanMarkup.tsx`**

1. Add state for the configuration modal:
```typescript
const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
const [configModalType, setConfigModalType] = useState<'dcCable' | 'acCable' | 'walkway' | 'cableTray' | 'inverter' | 'pvArray' | null>(null);
const [configModalObjectIds, setConfigModalObjectIds] = useState<string[]>([]);
```

2. Add handler for context menu open:
```typescript
const handleContextMenuOpen = (objectType, objectIds) => {
  setConfigModalType(objectType);
  setConfigModalObjectIds(objectIds);
  setIsConfigModalOpen(true);
};
```

3. Add handler for applying configuration changes:
```typescript
const handleApplyConfig = (newConfigId: string) => {
  switch (configModalType) {
    case 'dcCable':
    case 'acCable':
      // Update lines with new configId, thickness, material
      const cableConfig = configModalType === 'dcCable' 
        ? plantSetupConfig.dcCables.find(c => c.id === newConfigId)
        : plantSetupConfig.acCables.find(c => c.id === newConfigId);
      setLines(prev => prev.map(line => 
        configModalObjectIds.includes(line.id) 
          ? { ...line, configId: newConfigId, thickness: cableConfig?.diameter, material: cableConfig?.material }
          : line
      ));
      break;
    case 'walkway':
      // Update walkways with new configId, name, width
      const walkwayConfig = plantSetupConfig.walkways.find(w => w.id === newConfigId);
      setPlacedWalkways(prev => prev.map(w =>
        configModalObjectIds.includes(w.id)
          ? { ...w, configId: newConfigId, name: walkwayConfig?.name || w.name, width: walkwayConfig?.width || w.width }
          : w
      ));
      break;
    // ... similar for other types
  }
  setIsConfigModalOpen(false);
};
```

4. Pass the context menu handler to Canvas and render the modal.

### Phase 5: Update Cable Creation to Include configId

**File: `src/components/floor-plan/components/Canvas.tsx`**

Update cable creation logic to include the selected cable template:

1. Add new props for selected cable configs:
```typescript
selectedDcCableConfig?: DCCableConfig | null;
selectedAcCableConfig?: ACCableConfig | null;
```

2. Update `newLine` creation to include config details:
```typescript
const newLine: SupplyLine = {
  id: `line-${Date.now()}`,
  name: selectedDcCableConfig?.name || 'DC Cable',
  type: 'dc',
  points: currentDrawing,
  length: calculateLineLength(currentDrawing, scaleInfo.ratio),
  configId: selectedDcCableConfig?.id,
  thickness: selectedDcCableConfig?.diameter,
  material: selectedDcCableConfig?.material,
};
```

## Technical Considerations

1. **Selection Affinity Rule**: When right-clicking:
   - If the clicked object is part of the current selection, operate on entire selection
   - If clicked object is not selected, first select it, then operate on single item

2. **Type Homogeneity Check**: Only show configuration menu if all selected objects are of the same type. If mixed types are selected, show a toast indicating "Please select objects of the same type to change configuration."

3. **Backward Compatibility**: Objects created before this feature will have `configId` as undefined. The system should handle this gracefully by allowing users to assign a configuration.

4. **PV Array Module Changes**: When changing the solar module for PV arrays, the visual dimensions will change based on the new module's width/length. The system should update `pvPanelConfig` accordingly or store per-array module config.

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `src/components/floor-plan/types.ts` | Modify | Add `configId`, `material` to SupplyLine; add `configId` to EquipmentItem; add `moduleConfigId` to PVArrayItem |
| `src/components/floor-plan/components/ObjectConfigModal.tsx` | Create | New modal component for configuration selection |
| `src/components/floor-plan/components/Canvas.tsx` | Modify | Add onContextMenu handler, pass selected cable configs for creation |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | Modify | Add config modal state/handlers, pass callbacks to Canvas, render ObjectConfigModal |

## User Experience Flow

1. User selects one or more objects on the canvas (e.g., 3 DC cables)
2. User right-clicks on one of the selected objects
3. A configuration modal appears showing:
   - "Applying to: 3 DC Cables"
   - Radio button list of available DC cable configurations
   - Current configuration (if all selected have the same) is pre-selected
4. User selects a different configuration
5. User clicks "Apply"
6. All selected cables are updated to use the new configuration (thickness, material, name)
7. Canvas re-renders with updated visual styling (if applicable)
