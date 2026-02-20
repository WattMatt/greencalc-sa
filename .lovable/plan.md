

## Multi-File Import with Column Configuration for Tenants & Profiles

### Overview
Replace the current single-file import flow with a multi-step "Bulk Ingestion Tool" dialog, modelled on the WM-Tariffs project's `CsvBulkIngestionTool` and `SingleMeterCsvParseDialog`. This new tool supports uploading multiple CSV/Excel files, assigning tenants to each file, configuring the parser (delimiter, header row), selecting and renaming columns with data types, and previewing the parsed result.

### User Flow

**Step 1 -- Upload Files**
- Click "Import" button to open the dialog
- "Choose Files" button accepts `.csv`, `.xlsx`, `.xls` (multiple files allowed)
- Each selected file appears as a row: file name on the left, a tenant dropdown on the right
- The tenant dropdown defaults to blank; if tenants exist, user can assign one per file
- Assigned tenants are removed from the dropdown options for other files (reducing list)
- "Upload All" button uploads files to storage and advances to Step 2

**Step 2 -- Parse & Ingest**
- Parsing Configuration card with:
  - Column Separator dropdown (Tab, Comma, Semicolon, Space)
  - Header Row Number input
- Column Interpretation section (appears after loading a preview):
  - Select All / Deselect All checkbox header
  - Each column shown as a card with:
    - Checkbox to include/exclude
    - Editable Column Name input
    - Data Type dropdown (DateTime, Float, Int, String, Boolean)
    - DateTime Format dropdown (shown only when Data Type is DateTime)
    - Split Column By dropdown (No split, Tab, Comma, Semicolon, Space)
- File list with status badges and per-file parse/preview/delete actions

**Step 3 -- Preview**
- Displays a table of parsed data using the column interpretation settings
- Shows the reading count
- Only visible (checked) columns are shown
- Column headers reflect any renamed values

### Technical Details

**New file: `src/components/projects/ScadaImportWizard.tsx`**

A new large dialog component (~800-1000 lines) containing:
- Three-tab layout using `Tabs` (Upload Files, Parse & Ingest, Preview)
- State management for: files list, separator, header row number, column mappings, column visibility, column data types, column splits, preview data
- File handling: uses `xlsx` library for Excel files, plain text for CSV
- Storage: uploads files to a `scada-csvs` storage bucket (or existing bucket)
- Tenant assignment: queries `project_tenants` for the current project to populate the dropdown
- Column configuration UI matching the WM-Tariffs `SingleMeterCsvParseDialog` pattern
- Preview loading: reads the file content, applies separator and header row config, displays first 20 rows

**Modified file: `src/components/projects/TenantManager.tsx`**

- Replace the current `CsvImportWizard` + `TenantColumnMapper` flow with the new `ScadaImportWizard`
- Remove the hidden file input and `handleFileUpload` function
- Import button opens the `ScadaImportWizard` dialog directly
- Remove `CsvImportWizard` and `TenantColumnMapper` imports (no longer needed for this flow)
- Keep existing tenant CRUD mutations

**Storage bucket (SQL migration)**

Create a `scada-csvs` bucket for uploaded CSV/Excel files with appropriate RLS policies so authenticated users can upload and read files.

### What stays the same
- Existing tenant table, add/edit/delete tenant, profile assignment, multi-meter selector -- all unchanged
- The Download Template button stays
- The `TenantProfileMatcher` and `MultiMeterSelector` components remain untouched

### Dependencies
- No new npm packages required (`xlsx` is already installed, all UI components exist)

