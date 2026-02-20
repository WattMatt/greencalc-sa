

## Fix: Slow Page Reloads and Fetch Errors After Meter Assignment

### Root Cause

The recent change to align the Load Profile and Envelope charts introduced `raw_data` into the main tenant query (line 871 of `ProjectDetail.tsx`). Each tenant's `raw_data` contains ~28,000 rows of time-series data. With 20+ tenants, the response payload is enormous (potentially tens of megabytes), causing:

1. **Extremely slow page reloads** -- every query invalidation (e.g. after assigning a meter) triggers a full refetch of this massive payload.
2. **Fetch errors ("TypeError: Failed to fetch")** -- the oversized response times out or exceeds browser/network limits, especially when multiple rapid invalidations fire in sequence (e.g. during auto-match or clear-all operations).

### Solution

Stop fetching `raw_data` in the main tenant query. Instead, fetch it separately and only when the Load Profile tab is active.

### Technical Details

**1. `src/pages/ProjectDetail.tsx` (line ~871)**

Remove `raw_data` from the main tenant query's select clause:

```
Before:
scada_imports(shop_name, area_sqm, load_profile_weekday, load_profile_weekend, raw_data, date_range_start, date_range_end, detected_interval_minutes)

After:
scada_imports(shop_name, area_sqm, load_profile_weekday, load_profile_weekend, date_range_start, date_range_end, detected_interval_minutes)
```

**2. Create a dedicated hook or query for raw data**

Add a new query (e.g. in a `useRawScadaData` hook or inline in the Load Profile section) that fetches `raw_data` only when needed:

- Query key: `["tenant-raw-data", projectId]`
- Fetches `scada_imports.raw_data` for all tenants with an assigned `scada_import_id`
- Only enabled when the Load Profile or Envelope tab is visible
- Returns a map of `scada_import_id -> raw_data` that the load profile and envelope hooks can consume

**3. Update `useLoadProfileData.ts` and `useEnvelopeData.ts`**

Accept the raw data map as an optional prop. When raw data is available, use it; otherwise fall back to the pre-computed profile arrays (the existing fallback logic already handles this).

**4. `src/pages/ClientPortal.tsx` (line ~65)**

Apply the same fix -- remove `raw_data` from the select clause there as well, since client portal does not need it in the main query.

### What stays the same

- The raw-data-based calculation logic in `useLoadProfileData.ts` (the `computeHourlyFromRawData` function)
- The envelope chart logic
- All meter assignment, auto-match, and clear operations
- Diversity factor, area scaling, day multipliers
- The `parseRawData` shared utility

### Expected outcome

- Tenant queries return in milliseconds instead of seconds
- Meter assignments, auto-match, and clear operations no longer trigger massive refetches
- Load profile and envelope charts still use raw time-series data when viewing those tabs
- No more "TypeError: Failed to fetch" errors

