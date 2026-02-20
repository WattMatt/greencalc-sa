

## Add Column Mapping to Tenant Import

### Problem
When importing tenant data (CSV or Excel), the current flow auto-detects columns by header name. Users cannot manually select which columns map to **Shop Number**, **Shop Name**, and **Area**. If the headers are non-standard, the import fails or picks wrong columns.

### Solution
Add a **column mapping step** after the CSV Import Wizard finishes parsing. This mimics the column-role-assignment pattern already used in the Generation tab's `CSVPreviewDialog` -- click a column header to assign it as "Shop Number", "Shop Name", or "Area".

### How It Works

1. User clicks **Import** and selects a CSV or Excel file
2. The existing `CsvImportWizard` opens for delimiter/parse configuration (Steps 1-3)
3. **Skip Step 4** (load profile column selection -- not relevant for tenant data)
4. A **new `TenantColumnMapper` dialog** opens showing the parsed data in a table
5. User clicks column headers to assign roles: **Shop Number** (optional), **Shop Name** (required), **Area** (required)
6. Only mapped columns are used to create tenants

### New File

**`src/components/projects/TenantColumnMapper.tsx`**

A dialog component with:
- A data preview table showing parsed headers and first ~50 rows
- Dropdown on each column header to assign a role: Shop Number, Shop Name, Area (m2), or Skip
- Auto-detection as a starting suggestion (pre-selects columns based on header names, user can override)
- Visual highlighting: assigned columns get colour-coded backgrounds (like the Generation CSV dialog)
- "Import" button enabled only when Shop Name and Area are both assigned
- Row count summary

### Modified File

**`src/components/projects/TenantManager.tsx`**

- Add state for the column mapper dialog (`columnMapperOpen`, `columnMapperData`)
- Change `processWizardData` to **not process tenants directly** -- instead, store the parsed data and open the `TenantColumnMapper`
- New `handleMappedImport` callback receives the user's column selections and creates tenants using only those mapped columns
- The wizard's Step 4 is skipped by finishing at Step 3 (the wizard already supports this via `onProcess` being called)

### Technical Details

- Reuses the same dropdown-on-header pattern from `CSVPreviewDialog` (DropdownMenu on table headers)
- Column roles: `"shop_number" | "shop_name" | "area" | null`
- Icons: `Hash` for Shop Number, `Store` for Shop Name, `Ruler` for Area (from lucide-react)
- Auto-detect logic moved from `processWizardData` into the mapper as initial suggestions
- Existing `detectCsvType` validation still runs before showing the mapper
- No new dependencies required

