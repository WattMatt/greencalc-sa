

# Filter Council Meters from Downtime and Performance Tabs

## Problem
The "31190 - Parkdene Solar Checkers" council meter source appears in the Down Time and Performance summary tables because it has `actual_kwh` values. The current filter only checks for `actual_kwh > 0`, which is insufficient to distinguish solar PV sources from council meters.

## Solution
After building the guarantee map, filter `distinctReadingSources` to only include sources that ended up with a non-zero guarantee. Sources without guarantees are not solar PV sources and should be excluded from the summary tables.

## Technical Details

**File: `src/components/projects/generation/PerformanceSummaryTable.tsx`**

After the guarantee mapping logic (around line 193), add a filtering step:

```typescript
// Remove sources that have no guarantee assigned (council/building meters)
for (const src of distinctReadingSources) {
  if (!guaranteeMap.has(src) || (guaranteeMap.get(src) ?? 0) <= 0) {
    distinctReadingSources.delete(src);
  }
}
```

Additionally, in the reading processing loop (lines 217-237), skip readings from sources not in `distinctReadingSources` to avoid counting council meter data in the daily totals:

```typescript
if (readings) {
  for (const r of readings) {
    // ...existing lookup code...
    const sourceLabel = r.source || "csv";
    
    // Skip sources not in our filtered solar PV set
    if (!distinctReadingSources.has(sourceLabel)) continue;
    
    // ...rest of processing...
  }
}
```

This ensures the daily `actual` totals, downtime calculations, and all downstream tabs (Production, Down Time, Revenue, Performance) only reflect solar PV generation data backed by guarantees.
