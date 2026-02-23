

## Fix: Load Envelope Chart Not Rendering (0 Validated Days)

### The Problem

With 81 SCADA meters, the current overlap algorithm requires **ALL** meters to share at least one common date. It calculates `[max of all start dates, min of all end dates]`. If even one meter has a date range that doesn't overlap with the rest (e.g., Meter A has data Jan-Mar 2024, Meter B has data Jun-Dec 2024), the overlap window collapses to zero -- producing no chart data and "Validated Days: 0".

Your stats (Daily kW: 163,226) still show values because those come from pre-computed profile fallbacks, not the raw data pipeline.

### The Fix

Replace the strict "all meters must overlap" logic with a **union-based approach**: use every date where **any** meter has data, summing whichever meters are available on each date. This is the correct behaviour for a site with many independently-metered tenants.

**File: `src/components/projects/load-profile/hooks/useValidatedSiteData.ts`**

Change Pass 2 (lines 153-186) from:

```
// OLD: Find [max start, min end] across ALL meters -- too strict
let rangeStart = "", rangeEnd = "9999-12-31";
for (const tenantId of tenantsWithRawData) { ... }
```

To:

```
// NEW: Union of ALL dates from ALL meters
const dateSet = new Set<string>();
for (const tenantId of tenantsWithRawData) {
  const dateMap = tenantDateMaps.get(tenantId)!;
  dateMap.forEach((_, dateKey) => dateSet.add(dateKey));
}
allValidatedDates = Array.from(dateSet).sort();
```

Pass 3 (lines 188-206) already handles missing meters gracefully -- it skips tenants that don't have a given date (`if (!tenantHourly) continue`), so no changes needed there.

The site-level outage filter (`SITE_OUTAGE_THRESHOLD_KW = 75`) remains in place to discard dates where the aggregated total is negligible.

### Impact

- All 81 meters will contribute data on the dates they have readings
- The envelope chart will render immediately
- "Validated Days" will show the actual count of dates with data
- No changes to any other file

### Files to Change

| File | Change |
|------|--------|
| `useValidatedSiteData.ts` | Replace strict overlap (Pass 2) with union of all dates |

