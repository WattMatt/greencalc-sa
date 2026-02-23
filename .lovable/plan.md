
## Fix Load Profile and Envelope: Three Bugs

### Bug 1: Outage Threshold Too High for Individual Meters
**File: `src/components/projects/load-profile/hooks/useValidatedSiteData.ts`**

The `OUTAGE_THRESHOLD_KW = 75` is applied per meter per day. Individual AC Shop meters consume ~5-50 kW/day, so virtually all their dates are discarded. This means only the few large meters (bulk/local mains) appear in `tenantsWithRawData`, and the rest fall to fallback estimates.

**Fix:** Remove the per-meter outage filter entirely. Instead, apply an outage check at the site level in Pass 3 -- if the summed site total for a date is below a threshold (e.g. 75 kW across ALL meters combined), skip that date. This keeps the protection against site-wide outages without discarding small meters.

- Remove `OUTAGE_THRESHOLD_KW` check from the per-tenant loop (lines 100-101)
- Add a site-level outage check in Pass 3: after summing all meters for a date, if `siteHourly.reduce(sum) < SITE_OUTAGE_THRESHOLD` then skip that date

### Bug 2: Envelope Hourly Value Filter
**File: `src/components/projects/load-profile/hooks/useEnvelopeData.ts`**

Line 52: `if (val < 75) continue;` -- this skips individual hourly values at the site level. Early morning hours (00:00-05:00) naturally have low consumption (e.g. 20-50 kW), so these hours end up with `min: 0, max: 0, avg: 0` even though there is real data.

**Fix:** Remove the hourly filter entirely. Outage filtering is already handled at the date level in `useValidatedSiteData`. The envelope should reflect all valid data including naturally low nighttime consumption.

### Bug 3: Asynchronous Rendering Mismatch
**File: `src/components/projects/load-profile/index.tsx`**

The load profile renders fallback estimates immediately (before raw SCADA data loads), then updates when `rawDataMap` arrives. The envelope has no fallback, so it shows nothing until data arrives. This creates a visual disconnect.

**Fix:** Show a loading state for BOTH charts while `rawDataMap` is loading. Use `isLoadingRawData` from `useRawScadaData` to conditionally show a skeleton for the entire chart area until the shared dataset is ready. This ensures both charts appear simultaneously with the correct SCADA-based data.

- Destructure `isLoadingRawData` from `useRawScadaData`
- Wrap the chart render area: if `isLoadingRawData`, show a skeleton placeholder
- Once loaded, both charts render synchronously from the same `useMemo` data

### Technical Summary of Changes

| File | Change |
|------|--------|
| `useValidatedSiteData.ts` | Remove per-meter 75 kW filter; add site-level outage filter in Pass 3 |
| `useEnvelopeData.ts` | Remove `if (val < 75) continue` on line 52 |
| `index.tsx` | Use `isLoadingRawData` to show skeleton until data is ready, then render both charts together |
