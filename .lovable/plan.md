

# Plan: Add Meter Data Prefix field to projects

## Overview
Add a `meter_data_prefix` column to the `projects` table (e.g. "PDB") that the user sets in the Project Parameters panel. The Import from Library dialog then uses this prefix to filter meters, replacing the hardcoded `PDB_` filter.

## Changes

### 1. Database migration
Add a nullable `meter_data_prefix` text column to the `projects` table:
```sql
ALTER TABLE public.projects ADD COLUMN meter_data_prefix text;
```

### 2. `src/pages/ProjectDetail.tsx` — Dashboard parameters
- Add `meterDataPrefix: string` to `DashboardParams` interface.
- Initialise from `project.meter_data_prefix`.
- Add an input field in the Project Parameters card (after Client Name), labelled "Meter File Prefix" with placeholder "e.g. PDB".
- Include `meter_data_prefix` in the `saveParams` update call.
- Sync in the `useEffect` that watches project prop changes.

### 3. `src/components/projects/MeterLibraryImportDialog.tsx`
- Accept a new prop `meterDataPrefix?: string`.
- Replace the hardcoded `.or("shop_name.ilike.PDB_%,meter_label.ilike.PDB_%,file_name.ilike.PDB_%")` with a dynamic filter using the prefix. If no prefix is set, show an empty state telling the user to set one in Project Parameters.

### 4. `src/components/projects/TenantManager.tsx`
- Pass the project's `meter_data_prefix` through to `MeterLibraryImportDialog` as a prop.

### 5. `src/components/projects/ProjectOverview.tsx`
- Display the meter prefix in the Project Details grid if set.

No other files affected.

