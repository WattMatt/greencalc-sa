
## Drag-and-Drop Reordering for Content Blocks

### Overview
The content block list in the proposal sidebar displays a grip handle icon (GripVertical) but has no actual drag-and-drop functionality wired up. This plan adds native HTML drag-and-drop to allow users to click the grip handle, drag a block to a new position, and drop it to reorder.

### Approach
Use the native HTML5 Drag and Drop API (no new dependencies needed). This keeps it lightweight and consistent with the existing codebase.

### Technical Details

**File: `src/components/proposals/ContentBlockToggle.tsx`**
- Add drag event handlers: `onDragStart`, `onDragEnd`, `onDragOver`, `onDrop`
- Accept new props: `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`, `isDragging`, `isDragOver`
- Set `draggable={true}` on the outer container
- Add visual feedback: reduce opacity when dragging, show a top-border indicator on the drop target
- The grip handle's `cursor-grab` becomes `cursor-grabbing` while dragging

**File: `src/components/proposals/ProposalSidebar.tsx`**
- Add local state: `draggedIndex` (number | null) and `dragOverIndex` (number | null)
- Sort blocks by `order` into a local variable, then render with drag props
- On drop: compute the new order, update each block's `order` field, and call `onContentBlocksChange` with the reordered array
- Pass drag state and handlers down to each `ContentBlockToggle`

### Visual Behavior
- Grabbing a block reduces its opacity to ~50%
- Hovering over another block shows a blue top-border highlight indicating where the dragged item will be inserted
- Dropping snaps the block into its new position and updates the order values
- The list re-renders in the new order immediately
