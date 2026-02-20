

## Schematics Tab -- Carbon Copy from WM-Tariffs

### Overview
Replicate the full Schematics tab from WM-Tariffs into this project, placed between the Tenants and Load Profile tabs. This includes schematic file upload (PDF, PNG, JPG, SVG), listing with metadata table, viewing, replacing files, and deleting -- all adapted to work with `project_id` instead of `site_id`.

### What Gets Built

**Schematics Tab UI (matching WM-Tariffs exactly):**
- Header: "Schematics" title with subtitle "Electrical distribution diagrams for this site"
- "+ Upload Schematic" button opening a dialog with:
  - Schematic Name input (auto-populated from file name)
  - Description textarea
  - Total Pages number input
  - Drag-and-drop file upload zone (PDF, PNG, JPG, SVG up to 50MB)
- Table listing schematics with columns: Checkbox, Type (icon), Name, Pages, Uploaded date, Status, Actions
- Bulk select with "Delete Selected" button
- Action buttons per row: View (eye icon), Replace (upload icon), Delete (trash icon)
- Replace dialog preserving all metadata while swapping the file
- Delete confirmation dialog
- PDF auto-conversion to PNG image on upload for faster viewing
- Empty state with icon and "Upload Schematic" CTA

**Schematic Viewer Page:**
- New route `/projects/:projectId/schematics/:id`
- Displays the schematic image with zoom/pan controls
- Meter data extraction panel (AI-powered, using drawn regions)
- Meter position overlays on the schematic
- Full SchematicEditor with Fabric.js canvas for meter placement, connections, and region extraction

### Technical Details

**Database Migration:**
- `project_schematics` table: id, project_id (FK to projects), name, description, file_path, file_type, page_number, total_pages, converted_image_path, uploaded_by, created_at, updated_at
- `project_schematic_meter_positions` table: id, schematic_id (FK), meter_id (text -- mapped to tenant or reference), x_position, y_position, label, scale_x, scale_y, created_at, updated_at
- RLS policies for authenticated users (SELECT, INSERT, UPDATE, DELETE)
- Updated_at triggers

**Storage:**
- `project-schematics` storage bucket (public, 50MB limit, PDF/PNG/JPG/SVG)
- RLS policies for authenticated user access

**New Files:**
1. `src/types/schematic.ts` -- Shared type definitions (Schematic, getFileTypeIcon, etc.)
2. `src/components/projects/SchematicsTab.tsx` -- Main tab component (~900 lines), carbon-copied from WM-Tariffs `SchematicsTab` with `projectId` replacing `siteId`
3. `src/pages/SchematicViewer.tsx` -- Viewer page with zoom/pan and meter overlays
4. `src/components/schematic/SchematicEditor.tsx` -- Fabric.js canvas editor
5. `src/components/schematic/PdfToImageConverter.tsx` -- PDF to image conversion dialog
6. `src/components/schematic/MeterDataExtractor.tsx` -- AI meter extraction panel
7. `src/components/schematic/MeterFormFields.tsx` -- Meter form input fields
8. `src/components/schematic/MeterConnectionsManager.tsx` -- Meter connection hierarchy dialog
9. `src/components/schematic/QuickMeterDialog.tsx` -- Quick meter placement dialog

**Modified Files:**
1. `src/pages/ProjectDetail.tsx`:
   - Import SchematicsTab component
   - Add "schematics" entry to `tabStatuses` (pending/complete based on count)
   - Add `<TabWithStatus value="schematics">` between Tenants and Load Profile tabs
   - Add `<TabsContent value="schematics">` rendering `<SchematicsTab projectId={id!} />`
   - Add `FileText` icon import for the tab

2. `src/App.tsx`:
   - Add lazy import for SchematicViewer page
   - Add route: `/projects/:projectId/schematics/:id`

### Key Adaptations from WM-Tariffs
- All references to `site_id` become `project_id`
- Storage bucket changes from `client-files` to `project-schematics`
- The `generateStoragePath` utility is simplified (no hierarchical client/site path needed)
- Navigation paths use `/projects/:projectId/schematics/:id` instead of `/schematics/:id`
- Realtime subscriptions filter by project-specific schematic IDs
- No role-based access (`has_role` function) -- uses standard authenticated user RLS

### Dependencies
- No new packages needed
- Uses existing: `pdfjs-dist` (PDF rendering), `xlsx` (not needed here), all Shadcn/UI components
- Note: Fabric.js is NOT currently installed. The SchematicEditor requires it. Will need to evaluate if we install `fabric` or defer the editor to a later phase and focus on the upload/list/view/delete functionality first.

### Implementation Order
1. Database migration (table + storage bucket)
2. Type definitions
3. SchematicsTab component (upload, list, delete, replace)
4. Integration into ProjectDetail.tsx tabs
5. SchematicViewer page + route
6. SchematicEditor and supporting components (may require `fabric` package)
