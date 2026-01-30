

# Toolbar Reorganization & Placement Configuration Plan

## Overview
This plan reorganizes the PV Layout Toolbar dropdowns, adds new placement tools for walkways and cable trays, and introduces configuration options (orientation and spacing) for inverters, walkways, and cable trays before placement.

---

## Summary of Changes

### 1. Toolbar Dropdown Reorganization
- **Rename** "Roof & Arrays" → "Roof Masks"
- **Rename** "Draw Roof Mask" → "Roof Mask" (remove "Draw" prefix)
- **Move** "Place PV Array" to "Equipment" dropdown, renamed to "Solar Module"
- **Reorder** dropdowns: File → General → Plant Setup → **Roof Masks** → **Equipment** → **Materials**
- **Rename** "Cabling" → "Materials"
- **Move** DC Combiner and AC Disconnect from Equipment to Materials
- **Add** Walkway and Cable Tray tools to "Materials" section

### 2. New Dropdown Structure

**Roof Masks** (was "Roof & Arrays"):
- Roof Mask (with copy button)

**Equipment** (moved above Materials):
- Solar Module (was "Place PV Array", with copy button)
- Inverter
- Main Board

**Materials** (was "Cabling"):
- DC Cable
- AC Cable
- DC Combiner (moved from Equipment)
- AC Disconnect (moved from Equipment)
- Walkway (NEW)
- Cable Tray (NEW)

### 3. New Tool Types
Add two new tool types to the `Tool` enum:
- `PLACE_WALKWAY = 'place_walkway'`
- `PLACE_CABLE_TRAY = 'place_cable_tray'`

### 4. Placement Configuration
When selecting inverter, walkway, or cable tray tools, show inline controls for:
- **Orientation** selector (portrait/landscape)
- **Minimum Spacing** input (in meters, default 0.3m)

### 5. Canvas Updates
- Ghost previews for walkway and cable tray placement
- Snapping/alignment logic for new items
- Placement click handlers

---

## Technical Implementation Details

### File: `src/components/floor-plan/types.ts`

Add new tool types and update interfaces:

```typescript
export enum Tool {
  // ...existing tools...
  PLACE_WALKWAY = 'place_walkway',
  PLACE_CABLE_TRAY = 'place_cable_tray',
}

// Update PlacedWalkway with rotation and spacing
export interface PlacedWalkway {
  id: string;
  configId: string;
  name: string;
  width: number;
  length: number;
  position: Point;
  rotation: number;
  minSpacing?: number;
}

// Update PlacedCableTray with rotation and spacing
export interface PlacedCableTray {
  id: string;
  configId: string;
  name: string;
  width: number;
  length: number;
  position: Point;
  rotation: number;
  minSpacing?: number;
}
```

### File: `src/components/floor-plan/components/Toolbar.tsx`

**Section State Keys Update:**
```typescript
const [openSections, setOpenSections] = useState<Record<string, boolean>>({
  file: true,
  general: false,
  plantSetup: false,
  roofMasks: false,
  equipment: false,
  materials: false,
});
```

**New Section Order and Contents:**

1. **Roof Masks**:
   - Roof Mask (Tool.ROOF_MASK) + copy button

2. **Equipment**:
   - Solar Module (Tool.PV_ARRAY) + copy button
   - Inverter (Tool.PLACE_INVERTER)
   - Main Board (Tool.PLACE_MAIN_BOARD)

3. **Materials**:
   - DC Cable (Tool.LINE_DC)
   - AC Cable (Tool.LINE_AC)
   - DC Combiner (Tool.PLACE_DC_COMBINER)
   - AC Disconnect (Tool.PLACE_AC_DISCONNECT)
   - Walkway (Tool.PLACE_WALKWAY) - NEW
   - Cable Tray (Tool.PLACE_CABLE_TRAY) - NEW

**Configuration Controls:**
Show orientation, spacing, and rotation controls when these tools are active:
- `Tool.PLACE_INVERTER`
- `Tool.PLACE_WALKWAY`
- `Tool.PLACE_CABLE_TRAY`

### File: `src/components/floor-plan/utils/drawing.ts`

Add rendering functions for walkways and cable trays:

```typescript
export function drawWalkway(
  ctx: CanvasRenderingContext2D,
  walkway: PlacedWalkway,
  isSelected: boolean,
  zoom: number,
  scaleInfo: ScaleInfo
) {
  // Draw hatched rectangle for walkway
  // Color: light gray with diagonal stripe pattern
}

export function drawCableTray(
  ctx: CanvasRenderingContext2D,
  tray: PlacedCableTray,
  isSelected: boolean,
  zoom: number,
  scaleInfo: ScaleInfo
) {
  // Draw rectangle with ladder/rail pattern
  // Color: dark gray or metallic appearance
}
```

### File: `src/components/floor-plan/components/Canvas.tsx`

**Mouse Tracking Updates:**
```typescript
const placementTools = [
  Tool.PV_ARRAY,
  Tool.PLACE_INVERTER,
  Tool.PLACE_DC_COMBINER,
  Tool.PLACE_AC_DISCONNECT,
  Tool.PLACE_MAIN_BOARD,
  Tool.PLACE_WALKWAY,
  Tool.PLACE_CABLE_TRAY,
];
```

**Ghost Preview Rendering:**
- Add walkway ghost preview with configured dimensions and rotation
- Add cable tray ghost preview with configured dimensions and rotation
- Apply snapping logic to both

**Placement Handlers:**
- Handle click events for placing walkways (add to placedWalkways array)
- Handle click events for placing cable trays (add to placedCableTrays array)

### File: `src/components/floor-plan/FloorPlanMarkup.tsx`

Wire up new state and pass props to Canvas and Toolbar:
- Pending walkway/cable tray configuration state
- Handlers for adding placed walkways and cable trays
- Pass placedWalkways and placedCableTrays to Canvas for rendering

---

## Visual Changes Summary

```text
Before:                          After:
├── File                         ├── File
├── General                      ├── General
├── Plant Setup                  ├── Plant Setup
├── Roof & Arrays                ├── Roof Masks
│   ├── Draw Roof Mask           │   └── Roof Mask
│   └── Place PV Array           ├── Equipment
├── Cabling                      │   ├── Solar Module
│   ├── DC Cable                 │   ├── Inverter
│   └── AC Cable                 │   └── Main Board
└── Equipment                    └── Materials
    ├── Inverter                     ├── DC Cable
    ├── DC Combiner                  ├── AC Cable
    ├── AC Disconnect                ├── DC Combiner
    └── Main Board                   ├── AC Disconnect
                                     ├── Walkway
                                     └── Cable Tray
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/floor-plan/types.ts` | Modify - Add new tools and update interfaces |
| `src/components/floor-plan/components/Toolbar.tsx` | Modify - Reorganize dropdowns and add config controls |
| `src/components/floor-plan/utils/drawing.ts` | Modify - Add walkway/cable tray rendering |
| `src/components/floor-plan/components/Canvas.tsx` | Modify - Add ghost previews and placement handlers |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | Modify - Wire up new state and props |

---

## Implementation Order

1. **Types** - Add new Tool enum values and update placed item interfaces
2. **Toolbar** - Reorganize dropdowns, rename labels, add inline config controls
3. **Drawing Utils** - Add walkway and cable tray rendering functions
4. **Canvas** - Add ghost previews, snapping, and placement handlers
5. **FloorPlanMarkup** - Wire up state and pass props to child components

