
## Fix: SCADA Profile Search Truncated at 1,000 Rows

### Problem

There are **1,919** meter profiles in the database, but the query fetching profiles for assignment in `TenantManager.tsx` (line 343) relies on Supabase's default limit of **1,000 rows**. This means ~900 profiles are silently missing from the assignment dropdown -- you literally cannot find them.

### Solution

Paginate the query to fetch all results. Since the dataset is under 2,000 rows, we can safely fetch in two batches of 1,000 using `.range()`, then merge.

### Technical Details

**File: `src/components/projects/TenantManager.tsx`** (lines 331-347)

Replace the single query with a paginated fetch that retrieves all rows:

```typescript
// Fetch SCADA imports for profile assignment (filtered by scope)
const { data: scadaImports } = useQuery({
  queryKey: ["scada-imports-for-assignment", profileScope, projectId],
  queryFn: async () => {
    const PAGE_SIZE = 1000;
    let allData: ScadaImport[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from("scada_imports")
        .select("id, shop_name, site_name, area_sqm, data_points, load_profile_weekday, load_profile_weekend, meter_label, meter_color, date_range_start, date_range_end, weekday_days, weekend_days, processed_at, shop_number")
        .order("shop_name")
        .range(from, from + PAGE_SIZE - 1);

      if (profileScope === 'local') {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;

      allData = allData.concat(data as ScadaImport[]);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    return allData;
  },
});
```

### Files to Change

| File | Change |
|------|--------|
| `TenantManager.tsx` | Paginate the SCADA imports query to fetch all 1,919 rows |

### Impact

- All meter profiles will appear in the assignment dropdown
- Search will work across the full dataset
- No UI changes needed -- the dropdown and search remain identical
