

## Add Local/Global Meter Toggle and Project-Scoped CSV Import

### Overview
This feature adds two capabilities to the Tenants tab:

1. **Re-enable the Import button** to upload CSV meter data files (one per tenant) that get processed and saved to `scada_imports` with the current `project_id`, making them "local" to this project.

2. **Add a Global/Local toggle switch** next to the "Load Profile" column header in the tenant table. When toggled to "Local", the profile dropdown only shows meters belonging to this project. When set to "Global" (default), it shows all meters. A tooltip explains the current state.

All imported meters remain in the single `scada_imports` table and are visible from the Load Profiles dashboard -- they simply have `project_id` set so the toggle can filter them.

### User Workflow

1. User clicks the **Import** button in the Tenants toolbar
2. The existing `ScadaImportWizard` opens -- user uploads one or more CSV files (one per tenant/meter)
3. On completion, each file is processed via `processCSVToLoadProfile` and saved to `scada_imports` with `project_id` set to the current project
4. User flips the **Load Profile** toggle to "Local"
5. All tenant profile dropdowns now only show the project-scoped meters
6. User assigns each tenant to their corresponding local meter

### Technical Changes

**File: `src/components/projects/TenantManager.tsx`**

1. **Re-enable the Import button** -- remove `disabled` from the Import button so it opens the `ScadaImportWizard`

2. **Update `handleWizardComplete`** -- instead of just opening the `TenantColumnMapper`, process each file's parsed CSV data through `processCSVToLoadProfile` and insert results into `scada_imports` with `project_id = projectId`. Each file creates one meter record (using the file name or assigned tenant name as `shop_name`/`site_name`).

3. **Add `profileScope` state** -- a `useState<'global' | 'local'>('global')` toggle state

4. **Filter `scadaImports` query** -- when scope is `'local'`, add `.eq('project_id', projectId)` to the query; when `'global'`, fetch all (existing behaviour)

5. **Add toggle UI** -- in the table header row, next to the "Load Profile" `<TableHead>`, add a small `Switch` component with a `Tooltip`:
   - Off (default) = Global -- tooltip: "Showing all meters from the global library"  
   - On = Local -- tooltip: "Showing only meters imported for this project"
   - Label text next to switch: "Local" (small, muted)

6. **Import `processCSVToLoadProfile`** from `@/components/loadprofiles/utils/csvToLoadProfile` and `Switch` from `@/components/ui/switch`

**No database changes required** -- the `scada_imports` table already has a `project_id` column.

**No new files** -- all changes are within `TenantManager.tsx`.

### Import Processing Logic (inside `handleWizardComplete`)

For each `ParsedFileResult` returned by the wizard:
- Call `processCSVToLoadProfile(result.headers, result.rows, defaultConfig)` to produce weekday/weekend profiles, data points, date ranges
- Insert into `scada_imports` with:
  - `project_id`: current project ID
  - `site_name`: project name or file name
  - `shop_name`: the tenant name (if assigned in wizard) or file name
  - `load_profile_weekday` / `load_profile_weekend`: from processed profile
  - `data_points`, `date_range_start`, `date_range_end`, etc.
- Invalidate the `scada-imports-for-assignment` query so the dropdown refreshes
- Toast success with count of meters imported

