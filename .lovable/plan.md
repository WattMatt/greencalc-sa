

# Plan: Complete Folder Management Features for PV Layout Browser

## Current State Analysis

The LayoutBrowser currently has:
- Folder creation (New Folder button opens a dialog)
- Folder rename/delete (only visible when "Manage Folders" mode is active)
- Multi-select mode with batch move functionality

## Missing Features to Implement

Based on the "Full implementation" scope you approved earlier, the following features are missing:

### 1. Move Single Layout to Folder (via Dropdown Menu)
Currently, the 3-dot menu on each layout card only shows: Rename, Duplicate, Delete.

**Add:** "Move to Folder" option that opens a folder selection submenu or dialog.

### 2. Drag-and-Drop Between Folders
Allow users to drag layout cards and drop them into folder accordion headers to move them.

### 3. Improved "Manage Folders" UX
Make it clearer when manage folders mode is active - potentially highlight folders or show a toolbar.

---

## Implementation Details

### Step 1: Add "Move to Folder" in Layout Dropdown Menu
**File:** `src/components/floor-plan/components/LayoutBrowser.tsx`

Update the `DesignCard` component's dropdown menu to include a "Move to..." option with a submenu listing all available folders.

```text
DropdownMenu
  Rename
  Duplicate
  Move to... (submenu)
    - Uncategorized
    - Folder A
    - Folder B
  ---
  Delete
```

### Step 2: Add Drag-and-Drop Support
**File:** `src/components/floor-plan/components/LayoutBrowser.tsx`

- Add `draggable="true"` to `DesignCard`
- Add `onDragStart` handler to set the layout ID being dragged
- Add `onDragOver` and `onDrop` handlers to folder `AccordionItem` headers
- Implement visual feedback (highlight) when dragging over a valid drop target
- On drop, update the layout's `folder_id` in Supabase

### Step 3: Improve Manage Folders Mode Visibility
When "Manage Folders" mode is active:
- Add a colored banner or highlight to indicate the mode
- Show the edit/delete icons more prominently on folder rows

---

## Technical Implementation

### DesignCard Props Addition
```typescript
interface DesignCardProps {
  // existing props...
  onMoveToFolder: (folderId: string | null) => void;
  folders: LayoutFolder[];
  onDragStart: (layoutId: string) => void;
}
```

### Drag State in Parent Component
```typescript
const [draggedLayoutId, setDraggedLayoutId] = useState<string | null>(null);
```

### Drop Handler on Folder
```typescript
const handleDropOnFolder = async (folderId: string | null) => {
  if (!draggedLayoutId) return;
  await supabase
    .from('pv_layouts')
    .update({ folder_id: folderId })
    .eq('id', draggedLayoutId);
  await fetchData();
  setDraggedLayoutId(null);
  toast.success('Layout moved');
};
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/components/LayoutBrowser.tsx` | Add move-to-folder submenu in dropdown, implement drag-and-drop handlers, improve manage folders mode UI |

---

## Summary

This plan adds:
1. Single-layout move via dropdown submenu
2. Drag-and-drop layouts between folders
3. Enhanced visual feedback for folder management mode

All changes are contained within `LayoutBrowser.tsx` and require no database changes (folder structure already exists).

