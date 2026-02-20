

## Fix Blank Canvas Loading + Port Schematic Editor from WM-Tariffs

This is a significant feature port that involves fixing a bug, creating new database tables, and porting a ~6,800-line Fabric.js-based schematic editor.

### Bug Fix: Blank Canvas Never Finishes Loading

The SchematicViewer crashes when opening a "clean schematic" (blank canvas) because `file_path` is `null`. Line 58 of `SchematicViewer.tsx` calls `supabase.storage.getPublicUrl(data.file_path)` which throws `Cannot read properties of null (reading 'replace')`. The fix guards against null `file_path` and renders a blank canvas instead.

### Port: Fabric.js Schematic Editor from WM-Tariffs

The WM-tariffs project has a fully featured schematic editor (`SchematicEditor.tsx`, 6,775 lines) with supporting components. This needs to be adapted to this project's data model (which uses `project_id` instead of `site_id`, and has `project_schematics` / `project_schematic_meter_positions` instead of `schematics` / `meter_positions`).

---

### Phase 1: Database Schema Changes

Create two new tables to support meter connections and schematic connection lines:

1. **`project_meter_connections`** -- Stores parent-child meter hierarchy
   - `id` (uuid, PK)
   - `parent_meter_id` (text) -- references the parent/upstream meter
   - `child_meter_id` (text) -- references the child/downstream meter
   - `project_id` (uuid, FK to projects)
   - `created_at` (timestamptz)

2. **`project_schematic_lines`** -- Stores line segments drawn between meters on the canvas
   - `id` (uuid, PK)
   - `schematic_id` (uuid, FK to project_schematics)
   - `from_x` (numeric) -- start X as percentage
   - `from_y` (numeric) -- start Y as percentage
   - `to_x` (numeric) -- end X as percentage
   - `to_y` (numeric) -- end Y as percentage
   - `line_type` (text) -- e.g. 'connection'
   - `color` (text)
   - `stroke_width` (numeric)
   - `metadata` (jsonb) -- stores parent/child meter IDs, node index
   - `created_at` (timestamptz)

Both tables will have RLS policies matching the project-based access pattern used throughout the app.

### Phase 2: Fix SchematicViewer for Blank Canvas

Update `src/pages/SchematicViewer.tsx`:
- Guard against `file_path === null` (clean schematics)
- When `file_path` is null, skip the storage URL fetch and render the Fabric.js editor directly as a blank canvas
- Load the SchematicEditor component instead of just an image viewer

### Phase 3: Port Schematic Editor Components

Create the following files adapted from WM-tariffs:

1. **`src/components/schematic/SchematicEditor.tsx`** -- The main Fabric.js canvas editor, adapted to use:
   - `project_schematics` instead of `schematics`
   - `project_schematic_meter_positions` instead of `meter_positions`
   - `project_meter_connections` instead of `meter_connections`
   - `project_schematic_lines` instead of `schematic_lines`
   - `project_id` context instead of `site_id`
   
   Core features ported:
   - Fabric.js canvas initialisation with background image or blank canvas
   - Meter card placement (rendered as image objects with table-style fields)
   - Meter card dragging and repositioning
   - Connection drawing with snap points on meter card edges
   - Multi-segment connection lines with intermediate draggable nodes
   - 45-degree angle snapping (Shift key)
   - Zoom (scroll + Ctrl), pan (middle mouse / drag)
   - Edit mode toggle (showing confirmation status colours)
   - Legend visibility toggles for meter types, connections, background
   - Save/load meter positions and connection lines to database
   - Quick meter placement dialog
   - Meter connections manager dialog

2. **`src/components/schematic/QuickMeterDialog.tsx`** -- Dialog for placing existing or new meters at a clicked position on the canvas

3. **`src/components/schematic/MeterConnectionsManager.tsx`** -- Dialog for managing the parent-child meter hierarchy

4. **`src/components/schematic/MeterFormFields.tsx`** -- Reusable form fields for meter data entry

### Phase 4: Update SchematicViewer Page

Rewrite `src/pages/SchematicViewer.tsx` to:
- Detect clean schematics (file_path is null) and load the editor in blank-canvas mode
- For image-backed schematics, load the editor with the image as background
- Embed the `SchematicEditor` component with proper props
- Retain header, zoom controls, and navigation

### Adaptation Notes

The WM-tariffs project uses `site_id` as the organisational unit, while this project uses `project_id`. All queries will be adapted accordingly. The `meters` table in WM-tariffs maps to the existing tenant meters and SCADA imports in this project -- the meter cards will reference project tenant meter data.

### Files Created
- `src/components/schematic/SchematicEditor.tsx`
- `src/components/schematic/QuickMeterDialog.tsx`
- `src/components/schematic/MeterConnectionsManager.tsx`
- `src/components/schematic/MeterFormFields.tsx`

### Files Modified
- `src/pages/SchematicViewer.tsx`

### Database Changes
- Create `project_meter_connections` table
- Create `project_schematic_lines` table
- Add RLS policies for both tables

