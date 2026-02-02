

# Plan: Smart Edge Detection for Align Edges Tool

## Overview

This plan updates the **Edge Align** tool to support two interaction modes:
1. **Interior Click** - Clicking on the interior of an object shows the alignment popup modal (current behavior)
2. **Edge Click** - Clicking directly on an object's edge performs instant alignment without showing the popup

When clicking near an object's edge, the system will detect which edge (left, right, top, or bottom) was clicked and automatically align that edge between the two selected objects.

## Visual Concept

```text
+------------------+
|                  |
|   INTERIOR       |  <- Click here: Shows popup modal
|   (center area)  |
|                  |
+------------------+
    ^
    |
   EDGE            <- Click here: Direct alignment (no popup)
   (near boundary)
```

## Implementation Details

### 1. Add Edge Detection Function to `geometry.ts`

Create a function that determines if a click is near an object's edge and which edge it's closest to:

```typescript
export type DetectedEdge = AlignmentEdge | null;

/**
 * Detect which edge of an object was clicked, if any.
 * Returns null if click is in the interior.
 */
export const detectClickedEdge = (
  clickPos: Point,
  objectPos: Point,
  objectDims: { width: number; height: number },
  objectRotation: number,
  edgeThreshold: number // pixels - how close to edge counts as "on edge"
): DetectedEdge => {
  // Transform click to object's local coordinate space
  const angleRad = -objectRotation * Math.PI / 180;
  const dx = clickPos.x - objectPos.x;
  const dy = clickPos.y - objectPos.y;
  const localX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
  const localY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
  
  const halfW = objectDims.width / 2;
  const halfH = objectDims.height / 2;
  
  // Check if click is within the object bounds
  if (Math.abs(localX) > halfW || Math.abs(localY) > halfH) {
    return null; // Outside object
  }
  
  // Calculate distance from each edge
  const distFromLeft = Math.abs(localX - (-halfW));
  const distFromRight = Math.abs(localX - halfW);
  const distFromTop = Math.abs(localY - (-halfH));
  const distFromBottom = Math.abs(localY - halfH);
  
  const minDist = Math.min(distFromLeft, distFromRight, distFromTop, distFromBottom);
  
  // If minimum distance is within threshold, it's an edge click
  if (minDist <= edgeThreshold) {
    if (minDist === distFromLeft) return 'left';
    if (minDist === distFromRight) return 'right';
    if (minDist === distFromTop) return 'top';
    if (minDist === distFromBottom) return 'bottom';
  }
  
  return null; // Interior click
};
```

### 2. Update Canvas Click Handler

Modify the `handleMouseDown` function in `Canvas.tsx` to detect edge clicks and pass additional information to the parent:

The current callback signature:
```typescript
onAlignEdgesObjectClick?: (id: string) => void;
```

Will be extended to:
```typescript
onAlignEdgesObjectClick?: (id: string, clickedEdge: AlignmentEdge | null) => void;
```

The Canvas will:
1. Detect which object was clicked (current behavior)
2. Determine if the click was on an edge or interior
3. Pass both the object ID and clicked edge (or null for interior) to the parent

### 3. Update FloorPlanMarkup State and Handlers

Add new state to track clicked edges:
```typescript
const [alignEdge1, setAlignEdge1] = useState<AlignmentEdge | null>(null);
const [alignEdge2, setAlignEdge2] = useState<AlignmentEdge | null>(null);
```

Update `handleAlignEdgesObjectClick`:
```typescript
const handleAlignEdgesObjectClick = useCallback((id: string, clickedEdge: AlignmentEdge | null) => {
  if (!alignObject1Id) {
    // First selection
    setAlignObject1Id(id);
    setAlignEdge1(clickedEdge);
    
    if (clickedEdge) {
      toast.info(`Selected ${clickedEdge} edge. Click an edge on the reference object.`);
    } else {
      toast.info('Now click the reference object (stationary)');
    }
  } else if (alignObject1Id !== id) {
    // Second selection
    setAlignObject2Id(id);
    setAlignEdge2(clickedEdge);
    
    // If both clicks were on edges, auto-align without showing modal
    if (alignEdge1 && clickedEdge) {
      // Perform direct alignment using alignEdge1 (the edge to align)
      performDirectEdgeAlign(alignEdge1);
    } else {
      // At least one interior click - show modal
      setIsAlignEdgesModalOpen(true);
    }
  }
}, [alignObject1Id, alignEdge1]);
```

### 4. Add Direct Alignment Function

Create a helper function for immediate edge alignment:
```typescript
const performDirectEdgeAlign = useCallback((alignmentEdge: AlignmentEdge) => {
  // Same logic as handleAlignEdgesApply but called directly
  // ...alignment calculation...
  
  toast.success(`Edges aligned (${alignmentEdge})`);
  
  // Reset state
  setAlignObject1Id(null);
  setAlignObject2Id(null);
  setAlignEdge1(null);
  setAlignEdge2(null);
  setActiveTool(Tool.SELECT);
}, [...dependencies...]);
```

### 5. Visual Edge Highlighting (Optional Enhancement)

Update the highlight drawing to show which edge was selected:
- When an edge is clicked, draw a thicker/different colored line on that specific edge
- This provides visual feedback about which edge will be aligned

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/utils/geometry.ts` | Add `detectClickedEdge` function |
| `src/components/floor-plan/components/Canvas.tsx` | Update click handler to detect edges and pass edge info to callback |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | Add edge state, update handler to support direct alignment |
| `src/components/floor-plan/utils/drawing.ts` | (Optional) Update highlight to show selected edge |

## Edge Detection Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Edge Threshold | ~15-20% of smallest dimension | How close to boundary counts as "edge click" |
| Minimum Threshold | 10 pixels (screen space) | Prevents too-small edge zones on small objects |
| Maximum Threshold | 30 pixels (screen space) | Prevents entire object being "edge" on large objects |

## Expected Behavior

### Scenario 1: Both Edge Clicks (Direct Align)
1. User clicks the **right edge** of Object A → Blue highlight with "1", right edge emphasized
2. User clicks the **right edge** of Object B → Object A moves so its right edge aligns with Object B's right edge
3. No modal shown, alignment happens immediately

### Scenario 2: Mixed Clicks (Show Modal)
1. User clicks the **interior** of Object A → Blue highlight with "1"
2. User clicks the **left edge** of Object B → Modal opens
3. User selects alignment edge in modal → Alignment performed

### Scenario 3: Both Interior Clicks (Current Behavior)
1. User clicks interior of Object A → Blue highlight with "1"
2. User clicks interior of Object B → Modal opens
3. User selects edge → Alignment performed

## Technical Considerations

- Edge threshold should scale with zoom to maintain consistent UX at different zoom levels
- The threshold calculation in screen space ensures consistent click targets regardless of zoom
- When both objects have edge clicks, Object 1's clicked edge is used for alignment (user controls which edge moves to match)

