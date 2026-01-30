
# Placement Options Popup & Toolbar Updates

## Overview
This plan addresses four key issues with the current implementation:
1. Placement options should appear in a popup modal (like the PVArrayModal), not inline in the toolbar
2. Add a separator line between "Plant Setup" and "Roof Masks" sections
3. Remove the copy button from Solar Module and implement Ctrl/Cmd+C keyboard shortcut for copying selected items
4. Ensure all equipment and materials have ghost previews (except DC and AC cables)

---

## Changes Summary

### 1. Create PlacementOptionsModal Component
Create a new modal component similar to PVArrayModal that displays placement options before placing equipment or materials:
- Orientation (Portrait/Landscape)
- Minimum Spacing (in meters)
- Item dimensions summary
- "Ready to Place" button

This modal will be shown when selecting:
- Inverter tool
- Walkway tool  
- Cable Tray tool
- DC Combiner tool
- AC Disconnect tool
- Main Board tool

### 2. Toolbar UI Updates
- Add `<Separator className="my-2" />` between Plant Setup and Roof Masks sections
- Remove the `copyButton` prop from Solar Module tool button
- Remove the `copyButton` prop from Roof Mask tool button
- Remove inline "Placement Options" section from toolbar (move to modal)

### 3. Keyboard Copy Functionality
Add Ctrl/Cmd+C keyboard shortcut handling:
- When an item is selected (PV Array, Roof Mask, Equipment, Walkway, Cable Tray)
- Pressing Ctrl+C (Windows) or Cmd+C (Mac) triggers copy mode
- This copies the item configuration and switches to placement mode

### 4. Ghost Previews for All Equipment/Materials
Ensure these items show ghost previews during placement (already partially implemented):
- Inverter (already has ghost)
- DC Combiner (already has ghost)
- AC Disconnect (already has ghost)
- Main Board (already has ghost)
- Walkway (already has ghost)
- Cable Tray (already has ghost)

DC Cable and AC Cable are line tools (drawn point-by-point), so they don't need ghost previews.

---

## Technical Implementation

### File: `src/components/floor-plan/components/PlacementOptionsModal.tsx` (NEW)

Create a modal for configuring placement options before placing equipment/materials:

```typescript
interface PlacementOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'inverter' | 'walkway' | 'cable_tray' | 'dc_combiner' | 'ac_disconnect' | 'main_board';
  itemName: string;
  defaultOrientation?: 'portrait' | 'landscape';
  defaultMinSpacing?: number;
  dimensions?: { width: number; height: number };
  onConfirm: (config: { orientation: 'portrait' | 'landscape'; minSpacing: number }) => void;
}
```

Features:
- Portrait/Landscape orientation radio buttons
- Minimum spacing input (default 0.3m)
- Item dimensions display
- "Ready to Place" and "Cancel" buttons

### File: `src/components/floor-plan/components/Toolbar.tsx`

**Changes:**
1. Add Separator between Plant Setup and Roof Masks:
```typescript
// After Plant Setup section closing tag
<Separator className="my-2" />

// Then Roof Masks section
<CollapsibleSection ...>
```

2. Remove copyButton from Solar Module:
```typescript
<ToolButton
  icon={Sun}
  label="Solar Module"
  isActive={activeTool === Tool.PV_ARRAY}
  onClick={() => setActiveTool(Tool.PV_ARRAY)}
  disabled={!scaleSet || !pvConfigured}
  // Remove copyButton prop entirely
/>
```

3. Remove copyButton from Roof Mask:
```typescript
<ToolButton
  icon={Layers}
  label="Roof Mask"
  isActive={activeTool === Tool.ROOF_MASK}
  onClick={() => setActiveTool(Tool.ROOF_MASK)}
  disabled={!scaleSet}
  // Remove copyButton prop entirely
/>
```

4. Remove inline Placement Options section (lines 511-594) - this will be moved to the modal

### File: `src/components/floor-plan/FloorPlanMarkup.tsx`

**Changes:**
1. Add state for PlacementOptionsModal:
```typescript
const [isPlacementOptionsModalOpen, setIsPlacementOptionsModalOpen] = useState(false);
const [placementOptionsItemType, setPlacementOptionsItemType] = useState<string | null>(null);
```

2. Modify tool selection to open modal for equipment/materials:
```typescript
const handleToolSelect = (tool: Tool) => {
  const equipmentTools = [
    Tool.PLACE_INVERTER, 
    Tool.PLACE_WALKWAY, 
    Tool.PLACE_CABLE_TRAY,
    Tool.PLACE_DC_COMBINER,
    Tool.PLACE_AC_DISCONNECT,
    Tool.PLACE_MAIN_BOARD,
  ];
  
  if (equipmentTools.includes(tool)) {
    setPlacementOptionsItemType(tool);
    setIsPlacementOptionsModalOpen(true);
  } else {
    setActiveTool(tool);
  }
};
```

3. Handle modal confirmation to set placement config and activate tool

4. Add keyboard shortcut handler for Ctrl/Cmd+C:
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedItemId) {
      e.preventDefault();
      // Find the selected item and trigger copy mode
      const selectedPvArray = pvArrays.find(a => a.id === selectedItemId);
      if (selectedPvArray) {
        // Copy PV array configuration
        handleCopyPvArray(selectedPvArray);
        return;
      }
      const selectedRoofMask = roofMasks.find(m => m.id === selectedItemId);
      if (selectedRoofMask) {
        handleCopyRoofMask(selectedRoofMask);
        return;
      }
      // Add similar logic for equipment, walkways, cable trays
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedItemId, pvArrays, roofMasks, equipment, placedWalkways, placedCableTrays]);
```

### File: `src/components/floor-plan/types.ts`

Remove `COPY_ROOF_MASK` and `COPY_PV_ARRAY` from the Tool enum since copying will now be handled via keyboard shortcuts:

```typescript
export enum Tool {
  SELECT = 'select',
  PAN = 'pan',
  SCALE = 'scale',
  LINE_DC = 'line_dc',
  LINE_AC = 'line_ac',
  ROOF_MASK = 'roof_mask',
  ROOF_DIRECTION = 'roof_direction',
  PV_ARRAY = 'pv_array',
  // Remove: COPY_ROOF_MASK = 'copy_roof_mask',
  // Remove: COPY_PV_ARRAY = 'copy_pv_array',
  PLACE_INVERTER = 'place_inverter',
  PLACE_DC_COMBINER = 'place_dc_combiner',
  PLACE_AC_DISCONNECT = 'place_ac_disconnect',
  PLACE_MAIN_BOARD = 'place_main_board',
  PLACE_WALKWAY = 'place_walkway',
  PLACE_CABLE_TRAY = 'place_cable_tray',
}
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/floor-plan/components/PlacementOptionsModal.tsx` | Create - New modal component |
| `src/components/floor-plan/components/Toolbar.tsx` | Modify - Add separator, remove copy buttons, remove inline options |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | Modify - Add modal state, tool selection handler, Ctrl+C handler |
| `src/components/floor-plan/types.ts` | Modify - Remove copy tool types |
| `src/components/floor-plan/components/Canvas.tsx` | Modify - Remove references to copy tools |

---

## Implementation Order

1. **Types** - Remove COPY_ROOF_MASK and COPY_PV_ARRAY from Tool enum
2. **PlacementOptionsModal** - Create the new modal component
3. **Toolbar** - Add separator, remove copy buttons, remove inline placement options
4. **FloorPlanMarkup** - Wire up modal, tool selection, and Ctrl+C keyboard shortcut
5. **Canvas** - Update any references to removed copy tools

---

## Visual Changes

**Before (Toolbar):**
```
├── Plant Setup
│   └── ...
├── Roof Masks
│   └── Roof Mask [Copy]
├── Equipment
│   ├── Solar Module [Copy]
│   └── Inverter
└── Materials
    ├── Walkway
    └── (Inline Placement Options)
```

**After (Toolbar):**
```
├── Plant Setup
│   └── ...
─────────────────  ← New separator
├── Roof Masks
│   └── Roof Mask
─────────────────
├── Equipment
│   ├── Solar Module
│   ├── Inverter
│   └── Main Board
─────────────────
└── Materials
    ├── DC Cable
    ├── AC Cable
    ├── DC Combiner
    ├── AC Disconnect
    ├── Walkway
    └── Cable Tray
```

**New Placement Options Modal (opens when selecting equipment/material tools):**
```
┌──────────────────────────────────────┐
│ Place [Item Name]                    │
│ Configure placement options          │
├──────────────────────────────────────┤
│                                      │
│ Orientation                          │
│ ○ Portrait    ○ Landscape            │
│                                      │
│ Minimum Spacing (m)                  │
│ ┌─────────────────────────────┐      │
│ │ 0.3                         │      │
│ └─────────────────────────────┘      │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Size: 0.7m × 0.5m                │ │
│ └──────────────────────────────────┘ │
│                                      │
├──────────────────────────────────────┤
│     [Cancel]       [Ready to Place]  │
└──────────────────────────────────────┘
```

**Copy Functionality:**
- Select any item on canvas (PV Array, Roof Mask, Equipment, Walkway, Cable Tray)
- Press Ctrl+C (Windows) or Cmd+C (Mac)
- System copies the item configuration and enters placement mode
- Status toast: "Copied [Item Type]. Click to place."
