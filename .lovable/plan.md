

## Fix: Solar Sun Hours Should Include Peak Rates

### Problem
`calculateSolarHoursBlendedRate()` (line 309-326) hardcodes only Standard and Off-Peak rates, ignoring Peak entirely. The comment says "ZERO Peak TOU exposure" — but with a 06:00–18:00 window, peak hours **do** fall within the solar window depending on TOU settings.

The `countSolarTOUHours()` function correctly counts peak hours in the window, so `ANNUAL_HOURS_SOLAR[season].peak` is non-zero. These peak hours inflate the `total` denominator, but peak rate × peak hours is missing from the numerator → blended rate is artificially low.

### Fix
**File: `src/lib/tariffCalculations.ts`** (lines 309-326)
- Add `peakRate = getCombinedRate(rates, 'Peak', season, tariff)` 
- Include `hours.peak * peakRate` in the weighted sum (same pattern as All Hours)
- Update the comment to remove the "ZERO Peak TOU exposure" assumption

This makes the solar calculation use the same formula as All Hours — the **only** difference becomes the hour window (06:00–18:00 vs 00:00–24:00), which is exactly what you'd expect.

