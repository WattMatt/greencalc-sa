

## Fix: Ensure Stacked Meter Averaging Matches Envelope

### Current State

All three hooks (useLoadProfileData, useEnvelopeData, useStackedMeterData) correctly filter dates by selected months and days-of-week. The month/day toggles DO affect the charts.

### Issue Found

In `useStackedMeterData`, the "avg" mode counts days **per tenant** (only days where that tenant has data). The envelope averages by the **total number of filtered days** (treating missing tenant data as 0). This means:

- Envelope avg: `tenantA_total / 100_days + tenantB_total / 100_days`
- Stacked avg: `tenantA_total / 100_days + tenantB_total / 50_days` (if B only has 50 days of data)

The stacked total can be higher than the envelope avg because tenants with sparse data get averaged by fewer days.

### Fix

In `useStackedMeterData`, change the avg mode to divide by the total count of filtered dates (not per-tenant count). This ensures mathematical alignment with both the envelope and the main load profile.

### Technical Details

**File: `src/components/projects/load-profile/hooks/useStackedMeterData.ts`** (lines 177-195)

Change from per-tenant `dayCount` to using `filteredDateKeys.length` as the divisor:

```text
Current:
  for (const dateKey of filteredDateKeys) {
    const hourlyArr = dateMap.get(dateKey);
    if (!hourlyArr) continue;
    dayCount++;                               // <-- per-tenant count
    ...
  }
  tenantProfiles.set(tenantId, sumHourly.map(v => v / dayCount));

Fixed:
  for (const dateKey of filteredDateKeys) {
    const hourlyArr = dateMap.get(dateKey);
    if (!hourlyArr) continue;
    for (let h = 0; h < 24; h++) {
      sumHourly[h] += hourlyArr[h] * diversityFactor * unitMultiplier;
    }
  }
  // Divide by TOTAL filtered date count (same as envelope)
  tenantProfiles.set(tenantId, sumHourly.map(v => v / filteredDateKeys.length));
```

### Files to Change

| File | Change |
|------|--------|
| `hooks/useStackedMeterData.ts` | Use `filteredDateKeys.length` as divisor instead of per-tenant day count in avg mode |

### Result

- Stacked "Avg" total will exactly match the envelope "Avg" line
- Tenants with missing data on certain days will show proportionally lower bars (as they should)
- Month and day selection filtering continues working correctly across all views

