
# Plan: Multi-Selection with Group Operations in PV Layout Editor

## Overview
Add multi-selection capability to the PV Layout canvas, enabling users to select multiple objects and perform group operations including copy (with placement configuration) and alignment (based on group bounding box).

---

## Current Implementation Analysis

### Single Selection Architecture
- `selectedItemId: string | null` - Single selection state in FloorPlanMarkup
- Selection hit-testing in Canvas.tsx checks PV Arrays → Materials → Equipment → Roof Masks
- Copy (`handleCopySelected`) operates on single selected item
- Alignment tools operate between exactly two objects

### Key Files
| File | Role |
|------|------|
| `FloorPlanMarkup.tsx` | Main state management, selection handlers |
| `Canvas.tsx` | Mouse events, hit-testing, rendering |
| `Toolbar.tsx` | Copy button, tool state display |
| `utils/geometry.ts` | Bounding box calculations |
| `utils/drawing.ts` | Rendering selected items |

---

## Technical Design

### 1. Multi-Selection State

Replace single selection with array-based selection:

```typescript
// New state
const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

// Backwards compatibility helper
const selectedItemId = selectedItemIds.size === 1 
  ? Array.from(selectedItemIds)[0] 
  : selectedItemIds.size > 0 ? Array.from(selectedItemIds)[0] : null;
```

### 2. Selection Behavior

| Action | Behavior |
|--------|----------|
| Click object | Clear selection, select clicked object |
| Shift+Click | Toggle object in selection (add/remove) |
| Ctrl+Click | Toggle object in selection (add/remove) |
| Click empty space | Clear selection |
| Drag selection (future) | Box select (optional enhancement) |

### 3. Selection Rendering

Modify `renderAllMarkups` in drawing.ts to:
- Accept `selectedItemIds: Set<string>` instead of `selectedItemId: string | null`
- Render selection highlight for all items in the set
- Render group bounding box when multiple items selected

### 4. Multi-Copy with Placement Configuration

When copying multiple objects of the same type:

**PV Arrays:**
```typescript
// Copy preserves: rows, columns, orientation, minSpacing, rotation
// Enters batch placement mode with relative positions
interface BatchPlacementConfig {
  items: Array<{
    offset: Point; // Relative to group anchor
    config: PVArrayConfig;
    rotation: number;
  }>;
  anchorType: 'center' | 'first'; // Where mouse cursor anchors
}
```

**Materials (Walkways/Cable Trays):**
```typescript
// Copy preserves: width, length, rotation, minSpacing, configId
interface MaterialBatchConfig {
  items: Array<{
    offset: Point;
    rotation: number;
    minSpacing: number;
    configId: string;
    dimensions: { width: number; length: number };
  }>;
}
```

**Mixed Types:**
- Toast warning: "Multi-copy requires same object type"
- Fall back to single item copy (first selected)

### 5. Group Alignment

When aligning a group of selected objects:

1. Calculate **Group Bounding Box**:
```typescript
const getGroupBoundingBox = (
  ids: Set<string>,
  pvArrays, equipment, walkways, cableTrays,
  pvPanelConfig, scaleInfo, roofMasks, plantSetupConfig
): { left: number; right: number; top: number; bottom: number; center: Point }
```

2. **Alignment Modes**:
   - Single object selected → Existing behavior (move object to align with reference)
   - Multiple objects selected → Move entire group, maintaining relative positions

3. **Group Movement**:
```typescript
// Calculate delta from group edge to reference edge
const delta = { x: referenceEdgeX - groupEdgeX, y: 0 }; // for left/right alignment

// Apply delta to all selected objects
selectedItemIds.forEach(id => {
  updateObjectPosition(id, (pos) => ({ x: pos.x + delta.x, y: pos.y + delta.y }));
});
```

### 6. Group Drag

When dragging with multiple items selected:
- All selected items move together
- Maintain relative positions
- Snapping applies to group bounding box (not individual items)

---

## Implementation Files

### Phase 1: Core Selection State

**FloorPlanMarkup.tsx:**
- Replace `selectedItemId` with `selectedItemIds: Set<string>`
- Add `toggleSelection(id: string)` for Shift/Ctrl+click
- Update all handlers that use `selectedItemId`

**Canvas.tsx:**
- Modify `handleMouseDown` for SELECT tool:
  - Without modifier: clear and select single
  - With Shift/Ctrl: toggle selection
- Track all selected items for drag operations
- Group drag: track offset for each selected item

### Phase 2: Group Operations

**FloorPlanMarkup.tsx - `handleCopySelected`:**
```typescript
const handleCopySelected = useCallback(() => {
  if (selectedItemIds.size === 0) return;
  
  const selectedPvArrays = pvArrays.filter(a => selectedItemIds.has(a.id));
  const selectedWalkways = placedWalkways.filter(w => selectedItemIds.has(w.id));
  const selectedCableTrays = placedCableTrays.filter(c => selectedItemIds.has(c.id));
  const selectedEquipment = equipment.filter(e => selectedItemIds.has(e.id));
  
  // Determine dominant type
  const counts = [
    { type: 'pv', items: selectedPvArrays },
    { type: 'walkway', items: selectedWalkways },
    { type: 'cableTray', items: selectedCableTrays },
    { type: 'equipment', items: selectedEquipment },
  ].filter(c => c.items.length > 0);
  
  if (counts.length > 1) {
    toast.warning('Multi-copy requires same object type. Copying first item only.');
    // Fall back to single copy
    return;
  }
  
  if (selectedPvArrays.length > 0) {
    setBatchPvArrayConfig(selectedPvArrays.map(arr => ({
      offset: calculateOffset(arr.position, groupCenter),
      config: { rows: arr.rows, columns: arr.columns, orientation: arr.orientation, minSpacing: arr.minSpacing },
      rotation: arr.rotation,
    })));
    setActiveTool(Tool.PV_ARRAY);
    toast.info(`Copied ${selectedPvArrays.length} PV Arrays. Click to place.`);
  }
  // Similar for other types...
}, [selectedItemIds, pvArrays, placedWalkways, placedCableTrays, equipment]);
```

### Phase 3: Group Alignment

**utils/geometry.ts - New Functions:**
```typescript
export const getGroupBoundingBox = (
  positions: Array<{ position: Point; dimensions: { width: number; height: number }; rotation: number }>
): { left: number; right: number; top: number; bottom: number; center: Point } => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  
  for (const item of positions) {
    const edges = getObjectEdges(item.position, item.dimensions, item.rotation);
    minX = Math.min(minX, edges.left);
    maxX = Math.max(maxX, edges.right);
    minY = Math.min(minY, edges.top);
    maxY = Math.max(maxY, edges.bottom);
  }
  
  return {
    left: minX,
    right: maxX,
    top: minY,
    bottom: maxY,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  };
};
```

**FloorPlanMarkup.tsx - Modified Alignment:**
```typescript
const handleAlignEdgesApply = useCallback((alignmentEdge: AlignmentEdge) => {
  if (selectedItemIds.size > 1) {
    // Group alignment
    const groupItems = getSelectedItemsData();
    const groupBounds = getGroupBoundingBox(groupItems);
    const referenceEdges = getObjectEdges(refPos, refDims, refRotation);
    
    let delta: Point;
    switch (alignmentEdge) {
      case 'left': delta = { x: referenceEdges.left - groupBounds.left, y: 0 }; break;
      case 'right': delta = { x: referenceEdges.right - groupBounds.right, y: 0 }; break;
      case 'top': delta = { x: 0, y: referenceEdges.top - groupBounds.top }; break;
      case 'bottom': delta = { x: 0, y: referenceEdges.bottom - groupBounds.bottom }; break;
    }
    
    // Apply delta to all selected items
    applyDeltaToSelectedItems(delta);
  } else {
    // Single item alignment (existing behavior)
  }
}, [selectedItemIds, ...]);
```

### Phase 4: Visual Feedback

**utils/drawing.ts:**
```typescript
// Render group bounding box when multiple items selected
if (selectedItemIds.size > 1) {
  const groupBounds = getGroupBoundingBox(...);
  ctx.strokeStyle = '#3b82f6';
  ctx.setLineDash([5 / zoom, 5 / zoom]);
  ctx.strokeRect(
    groupBounds.left, 
    groupBounds.top, 
    groupBounds.right - groupBounds.left, 
    groupBounds.bottom - groupBounds.top
  );
  ctx.setLineDash([]);
}
```

---

## User Experience

### Selection Indicators
- Single selected: Cyan border (existing)
- Multi-selected: Cyan border on each item + dashed blue group bounding box
- Group drag: All items move together with ghost preview

### Toolbar Updates
- Copy button enabled when any items selected
- Badge shows selection count: "Copy (3)"
- Tooltip: "Copy 3 items (same type required for batch)"

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| Shift+Click | Add/remove from selection |
| Ctrl/Cmd+A | Select all (future) |
| Delete | Delete all selected |
| Ctrl/Cmd+C | Copy selected |
| Escape | Clear selection, cancel placement |

---

## Files to Modify

| File | Changes |
|------|---------|
| `types.ts` | Add `BatchPlacementConfig` interface |
| `FloorPlanMarkup.tsx` | Replace single selection with Set, update handlers |
| `Canvas.tsx` | Multi-select click handling, group drag |
| `Toolbar.tsx` | Update copy button for multi-select |
| `utils/geometry.ts` | Add `getGroupBoundingBox` function |
| `utils/drawing.ts` | Render group selection box, multiple selection highlights |

---

## Testing Scenarios

1. **Shift+click** to add items to selection
2. **Copy 3 PV arrays** → placement maintains relative positions and spacing config
3. **Align group** to reference object → entire group moves as unit
4. **Delete multiple** items at once
5. **Mixed type selection** → copy shows warning, falls back to first item
6. **Drag group** → all items maintain relative positions

