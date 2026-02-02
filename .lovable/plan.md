
# Plan: Add "Align Edges" Tool

## Overview

This plan adds a new **Align Edges** tool that mirrors the Dimension tool workflow but aligns the edges of two objects instead of setting a distance. Object 1 will move so that one of its edges aligns with the corresponding edge of Object 2 (which remains stationary).

## Feature Details

### Workflow
1. User clicks "Align Edges" tool in the Tools section
2. User clicks **Object 1** (the object that will move)
3. User clicks **Object 2** (the stationary reference)
4. A modal appears with alignment options:
   - **Left edges** - Align left edge of Object 1 with left edge of Object 2
   - **Right edges** - Align right edge of Object 1 with right edge of Object 2
   - **Top edges** - Align top edge of Object 1 with top edge of Object 2
   - **Bottom edges** - Align bottom edge of Object 1 with bottom edge of Object 2
5. User selects alignment type and clicks Apply
6. Object 1 moves to align with Object 2

```text
+------------------+     +------------------+     +------------------+
| Click ALIGN      | --> | Click Object 1   | --> | Click Object 2   |
| tool in toolbar  |     | (will move)      |     | (stationary)     |
+------------------+     +------------------+     +------------------+
                                                           |
                                                           v
                                              +------------------------+
                                              | Align Edges Modal      |
                                              | O Left edges           |
                                              | O Right edges          |
                                              | O Top edges            |
                                              | O Bottom edges         |
                                              | [Cancel] [Apply]       |
                                              +------------------------+
                                                           |
                                                           v
                                              Object 1 moves so its
                                              selected edge matches
                                              Object 2's edge
```

## Implementation Details

### 1. Update Tool Enum

Add new tool type in `src/components/floor-plan/types.ts`:

```typescript
export enum Tool {
  // ... existing tools
  DIMENSION = 'dimension',
  ALIGN_EDGES = 'align_edges', // NEW: Align edges of two objects
}
```

### 2. Add Geometry Utility Functions

Add to `src/components/floor-plan/utils/geometry.ts`:

```typescript
export type AlignmentEdge = 'left' | 'right' | 'top' | 'bottom';

/**
 * Get bounding box edges for any object type
 * Returns edge positions in world coordinates
 */
export const getObjectEdges = (
  position: Point,
  dimensions: { width: number; height: number },
  rotation: number
): { left: number; right: number; top: number; bottom: number } => {
  // For rotated objects, we use axis-aligned bounding box
  const angleRad = rotation * Math.PI / 180;
  const cosA = Math.abs(Math.cos(angleRad));
  const sinA = Math.abs(Math.sin(angleRad));
  
  const effectiveWidth = dimensions.width * cosA + dimensions.height * sinA;
  const effectiveHeight = dimensions.width * sinA + dimensions.height * cosA;
  
  return {
    left: position.x - effectiveWidth / 2,
    right: position.x + effectiveWidth / 2,
    top: position.y - effectiveHeight / 2,
    bottom: position.y + effectiveHeight / 2,
  };
};

/**
 * Calculate new position to align Object 1's edge with Object 2's edge
 */
export const calculateAlignedPosition = (
  object1Pos: Point,
  object1Dims: { width: number; height: number },
  object1Rotation: number,
  object2Pos: Point,
  object2Dims: { width: number; height: number },
  object2Rotation: number,
  alignmentEdge: AlignmentEdge
): Point => {
  const edges1 = getObjectEdges(object1Pos, object1Dims, object1Rotation);
  const edges2 = getObjectEdges(object2Pos, object2Dims, object2Rotation);
  
  switch (alignmentEdge) {
    case 'left':
      // Move Object 1 so its left edge matches Object 2's left edge
      const leftOffset = edges2.left - edges1.left;
      return { x: object1Pos.x + leftOffset, y: object1Pos.y };
    case 'right':
      const rightOffset = edges2.right - edges1.right;
      return { x: object1Pos.x + rightOffset, y: object1Pos.y };
    case 'top':
      const topOffset = edges2.top - edges1.top;
      return { x: object1Pos.x, y: object1Pos.y + topOffset };
    case 'bottom':
      const bottomOffset = edges2.bottom - edges1.bottom;
      return { x: object1Pos.x, y: object1Pos.y + bottomOffset };
  }
};
```

### 3. Create AlignEdgesModal Component

New file: `src/components/floor-plan/components/AlignEdgesModal.tsx`

Props:
- `isOpen: boolean`
- `onClose: () => void`
- `object1Label: string`
- `object2Label: string`
- `onConfirm: (edge: AlignmentEdge) => void`

Modal shows:
- Labels for both objects
- Radio buttons for alignment options (Left, Right, Top, Bottom)
- Cancel/Apply buttons

### 4. Add State Management in FloorPlanMarkup

Add new state and handlers in `src/components/floor-plan/FloorPlanMarkup.tsx`:

```typescript
// Align edges tool state (reuses dimension object selection)
const [alignObject1Id, setAlignObject1Id] = useState<string | null>(null);
const [alignObject2Id, setAlignObject2Id] = useState<string | null>(null);
const [isAlignEdgesModalOpen, setIsAlignEdgesModalOpen] = useState(false);

// Get object dimensions by ID
const getObjectDimensions = useCallback((id: string): { width: number; height: number; rotation: number } | null => {
  // Check each object type and return dimensions in pixels
  // ...implementation
}, [pvArrays, equipment, placedWalkways, placedCableTrays, scaleInfo, pvPanelConfig, roofMasks]);

// Handle alignment selection
const handleAlignEdgesObjectClick = useCallback((id: string) => {
  if (!alignObject1Id) {
    setAlignObject1Id(id);
    toast.info('Now click the reference object (stationary)');
  } else if (alignObject1Id !== id) {
    setAlignObject2Id(id);
    setIsAlignEdgesModalOpen(true);
  }
}, [alignObject1Id]);

// Apply edge alignment
const handleAlignEdgesApply = useCallback((edge: AlignmentEdge) => {
  // Calculate new position and update object 1
  // ...implementation
}, [...]);
```

### 5. Update Toolbar

Add new button in the Tools section of `src/components/floor-plan/components/Toolbar.tsx`:

```typescript
<ToolButton
  icon={AlignVerticalJustifyStart} // or similar alignment icon
  label="Align Edges"
  isActive={activeTool === Tool.ALIGN_EDGES}
  onClick={() => setActiveTool(Tool.ALIGN_EDGES)}
  disabled={!scaleSet}
/>

{/* Align edges tool instructions */}
{activeTool === Tool.ALIGN_EDGES && (
  <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
    {!alignObject1Id && !alignObject2Id && (
      <p>Click on the first object (will move)</p>
    )}
    {alignObject1Id && !alignObject2Id && (
      <p className="text-blue-600">Now click the reference object (stationary)</p>
    )}
  </div>
)}
```

### 6. Update Canvas for Align Edges Tool

In `src/components/floor-plan/components/Canvas.tsx`, handle clicks when `Tool.ALIGN_EDGES` is active (similar to dimension tool):

```typescript
if (activeTool === Tool.ALIGN_EDGES) {
  const clickedId = findClickedObjectId(worldPos);
  if (clickedId) {
    onAlignEdgesObjectClick?.(clickedId);
  }
  return;
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/types.ts` | Add `ALIGN_EDGES` to Tool enum |
| `src/components/floor-plan/utils/geometry.ts` | Add `getObjectEdges()`, `calculateAlignedPosition()`, and `AlignmentEdge` type |
| `src/components/floor-plan/components/Toolbar.tsx` | Add "Align Edges" button and instructions in Tools section |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | Add align edges state, handlers, modal integration |
| `src/components/floor-plan/components/Canvas.tsx` | Handle ALIGN_EDGES tool clicks |

## New File

| File | Purpose |
|------|---------|
| `src/components/floor-plan/components/AlignEdgesModal.tsx` | Modal with edge alignment options |

## UI Behavior

### Tools Section (Updated)
- **Copy**: Enabled when item selected, copies and enters placement mode
- **Set Distance**: Activates dimension tool
- **Align Edges**: Activates edge alignment tool (NEW)

### Align Edges Tool Mode
1. **Instruction**: "Click on the first object (will move)"
2. After first click: "Now click the reference object (stationary)"
3. After second click: Modal appears with alignment options
4. User selects Left/Right/Top/Bottom and clicks Apply
5. Object 1 moves, tool returns to Select mode

### Edge Alignment Behavior
- **Left**: Object 1's left edge aligns with Object 2's left edge (horizontal shift)
- **Right**: Object 1's right edge aligns with Object 2's right edge (horizontal shift)
- **Top**: Object 1's top edge aligns with Object 2's top edge (vertical shift)
- **Bottom**: Object 1's bottom edge aligns with Object 2's bottom edge (vertical shift)

## Expected Result

1. New "Align Edges" button appears in Tools section
2. Selecting two objects opens alignment modal
3. User can choose which edges to align
4. Object 1 moves horizontally or vertically to match Object 2's edge
5. Works across all object types (PV Arrays, Equipment, Walkways, Cable Trays)
