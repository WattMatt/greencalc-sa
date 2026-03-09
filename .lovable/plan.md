

# Fix: Add `load_profile_weekday` Fallback to Meter Library Preview

## Problem

Both `MeterProfilePreview` (Meter Library) and `ScaledMeterPreview` (Tenants page) rely entirely on `useDailyConsumption` which parses `raw_data` from the database. When `raw_data` is empty, improperly formatted, or missing, the preview shows "No daily data available" — even when `load_profile_weekday` and `load_profile_weekend` summary arrays are populated and valid.

The tenant-imported meter (`PDB_36506616_SolarDB2.1`) works because it stores `raw_data` in the legacy `{ timestamp, value }` format that the hooks already handle. The library-imported meter (`PDB_36506616_SolarDB2.12`) either has empty `raw_data` or a format mismatch.

## Solution

Add a fallback in `MeterProfilePreview` so that when `totalDays === 0` (no parseable raw interval data), it renders the 24-hour bar chart from `load_profile_weekday` / `load_profile_weekend` arrays with a weekday/weekend toggle — exactly as the user expects from the tenant page experience.

## Changes

### File: `src/components/loadprofiles/MeterProfilePreview.tsx`

Replace the `totalDays === 0` empty state block (~line 290-293) with a fallback that:

1. Checks if `meter.load_profile_weekday` exists and has data
2. If yes, shows:
   - A **Weekday / Weekend** toggle (tabs or buttons)
   - Summary stat cards derived from the profile arrays:
     - Daily kWh = `sum(profile)`
     - Peak kW = `max(profile)`
     - Peak Hour = `indexOf(max)`
   - The 24-hour bar chart using the existing `createChartData()` and `renderChart()` helpers
3. If no summary arrays either, show the current "No daily data available" message

**Specific structure inside the `totalDays === 0` block:**

```
if (load_profile_weekday has data) {
  → useState for profileType: 'weekday' | 'weekend'
  → Derive stats from the active profile array
  → Render stat cards (Daily kWh, Peak kW, Peak Hour)
  → Render bar chart via createChartData(profile, isWeekend) + renderChart()
  → Show info badge: "Summary Profile (no raw interval data)"
} else {
  → Current empty message
}
```

No new files. No new dependencies. Reuses existing `createChartData` and `renderChart` already in the component. The `profileType` state will be added at the top of the component alongside existing state.

## Files affected
- `src/components/loadprofiles/MeterProfilePreview.tsx`

