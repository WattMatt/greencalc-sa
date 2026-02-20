

## Fix: Tenant Meter Assignment Display Independent of Global/Local Toggle

### Problem

The assigned meter display in each tenant row depends on the `scadaImports` array, which is filtered by the Global/Local toggle (`profileScope`). When switching scope, previously assigned meters may not be found in the filtered list, causing them to show as "Unassigned" even though the assignment still exists in the database.

The root cause is on line 1142 of `TenantManager.tsx`:
```
const assignedProfile = scadaImports?.find(m => m.id === tenant.scada_import_id);
```

`scadaImports` is scope-filtered, so if the assigned meter falls outside the current scope, it resolves to `undefined` and displays "Unassigned".

### Solution

Separate the **display data** from the **dropdown options**:

1. Add a second query (`assignedScadaImports`) that fetches ONLY the SCADA imports currently assigned to tenants, with NO scope filter. This is used purely for displaying the assigned meter name in the button label and preview icon.

2. Keep the existing `scadaImports` query (scope-filtered) for populating the dropdown options list only.

3. Update the `assignedProfile` lookup (line 1142) to first check the unfiltered `assignedScadaImports`, falling back to `scadaImports`.

### Technical Details

**File: `src/components/projects/TenantManager.tsx`**

Add a new query after the existing `scadaImports` query (~line 333):

```typescript
// Fetch assigned SCADA imports (unfiltered) for display purposes
const assignedScadaIds = tenants
  .map(t => t.scada_import_id)
  .filter(Boolean) as string[];

const { data: assignedScadaImports } = useQuery({
  queryKey: ["assigned-scada-display", assignedScadaIds],
  queryFn: async () => {
    if (assignedScadaIds.length === 0) return [];
    const { data, error } = await supabase
      .from("scada_imports")
      .select("id, shop_name, site_name, area_sqm, data_points, ...")
      .in("id", assignedScadaIds);
    if (error) throw error;
    return data as ScadaImport[];
  },
  enabled: assignedScadaIds.length > 0,
});
```

Update the `assignedProfile` lookup (line 1142):

```typescript
const assignedProfile = tenant.scada_import_id
  ? (scadaImports?.find(m => m.id === tenant.scada_import_id)
     ?? assignedScadaImports?.find(m => m.id === tenant.scada_import_id))
  : undefined;
```

This ensures:
- The **dropdown list** is still filtered by Global/Local scope (controlling what new assignments are available).
- The **displayed assignment** always resolves correctly, regardless of toggle state.
- No database schema changes required.

