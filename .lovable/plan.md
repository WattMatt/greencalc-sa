

## Align Tenant Bulk Upload with Global Meter Database

### Problem
The current `handleWizardComplete` in `TenantManager.tsx` inserts into `scada_imports` but is missing key fields and query invalidations that the Load Profiles ingestion flows use. This means meters imported from the Tenants tab will:

1. **Not store `raw_data`** (the original CSV content) -- so they cannot be re-previewed, re-parsed, or displayed in the Configuration Wizard or meter detail views
2. **Not invalidate the right query keys** -- so the Load Profiles dashboard, Meter Library, and cross-site comparison won't pick up the new meters until a manual refresh

### What Needs to Change

**File: `src/components/projects/TenantManager.tsx` -- `handleWizardComplete` function (around line 484)**

1. **Store `raw_data`**: Build the `[{"csvContent": "..."}]` JSONB payload from the original file content (available as `result.rows` joined back into CSV text) and include it in the insert, matching the format used by `BulkMeterImport.tsx` and `ScadaImport.tsx`

2. **Include `area_sqm`**: If the file was assigned a tenant (via `result.tenantId`), look up that tenant's `area_sqm` from the project tenants list and include it in the insert

3. **Broaden query invalidations**: After successful imports, also invalidate:
   - `scada-imports` (used by Meter Library)
   - `meter-library` (used by Meter Library tab)
   - `load-profiles-stats` (used by Load Profiles Dashboard)
   - `scada-imports-raw` (used by meter detail/preview views)

### Technical Detail

The `raw_data` field stores the original CSV as `[{"csvContent": "<full CSV text>"}]`. The `ScadaImportWizard` already reads each file's content and stores it in `FileEntry.content`. Currently `handleComplete` in the wizard only passes `headers`, `rows`, and `columns` to the parent -- but not the raw content.

To fix this:
- Extend `ParsedFileResult` interface to include an optional `rawContent?: string` field
- In `ScadaImportWizard.handleComplete`, populate `rawContent` from `f.content`
- In `TenantManager.handleWizardComplete`, use `result.rawContent` to build the `raw_data` JSONB payload

### Files Modified
- `src/components/projects/ScadaImportWizard.tsx` -- add `rawContent` to `ParsedFileResult`, populate it in `handleComplete`
- `src/components/projects/TenantManager.tsx` -- update `handleWizardComplete` to store `raw_data`, `area_sqm`, and invalidate all relevant query keys
