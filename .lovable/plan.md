

# Plan: Bulk Create Tenants from Meter Library with Auto-Extract

## What this does

Adds a new action to the Tenants tab that lets you select meters from the meter library and bulk-create tenants from them in one go. The system will parse the meter's `shop_name` / `site_name` to extract the **tenant name** and **area (m2)**, then create `project_tenants` records with the meter already assigned.

## How the name/area extraction works

Your meter labels follow the pattern:
```text
PDB_36506603_HomeEssentials_3365m2
PDB_35775424_Dischem_1462m2
PDB_36085238_Sorbet_87m2
```

The parser will:
1. Split by `_` and identify the **shop name** segment (after the numeric meter ID) and the **area** segment (ending in `m2`)
2. Extract shop number from the PDB meter ID (e.g. `36506603`)
3. Convert camelCase names to spaced names (e.g. `HomeEssentials` → `Home Essentials`, `BurgerKingDT` → `Burger King DT`)
4. For non-PDB labels (e.g. `Woolworths`, `ABC FINANCE`), use the full `shop_name` as tenant name with area defaulting to `0`

## UI Flow

1. New button in TenantManager toolbar: **"Import from Meter Library"**
2. Opens a dialog showing all global meters (`project_id IS NULL`) with checkboxes
3. Each row shows: meter label, **extracted shop name** (editable), **extracted area** (editable), and a preview of data availability
4. User reviews/adjusts extractions, then clicks **"Create Tenants"**
5. System bulk-inserts `project_tenants` records with `scada_import_id` already set, plus copies each selected meter as a local project meter (same as existing wizard pattern)

## Files to change

### 1. New file: `src/utils/meterLabelParser.ts`
Pure utility function to parse meter labels:
- `parseMeterLabel(label: string) → { shopName: string, shopNumber: string | null, areaSqm: number }`
- Handles PDB pattern, camelCase splitting, area extraction
- Falls back gracefully for non-standard labels

### 2. New file: `src/components/projects/MeterLibraryImportDialog.tsx`
Dialog component:
- Fetches global meters from `scada_imports` where `project_id IS NULL` and `data_points > 0`
- Displays parsed results in an editable table
- Select-all / individual checkboxes
- On confirm: creates local meter copies + `project_tenants` records with assignments

### 3. Edit: `src/components/projects/TenantManager.tsx`
- Add "Import from Meter Library" button to the toolbar (alongside existing CSV import and wizard buttons)
- Wire up the new dialog

## No database changes needed
Uses existing `scada_imports` and `project_tenants` tables as-is.

