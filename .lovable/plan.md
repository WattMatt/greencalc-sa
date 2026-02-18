

## Remove PnP SCADA Live Sync Functionality

### What Gets Removed

The external PnP SCADA connection — the feature that attempts to connect to `thukela-kadesh.pnpscada.com` to list meters and download CSVs in real-time. This has never worked reliably due to session/proxy constraints.

### What Stays (Unchanged)

The `scada_imports` database table, the `process-scada-profile` edge function, and all CSV upload workflows. These are your local meter data store used by Load Profiles, Tenant Matching, Simulation, and Monthly Reports. They just happen to be named "scada" but have nothing to do with the live PnP SCADA connection.

### Changes

**1. Delete edge function: `supabase/functions/fetch-pnpscada/index.ts`**
- Remove the entire function directory
- Delete the deployed function from the backend

**2. Update `src/components/projects/generation/GenerationTab.tsx`**
- Remove the `SyncScadaDialog` import
- Remove the `syncOpen` state and the "Sync SCADA" button
- Remove the `<SyncScadaDialog>` component render

**3. Delete `src/components/projects/generation/SyncScadaDialog.tsx`**
- The entire file is no longer needed

**4. Update `src/components/code-review/ProjectFileBrowser.tsx`**
- Remove the `fetch-pnpscada` entry from the file tree listing

### Files Not Touched

These files reference `scada_imports` (the local CSV data store) and are unrelated to the live sync:
- `src/components/loadprofiles/ScadaImport.tsx` (CSV upload UI)
- `src/components/loadprofiles/PivotTable.tsx` (data analysis)
- `src/components/loadprofiles/hooks/useMonthlyConsumption.ts`
- `src/components/projects/load-profile/hooks/useMonthlyData.ts`
- `src/components/projects/TenantProfileMatcher.tsx`
- `src/components/loadprofiles/ExcelAuditReimport.tsx`
- `supabase/functions/process-scada-profile/index.ts` (CSV processing)
- All simulation and monthly report data hooks

