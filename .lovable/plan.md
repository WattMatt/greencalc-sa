

## Fix: Raw SCADA Data Query Returns Empty (Root Cause of Missing Graph)

### Problem

The `useRawScadaData` hook queries `scada_imports` with `.eq("project_id", projectId)`, but the `scada_imports` records linked to this project's tenants have `project_id = NULL`. The relationship is indirect: `project_tenants.scada_import_id -> scada_imports.id`. Since the filter matches nothing, the `rawDataMap` is always empty, so `useValidatedSiteData` finds zero raw entries for every tenant, producing 0 validated days and no graph.

Database evidence:
- `scada_imports WHERE project_id = '984ce...'` returns **0 rows**
- `scada_imports` joined via `project_tenants.scada_import_id` returns **24 rows with raw_data**

### Solution

Change the `useRawScadaData` hook to collect all `scada_import_id` values from the tenants (both direct and multi-meter) and fetch those specific IDs, rather than filtering by `project_id`.

### Technical Details

**File: `src/components/projects/load-profile/hooks/useRawScadaData.ts`**

1. Accept `tenants` as a prop instead of (or in addition to) `projectId`
2. Collect all unique `scada_import_id` values from:
   - `tenant.scada_import_id` (direct link)
   - `tenant.tenant_meters[].scada_import_id` (multi-meter)
3. Query `scada_imports` using `.in("id", allIds)` instead of `.eq("project_id", ...)`
4. Paginate if needed (the set is ~24 IDs for this project, well under 1000)

```typescript
// Before
const { data, error } = await supabase
  .from("scada_imports")
  .select("id, raw_data, value_unit")
  .eq("project_id", projectId)
  .not("raw_data", "is", null);

// After: collect IDs from tenants, then fetch by ID
const scadaIds = new Set<string>();
for (const t of tenants) {
  if (t.scada_import_id) scadaIds.add(t.scada_import_id);
  if (t.tenant_meters) {
    for (const m of t.tenant_meters) {
      if (m.scada_import_id) scadaIds.add(m.scada_import_id);
    }
  }
}
const ids = Array.from(scadaIds);
if (ids.length === 0) return {};

const { data, error } = await supabase
  .from("scada_imports")
  .select("id, raw_data, value_unit")
  .in("id", ids)
  .not("raw_data", "is", null);
```

**File: `src/components/projects/load-profile/index.tsx`**

Update the call site to pass `tenants` to the hook:

```typescript
// Before
const { rawDataMap, isLoadingRawData } = useRawScadaData({ projectId });

// After
const { rawDataMap, isLoadingRawData } = useRawScadaData({ tenants });
```

### Files to Change

| File | Change |
|------|--------|
| `useRawScadaData.ts` | Replace `project_id` filter with tenant-derived ID lookup |
| `index.tsx` (load-profile) | Pass `tenants` prop to the hook |

### Impact

- The 24 scada_imports with raw data will be fetched correctly
- `useValidatedSiteData` will process them into validated days
- The Load Envelope chart will render with actual data

