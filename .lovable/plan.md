

## Fix: Max/Min Should Use the Single Peak/Trough Day, Not Per-Hour Cherry-Picking

### Problem

Both the Envelope and Stacked Meter hooks currently find the best day **independently for each hour**. This means the "Max" line might use Monday's value at 09:00, Tuesday's at 10:00, Wednesday's at 11:00, etc. -- creating an artificial profile that never actually occurred. The same issue applies to the "Min" line.

### Correct Behaviour

- **Max**: Find the single day (within the filtered period) that has the **highest total site demand** (sum across all 24 hours). Use that day's full 24-hour profile as the max line.
- **Min**: Find the single day with the **lowest total site demand**. Use that day's full 24-hour profile as the min line.
- **Avg**: No change -- remains the average across all filtered days.

This means the Max and Min lines represent **real days that actually occurred**, not theoretical composites.

### Technical Details

**File: `src/components/projects/load-profile/hooks/useEnvelopeData.ts`**

Replace the per-hour min/max scan (lines 169-197) with:

1. First pass: iterate all filtered day arrays to find the day with the highest total (sum of 24 hours) and the day with the lowest total.
2. Second pass: build the result using those two specific days for min/max, and the existing average calculation.

```text
// Step 1: Find peak and trough days
let maxDayArr = null, minDayArr = null;
let maxDayTotal = -Infinity, minDayTotal = Infinity;

for (const dayArr of filteredEntries) {
  let dayTotal = 0;
  for (let h = 0; h < 24; h++) {
    dayTotal += (dayArr[h] + fallbackH[h]) * diversityFactor;
  }
  if (dayTotal > maxDayTotal) { maxDayTotal = dayTotal; maxDayArr = dayArr; }
  if (dayTotal < minDayTotal) { minDayTotal = dayTotal; minDayArr = dayArr; }
}

// Step 2: Build result using those specific days
for (let h = 0; h < 24; h++) {
  const fallbackH = fallbackHourlyTotal[h];
  const maxVal = ((maxDayArr[h] + fallbackH) * diversityFactor) * unitMultiplier;
  const minVal = ((minDayArr[h] + fallbackH) * diversityFactor) * unitMultiplier;
  // avg stays the same (sum across all days / count)
  ...
}
```

**File: `src/components/projects/load-profile/hooks/useStackedMeterData.ts`**

Replace the per-hour day selection (lines 196-226) with:

1. First pass: find the single dateKey with the highest (or lowest) site-wide daily total across all 24 hours.
2. Second pass: extract each tenant's full 24-hour profile from that specific day.

```text
// Find the single best day for the entire 24-hour profile
let bestDateKey = null;
let bestTotal = mode === "max" ? -Infinity : Infinity;

for (const dateKey of filteredDateKeys) {
  const siteHourly = siteDataByDate.get(dateKey);
  if (!siteHourly) continue;
  let dayTotal = 0;
  for (let h = 0; h < 24; h++) {
    dayTotal += (siteHourly[h] + fallbackHourly[h]) * diversityFactor;
  }
  if (mode === "max" ? dayTotal > bestTotal : dayTotal < bestTotal) {
    bestTotal = dayTotal;
    bestDateKey = dateKey;
  }
}

// Use that single day's data for all tenants
if (bestDateKey) {
  for (const tenantId of tenantsWithRawData) {
    const dateMap = tenantDateMaps.get(tenantId);
    const hourlyArr = dateMap?.get(bestDateKey);
    const profile = Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      profile[h] = (hourlyArr?.[h] ?? 0) * diversityFactor * unitMultiplier;
    }
    tenantProfiles.set(tenantId, profile);
  }
}
```

### Files to Change

| File | Change |
|------|--------|
| `hooks/useEnvelopeData.ts` | Find single peak/trough day by daily total, use its full profile for max/min lines |
| `hooks/useStackedMeterData.ts` | Same logic -- find single best day, extract all tenant values from that day |

### Result

- The Max line represents the actual 24-hour profile of the day with the highest total demand
- The Min line represents the actual 24-hour profile of the day with the lowest total demand
- Both charts (Envelope and By Meter) will show the same real-day profiles
- The stacked tenant breakdown will show exactly how each tenant contributed on that specific peak/trough day
