

# Plan: Layout Manager for PV Layouts

## Overview

Add a Layout Manager interface that allows users to create, view, switch between, rename, duplicate, and delete multiple PV layouts per project. This transforms the current single-layout system into a multi-layout file management system.

## Current State

- `pv_layouts` table supports multiple layouts per project (has `name` column)
- Current code only loads the most recent layout (`LIMIT 1`)
- All saves use hardcoded name "Default Layout"
- No UI to manage multiple layouts

## Proposed Solution

Add a **Layout Manager Panel** accessible from the Toolbar that provides file-browser-like functionality for layouts.

## Architecture

```text
Toolbar
   |
   +-- [Layouts] button --> Opens LayoutManagerModal
                                     |
                                     v
                           +-------------------+
                           | Layout Manager    |
                           +-------------------+
                           | - List of layouts |
                           | - Create new      |
                           | - Load/Switch     |
                           | - Rename          |
                           | - Duplicate       |
                           | - Delete          |
                           +-------------------+
```

## UI Design

### Layout Manager Modal

```text
+-----------------------------------------------------------+
|  Layouts                                             [X]  |
+-----------------------------------------------------------+
|                                                           |
|  [+ New Layout]                            [Search...]    |
|                                                           |
|  +-------------------------------------------------------+|
|  | Name               | Modified         | Actions       ||
|  +-------------------------------------------------------+|
|  | * Default Layout   | Today 10:30 AM   | [Edit][...v] ||
|  | Rooftop Option A   | Yesterday        | [Load][...v] ||
|  | Carport Design     | Jan 25, 2026     | [Load][...v] ||
|  +-------------------------------------------------------+|
|                                                           |
|  * indicates currently loaded layout                      |
|                                                           |
+-----------------------------------------------------------+
```

### Actions Dropdown Menu

- **Load** - Switch to this layout
- **Rename** - Change layout name
- **Duplicate** - Create a copy
- **Delete** - Remove layout (with confirmation)

### New Layout Dialog

```text
+-------------------------------------------+
|  Create New Layout                   [X]  |
+-------------------------------------------+
|                                           |
|  Name: [________________________]         |
|                                           |
|  Start from:                              |
|  ( ) Blank layout                         |
|  (*) Copy current layout                  |
|                                           |
|  [Cancel]                    [Create]     |
|                                           |
+-------------------------------------------+
```

## File Changes

### 1. Create `src/components/floor-plan/components/LayoutManagerModal.tsx` (NEW)

Main layout management interface with:
- List of all layouts for the current project
- Create, rename, duplicate, delete functionality
- Load/switch between layouts
- Visual indicator for currently active layout
- Timestamps showing when each layout was last modified

### 2. Modify `src/components/floor-plan/components/Toolbar.tsx`

Add:
- "Layouts" button that opens the LayoutManagerModal
- Display current layout name in the header
- Unsaved changes indicator per layout

### 3. Modify `src/components/floor-plan/FloorPlanMarkup.tsx`

Changes:
- Add `currentLayoutName` state
- Add `isLayoutManagerOpen` state
- Modify load logic to accept a specific layout ID
- Add functions: `loadLayout(id)`, `createLayout(name, copyFrom?)`, `renameLayout(id, name)`, `duplicateLayout(id)`, `deleteLayout(id)`
- Update save to use the current layout's actual name (not hardcoded "Default Layout")

### 4. Minor: Update types if needed

Add any new types for layout metadata display.

## Technical Implementation

### Fetching All Layouts

```typescript
const { data: layouts } = await supabase
  .from('pv_layouts')
  .select('id, name, created_at, updated_at')
  .eq('project_id', projectId)
  .order('updated_at', { ascending: false });
```

### Creating a New Layout

```typescript
const createLayout = async (name: string, copyFromId?: string) => {
  let layoutData = {
    project_id: projectId,
    name,
    scale_pixels_per_meter: null,
    pv_config: DEFAULT_PV_PANEL_CONFIG,
    roof_masks: [],
    pv_arrays: [],
    equipment: [],
    cables: [],
    pdf_data: null,
  };

  if (copyFromId) {
    // Fetch the source layout and copy its data
    const { data: source } = await supabase
      .from('pv_layouts')
      .select('*')
      .eq('id', copyFromId)
      .single();
    
    if (source) {
      layoutData = {
        ...layoutData,
        scale_pixels_per_meter: source.scale_pixels_per_meter,
        pv_config: source.pv_config,
        roof_masks: source.roof_masks,
        pv_arrays: source.pv_arrays,
        equipment: source.equipment,
        cables: source.cables,
        pdf_data: source.pdf_data,
      };
    }
  }

  const { data, error } = await supabase
    .from('pv_layouts')
    .insert(layoutData)
    .select()
    .single();

  if (!error && data) {
    await loadLayout(data.id);
  }
};
```

### Loading a Specific Layout

```typescript
const loadLayout = async (layoutIdToLoad: string) => {
  const { data, error } = await supabase
    .from('pv_layouts')
    .select('*')
    .eq('id', layoutIdToLoad)
    .single();

  if (!error && data) {
    setLayoutId(data.id);
    setCurrentLayoutName(data.name);
    // ... restore all other state from data
  }
};
```

### Renaming a Layout

```typescript
const renameLayout = async (id: string, newName: string) => {
  await supabase
    .from('pv_layouts')
    .update({ name: newName })
    .eq('id', id);
  
  if (id === layoutId) {
    setCurrentLayoutName(newName);
  }
};
```

### Deleting a Layout

```typescript
const deleteLayout = async (id: string) => {
  await supabase
    .from('pv_layouts')
    .delete()
    .eq('id', id);
  
  // If deleted the current layout, load another or create blank
  if (id === layoutId) {
    const { data: remaining } = await supabase
      .from('pv_layouts')
      .select('id')
      .eq('project_id', projectId)
      .limit(1)
      .maybeSingle();
    
    if (remaining) {
      await loadLayout(remaining.id);
    } else {
      // Reset to blank state
      resetToBlankLayout();
    }
  }
};
```

## Toolbar Update

```text
+--------------------------------------------------+
| PV Layout Tool                                   |
| Main Layout ▼         12 panels | 6.6 kWp        |
+--------------------------------------------------+
| [Layouts] [Load Layout]                          |
+--------------------------------------------------+
```

The header area will show:
- Current layout name (clickable dropdown or button to open manager)
- Quick stats remain visible

## Implementation Steps

1. Create `LayoutManagerModal.tsx` with full CRUD UI
2. Add state and handler functions to `FloorPlanMarkup.tsx`
3. Update `Toolbar.tsx` with Layouts button and current name display
4. Update save logic to use actual layout name
5. Add confirmation dialogs for destructive actions (delete, switch with unsaved changes)
6. Test all operations: create, load, rename, duplicate, delete

## Edge Cases

1. **Unsaved changes when switching**: Prompt to save or discard
2. **Delete current layout**: Load another or reset to blank
3. **Only one layout exists**: Prevent deletion (or allow with warning)
4. **Duplicate names**: Allow (use timestamps to distinguish) or enforce uniqueness
5. **Empty project**: Start with one "Default Layout" auto-created

