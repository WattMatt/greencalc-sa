

# Plan: Landing View for PV Layout with File Browser Interface

## Overview

Transform the PV Layout experience from immediately showing the canvas editor to showing a **layout browser landing page first**. Users will see a file manager interface where they can browse, create, and select layouts. Only when they click on a specific layout or create a new one will they enter the canvas editing mode.

## Current State vs. Desired State

**Current:** User enters PV Layout tab -> Immediately shows canvas with most recent layout loaded (or empty canvas)

**Desired (from reference):** User enters PV Layout tab -> Shows file browser with all layouts organized in folders. User clicks a layout -> Then shows the canvas editor

## Three-Panel Layout Design

```text
+------------------+----------------------------------------+--------------------+
|  Floor Plan      |  Project Floor Plan Designs            |  Project Overview  |
|  Markup          |                                        |                    |
|                  |  [Select Multiple] [Manage Folders]    |  [Grid Icon]       |
|  FILE ACTIONS v  |  [New Folder] [+ New Design]           |                    |
|  - Load PDF File |                                        |  Project Overview  |
|  - My Saved      |  Select a design to continue           |                    |
|    Designs       |  working or start a new one            |  Load a PDF and    |
|  - Export as PDF |                                        |  select design     |
|  - View Saved    |  +-------------------------------+     |  purpose to view   |
|    Reports       |  | Uncategorized (1 design)   v |     |  project details   |
|                  |  +-------------------------------+     |                    |
|  ADVANCED v      |    | [Folder] Design - 20...   : |     |                    |
|                  |    | [Calendar] 2025/11/20       |     |                    |
|                  |  +-------------------------------+     |                    |
+------------------+----------------------------------------+--------------------+
```

## Architecture

Introduce a `viewMode` state in `FloorPlanMarkup`:
- `'browser'` - Shows the file browser landing view (default when entering)
- `'editor'` - Shows the canvas editor (current view)

When a user selects a layout or clicks "+ New Design", switch to `'editor'` mode.

## File Changes

### 1. Create `src/components/floor-plan/components/LayoutBrowser.tsx` (NEW)

Main file browser component with three-column layout:

**Left Sidebar:**
- "Floor Plan Markup" header
- FILE ACTIONS collapsible section with:
  - Load PDF File -> Opens image/PDF loader directly
  - My Saved Designs -> Scrolls to or filters designs
  - Export as PDF -> Future feature (disabled for now)
  - View Saved Reports -> Future feature (disabled for now)
- ADVANCED collapsible section (placeholder)

**Center Panel:**
- "Project Floor Plan Designs" header
- Action buttons: Select Multiple, Manage Folders, New Folder, + New Design
- Subtitle: "Select a design to continue working or start a new one"
- Folders section (collapsible accordions):
  - "Uncategorized" folder containing all layouts (initial MVP)
  - Each layout shows: folder icon, name (truncated), date, 3-dot menu
- Design cards are clickable to open that layout

**Right Panel:**
- "Project Overview" placeholder
- Icon grid placeholder
- Text: "Load a PDF and select design purpose to view project details"

### 2. Modify `src/components/floor-plan/FloorPlanMarkup.tsx`

Changes:
- Add `viewMode` state: `'browser' | 'editor'`
- Default to `'browser'` mode
- Do NOT auto-load the most recent layout on mount (stay in browser mode)
- When user selects a layout from browser: call `loadLayout()` then switch to `'editor'`
- When user creates new design: switch to `'editor'` with blank state
- Add a "Back to Designs" button in the editor toolbar to return to browser

### 3. Modify `src/components/floor-plan/components/Toolbar.tsx`

Add:
- "Back to Designs" or "Close" button at the top to return to browser mode
- Pass `onBackToBrowser` callback prop

### 4. Database: Add `folder` column (Future Enhancement)

For MVP, all layouts go into "Uncategorized" folder. A future migration could add:
```sql
ALTER TABLE pv_layouts ADD COLUMN folder_id uuid REFERENCES pv_layout_folders(id);
```

For now, we skip folder management and just group everything under "Uncategorized".

## UI Implementation Details

### Left Sidebar (LayoutBrowser)

```typescript
<div className="w-64 bg-card border-r flex flex-col h-full">
  <div className="p-4 border-b">
    <h1 className="font-bold text-lg">Floor Plan Markup</h1>
  </div>
  
  <Collapsible defaultOpen>
    <CollapsibleTrigger className="...">
      FILE ACTIONS <ChevronDown />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <button onClick={onLoadPDF}>Load PDF File</button>
      <button onClick={scrollToDesigns}>My Saved Designs</button>
      <button disabled>Export as PDF</button>
      <button disabled>View Saved Reports</button>
    </CollapsibleContent>
  </Collapsible>
  
  <Collapsible>
    <CollapsibleTrigger>ADVANCED</CollapsibleTrigger>
  </Collapsible>
</div>
```

### Center Content (LayoutBrowser)

```typescript
<div className="flex-1 p-6 overflow-y-auto">
  <div className="flex items-start justify-between mb-4">
    <div>
      <h2 className="text-3xl font-bold leading-tight">
        Project<br/>Floor<br/>Plan<br/>Designs
      </h2>
      <p className="text-muted-foreground mt-2">
        Select a design to continue working or start a new one
      </p>
    </div>
    <div className="flex gap-2">
      <Button variant="outline" disabled>Select Multiple</Button>
      <Button variant="outline" disabled>Manage Folders</Button>
      <Button variant="outline" disabled>New Folder</Button>
      <Button onClick={onNewDesign}>+ New Design</Button>
    </div>
  </div>
  
  {/* Folders/Designs List */}
  <Accordion type="multiple" defaultValue={['uncategorized']}>
    <AccordionItem value="uncategorized">
      <AccordionTrigger>
        <Folder /> Uncategorized ({layouts.length} designs)
      </AccordionTrigger>
      <AccordionContent>
        <div className="grid grid-cols-3 gap-4 p-4">
          {layouts.map(layout => (
            <DesignCard 
              key={layout.id}
              layout={layout}
              onClick={() => onSelectLayout(layout.id)}
            />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</div>
```

### Design Card Component

```typescript
<button className="border rounded-lg p-4 hover:border-primary transition-colors">
  <div className="flex items-center gap-2">
    <Folder className="text-primary" />
    <span className="font-medium truncate">{layout.name}</span>
    <DropdownMenu> {/* 3-dot menu */}
      <DropdownMenuItem>Rename</DropdownMenuItem>
      <DropdownMenuItem>Duplicate</DropdownMenuItem>
      <DropdownMenuItem>Delete</DropdownMenuItem>
    </DropdownMenu>
  </div>
  <div className="flex items-center gap-2 text-muted-foreground text-sm mt-2">
    <Calendar className="h-4 w-4" />
    {formatDate(layout.updated_at)}
  </div>
</button>
```

### Right Panel (LayoutBrowser)

```typescript
<div className="w-72 bg-card border-l flex flex-col items-center justify-center p-6 text-center">
  <div className="grid grid-cols-2 gap-1 mb-4">
    <div className="w-6 h-6 border rounded" />
    <div className="w-6 h-6 border rounded" />
    <div className="w-6 h-6 border rounded" />
    <div className="w-6 h-6 border rounded" />
  </div>
  <h3 className="font-semibold">Project Overview</h3>
  <p className="text-sm text-muted-foreground mt-2">
    Load a PDF and select design purpose to view project details
  </p>
</div>
```

## User Flow

1. User navigates to PV Layout tab
2. Sees the file browser with all layouts listed under "Uncategorized"
3. User can:
   - Click a layout card -> Loads that layout and switches to editor mode
   - Click "+ New Design" -> Creates blank layout and switches to editor mode
   - Click "Load PDF File" -> Opens the load modal, then switches to editor
4. In editor mode, user can click "Back to Designs" to return to browser

## Implementation Steps

1. Create `LayoutBrowser.tsx` with the three-panel layout
2. Add `viewMode` state to `FloorPlanMarkup.tsx`
3. Conditionally render either `LayoutBrowser` or the editor (Toolbar + Canvas + SummaryPanel)
4. Update initial loading logic to NOT auto-load a layout (stay in browser)
5. Wire up the layout selection and creation handlers
6. Add "Back to Designs" button to Toolbar
7. Fetch layouts in browser mode similar to `LayoutManagerModal`

## Technical Notes

- Reuse existing CRUD functions from `FloorPlanMarkup` (`loadLayout`, `createLayout`, `renameLayout`, `deleteLayout`)
- Pass these as props to `LayoutBrowser`
- The browser fetches the layout list independently
- Folder management buttons are initially disabled (future feature)
- Export as PDF and View Reports are also disabled (future features)

