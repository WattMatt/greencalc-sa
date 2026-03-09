

# Plan: Enhanced Bulk CSV Import in Tenants Tab

## Summary
Enhance the existing `ScadaImportWizard` (the "Import Data" dialog in the Tenants tab) to add header validation across files, per-file preview, and dual upload (project tenants + global meter library).

## Changes to `src/components/projects/ScadaImportWizard.tsx`

### 1. Header consistency check (new)
After all files are read (in `handleReadAll`), parse each file using the configured separator/header row and compare headers across files. If headers differ, show a warning banner listing mismatched files and block progression to step 2 until resolved (e.g. user removes the offending file or adjusts header row).

```text
Logic:
- Parse headers for each file using current separator + headerRow
- Compare all header arrays against the first file's headers
- Store mismatch info: { fileIdx, missingCols, extraCols }
- Show warning card in Tab 2 if mismatches exist
- Re-validate when separator or headerRow changes
```

### 2. Per-file preview in Tab 3 (enhance)
Currently Tab 3 only shows data from the first file. Add a file selector (tabs or dropdown) so the user can switch between files and preview each one individually with the shared column interpretation applied.

- Add a `previewFileIdx` state (default 0)
- Show a row of file-name buttons/tabs above the preview table
- Re-parse the selected file's content with current separator/headerRow/visible columns on selection change

### 3. Dual upload: project tenants + meter library (enhance Step 4)
Modify `handleStartImport` and `handleWizardComplete` so that each file:

**a) Creates a `scada_imports` record with `project_id = null`** (global meter library entry) using the filename (sans extension) as `site_name`/`shop_name`.

**b) Creates a `scada_imports` record with `project_id` set** (project-scoped, as currently done).

**c) Creates a `project_tenants` record** linked to the project-scoped `scada_imports` entry via `scada_import_id`, using filename as `name`/`shop_name` and `area_sqm = 0`.

### 4. Changes to `src/components/projects/TenantManager.tsx`
Update `handleWizardComplete` to implement the dual-insert logic described above:
- Insert into `scada_imports` with `project_id` (project meter) — already done
- Insert into `scada_imports` with `project_id = null` (global library copy) — new
- Insert into `project_tenants` with `scada_import_id` pointing to the project meter — new
- Upload CSV to storage bucket — already done
- Invalidate relevant queries including `project-tenants`

### 5. Upload CSV to storage for both records
Use existing `uploadCsvToStorage` for both the project-scoped and global meter library entries.

## Files affected
- `src/components/projects/ScadaImportWizard.tsx` — header validation + per-file preview
- `src/components/projects/TenantManager.tsx` — dual upload logic in `handleWizardComplete`

## No database changes required
All tables (`scada_imports`, `project_tenants`) already have the required columns and RLS policies.

