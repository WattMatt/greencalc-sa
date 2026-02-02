

# Plan: Add "Tools" Dropdown with Copy and Dimension Tool

## Overview

This plan adds a new "Tools" collapsible section in the toolbar with two features:
1. **Copy Tool**: Button that copies the currently selected object and enters placement mode
2. **Dimension Tool**: New tool mode that allows measuring/setting distance between two objects

## Feature Details

### 1. Copy Tool Button
A button in the Tools section that:
- Is enabled only when an item is selected
- When clicked, copies the selected item's configuration and enters placement mode (same behavior as Ctrl+C)
- Works for all object types: PV Arrays, Roof Masks, Equipment, Walkways, Cable Trays

### 2. Dimension Tool (Set Distance Between Objects)

A new tool that allows the user to:
1. Select **Object 1** (the object that will move)
2. Select **Object 2** (the stationary reference object)
3. A popup appears showing the current distance and an input to set the desired distance
4. Object 1 moves along the line connecting the two objects to achieve the specified distance

**Workflow:**
```text
+------------------+     +------------------+     +------------------+
| Click DIMENSION  | --> | Click Object 1   | --> | Click Object 2   |
| tool in toolbar  |     | (will move)      |     | (stationary)     |
+------------------+     +------------------+     +------------------+
                                                           |
                                                           v
                                              +------------------------+
                                              | Set Distance Modal     |
                                              | - Current: 1.5m        |
                                              | - New Distance: [____] |
                                              | [Cancel] [Apply]       |
                                              +------------------------+
                                                           |
                                                           v
                                              Object 1 moves to the
                                              specified distance from
                                              Object 2 (center-to-center)
```

## Implementation

### 1. Update Tool Enum

Add new tool type in `src/components/floor-plan/types.ts`:

```typescript
export enum Tool {
  // ... existing tools
  DIMENSION = 'dimension', // NEW: Set distance between two objects
}
```

### 2. Add Tools Section to Toolbar

Update `src/components/floor-plan/components/Toolbar.tsx`:

- Add new icons: `Copy`, `MoveHorizontal` (for dimension tool)
- Add new section "Tools" after "Materials"
- Add `onCopySelected` prop callback
- Add `onSetDimensionTool` callback

```typescript
// New section in Toolbar
<CollapsibleSection 
  title="Tools"
  isOpen={openSections.tools}
  onToggle={() => toggleSection('tools')}
>
  <ToolButton
    icon={Copy}
    label="Copy"
    isActive={false}
    onClick={onCopySelected}
    disabled={!selectedItemId}
  />
  <ToolButton
    icon={MoveHorizontal}
    label="Set Distance"
    isActive={activeTool === Tool.DIMENSION}
    onClick={() => setActiveTool(Tool.DIMENSION)}
    disabled={!scaleSet}
  />
</CollapsibleSection>
```

### 3. Create SetDistanceModal Component

New file: `src/components/floor-plan/components/SetDistanceModal.tsx`

Props:
- `isOpen: boolean`
- `onClose: () => void`
- `currentDistance: number` (in meters)
- `object1Label: string` (e.g., "PV Array")
- `object2Label: string` (e.g., "Inverter")
- `onConfirm: (newDistance: number) => void`

Modal shows:
- Current distance between objects (center-to-center)
- DimensionInput for new distance
- Preview of the change (optional)
- Cancel/Apply buttons

### 4. Add Dimension Tool State Management

Update `src/components/floor-plan/FloorPlanMarkup.tsx`:

New state:
```typescript
// Dimension tool state
const [dimensionObject1Id, setDimensionObject1Id] = useState<string | null>(null);
const [dimensionObject2Id, setDimensionObject2Id] = useState<string | null>(null);
const [isSetDistanceModalOpen, setIsSetDistanceModalOpen] = useState(false);
const [currentMeasuredDistance, setCurrentMeasuredDistance] = useState(0);
```

New handler:
```typescript
const handleDimensionApply = (newDistance: number) => {
  // Calculate direction vector from object2 to object1
  // Move object1 along that vector to achieve newDistance
  // Update the appropriate state (pvArrays, equipment, placedWalkways, etc.)
};
```

### 5. Handle Dimension Tool Clicks in Canvas

Update `src/components/floor-plan/components/Canvas.tsx`:

When dimension tool is active and user clicks:
1. First click selects Object 1 (highlight it, show instruction)
2. Second click selects Object 2 (highlight both, trigger modal)

Add callbacks:
- `onDimensionObject1Selected: (id: string) => void`
- `onDimensionObject2Selected: (id: string) => void`

### 6. Add Distance Calculation Utility

Add to `src/components/floor-plan/utils/geometry.ts`:

```typescript
/**
 * Calculate center-to-center distance between two objects in meters
 */
export const getObjectCenterDistance = (
  pos1: Point,
  pos2: Point,
  scaleRatio: number
): number => {
  const pixelDistance = distance(pos1, pos2);
  return pixelDistance * scaleRatio;
};

/**
 * Calculate new position for object1 to be at specified distance from object2
 */
export const calculateNewPositionAtDistance = (
  object1Pos: Point,
  object2Pos: Point,
  targetDistanceMeters: number,
  scaleRatio: number
): Point => {
  const dx = object1Pos.x - object2Pos.x;
  const dy = object1Pos.y - object2Pos.y;
  const currentPixelDist = Math.hypot(dx, dy);
  
  if (currentPixelDist === 0) {
    // Objects at same position, move along X axis
    return {
      x: object2Pos.x + targetDistanceMeters / scaleRatio,
      y: object2Pos.y,
    };
  }
  
  const targetPixelDist = targetDistanceMeters / scaleRatio;
  const unitX = dx / currentPixelDist;
  const unitY = dy / currentPixelDist;
  
  return {
    x: object2Pos.x + unitX * targetPixelDist,
    y: object2Pos.y + unitY * targetPixelDist,
  };
};
```

### 7. Add Copy Handler in FloorPlanMarkup

Extract the existing Ctrl+C logic into a reusable function:

```typescript
const handleCopySelected = useCallback(() => {
  if (!selectedItemId) return;
  
  // Check PV array
  const selectedPvArray = pvArrays.find(a => a.id === selectedItemId);
  if (selectedPvArray) {
    // ... existing copy logic
    return;
  }
  
  // ... rest of existing copy logic for other types
}, [selectedItemId, pvArrays, roofMasks, equipment, placedWalkways, placedCableTrays]);
```

Pass this to Toolbar as `onCopySelected` prop.

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/types.ts` | Add `DIMENSION` to Tool enum |
| `src/components/floor-plan/components/Toolbar.tsx` | Add "Tools" section with Copy and Dimension buttons, add new props |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | Add dimension tool state, modal handlers, copy handler, pass new props |
| `src/components/floor-plan/components/Canvas.tsx` | Handle dimension tool clicks for object selection |
| `src/components/floor-plan/utils/geometry.ts` | Add distance calculation utilities |

## New File

| File | Purpose |
|------|---------|
| `src/components/floor-plan/components/SetDistanceModal.tsx` | Modal for setting distance between two objects |

## UI Behavior

### Tools Section in Toolbar
- Located after "Materials" section
- Contains:
  - **Copy**: Enabled when an item is selected. Copies selection and enters placement mode.
  - **Set Distance**: Activates dimension tool mode.

### Dimension Tool Mode
1. **Instruction overlay**: "Click on the first object (will move)"
2. After first click: "Now click on the reference object (stationary)"
3. After second click: Modal appears with distance input
4. On Apply: Object 1 moves, tool returns to Select mode
5. On Cancel: Both selections cleared, tool returns to Select mode

### Visual Feedback
- Object 1 highlighted in one color (e.g., blue)
- Object 2 highlighted in another color (e.g., green)
- Dashed line drawn between centers showing current distance

## Expected Result

1. **Tools section** appears in toolbar after Materials
2. **Copy button** works same as Ctrl+C but via toolbar click
3. **Set Distance button** activates dimension tool
4. User can select two objects and set exact distance between them
5. Object 1 moves to the specified distance from Object 2

