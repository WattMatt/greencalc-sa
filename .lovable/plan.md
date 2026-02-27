
# Fix: TOU Period Backgrounds on All Profile Charts

## Problem

The Time-of-Use background colours on the simulation profile charts (Building, Load, Grid, PV, Battery) do not reflect the TOU periods configured in Settings. Multiple issues exist in how TOU periods are resolved:

### Issue 1: Annual Average hardcodes low-season weekday
When `showAnnualAverage` is true, `touPeriodsForDay` is hardcoded to use `settings.lowSeason.weekday` (line 931 of SimulationPanel.tsx). This ignores the user's actual high-season months and any Saturday/Sunday configurations.

### Issue 2: Fallback `getTOUPeriod(h, isWeekend)` omits month and dayOfWeek
When `touPeriodsOverride` is not provided or is `undefined`, every chart falls back to calling `getTOUPeriod(h, isWeekend)` without passing `month` or `dayOfWeek`. The function then defaults `isHighSeason` to `false` (always low season) and uses the generic `saturday` map for all weekends, ignoring any Sunday-specific configuration.

### Issue 3: Non-simulation charts (Envelope, Stacked Meter) never receive overrides
`LoadEnvelopeChart` and `StackedMeterChart` call `getTOUPeriod(h, isWeekend)` directly without any override mechanism, so they always show low-season periods regardless of the actual month being viewed.

## Fix

### 1. Fix Annual Average TOU display (SimulationPanel.tsx)

When showing the annual average, TOU backgrounds should either be hidden entirely (since the average spans all seasons and day types) or shown as a representative low-season weekday from the user's configured settings. The current approach already returns low-season weekday from `touSettingsData` -- but the problem is if `touSettingsData` is stale or the user expects it to match a specific day.

**Decision:** For annual average, hide TOU backgrounds entirely (`showTOU` is already `!showAnnualAverage`, so this is handled). But `touPeriodsForDay` for annual average is still computed and may be used elsewhere. Remove the annual-average branch from `touPeriodsForDay` and return `undefined` instead, since `showTOU` is already false.

### 2. Ensure dailySlice provides correct TOU from settings (SimulationPanel.tsx)

The daily mode path is: `touSettingsData` -> `runAnnualEnergySimulation` -> `buildAnnualCalendar(touSettings)` -> `day.hourMap` -> `touPeriod`. This chain correctly uses the settings hook value. Verify that `touSettingsData` is the same object used everywhere.

**No change needed** -- this path is correct as long as `useTOUSettings()` returns the user's configured values.

### 3. Pass month and dayOfWeek to fallback getTOUPeriod calls in all chart components

Update these chart components so their fallback `getTOUPeriod` calls include `month` and `dayOfWeek`:

| File | Change |
|------|--------|
| `BuildingProfileChart.tsx` | Add `month` and `dayOfWeek` props; pass to `getTOUPeriod` fallback |
| `LoadChart.tsx` | Add `month` and `dayOfWeek` props; pass to `getTOUPeriod` fallback |
| `GridFlowChart.tsx` | Add `month` and `dayOfWeek` props; pass to `getTOUPeriod` fallback |
| `SolarChart.tsx` | Add `month` and `dayOfWeek` props; pass to `getTOUPeriod` fallback |
| `BatteryChart.tsx` | Already has `month` and `dayOfWeek` props -- no change needed |
| `LoadEnvelopeChart.tsx` | Add `month` and `dayOfWeek` props; pass to `getTOUPeriod` |
| `StackedMeterChart.tsx` | Add `month` and `dayOfWeek` props; pass to `getTOUPeriod` |

### 4. Pass month and dayOfWeek from SimulationPanel to all charts

In `SimulationPanel.tsx`, each chart rendering already has access to `dayDateInfo.month` and `dayDateInfo.dayOfWeek`. Add these as props to every chart call that doesn't already have them:

```tsx
<BuildingProfileChart
  chartData={simulationChartData}
  showTOU={!showAnnualAverage}
  isWeekend={loadProfileIsWeekend}
  unit="kW"
  includesBattery={...}
  touPeriodsOverride={touPeriodsForDay}
  month={dayDateInfo.month}
  dayOfWeek={dayDateInfo.dayOfWeek}
/>
```

Same pattern for LoadChart, GridFlowChart, and SolarChart.

### 5. Update non-simulation Load Profile component (index.tsx)

The `LoadProfileChart` component (load-profile/index.tsx) renders the Envelope and Stacked charts. It must also pass `month` and `dayOfWeek` to these sub-charts. Since the load profile view shows day-type averages (weekday vs weekend) rather than specific calendar days, use the selected day-of-week and a representative month from the selected months set.

## Files Changed

| File | Change |
|------|--------|
| `SimulationPanel.tsx` | Simplify `touPeriodsForDay` annual-average branch to return `undefined`; add `month`/`dayOfWeek` props to BuildingProfileChart, LoadChart, GridFlowChart, SolarChart calls |
| `BuildingProfileChart.tsx` | Add optional `month`/`dayOfWeek` props; use in `getTOUPeriod` fallback |
| `LoadChart.tsx` | Add optional `month`/`dayOfWeek` props; use in `getTOUPeriod` fallback |
| `GridFlowChart.tsx` | Add optional `month`/`dayOfWeek` props; use in `getTOUPeriod` fallback |
| `SolarChart.tsx` | Add optional `month`/`dayOfWeek` props; use in `getTOUPeriod` fallback |
| `LoadEnvelopeChart.tsx` | Add optional `month`/`dayOfWeek` props; pass to `getTOUPeriod` calls |
| `StackedMeterChart.tsx` | Add optional `month`/`dayOfWeek` props; pass to `getTOUPeriod` calls |
| `load-profile/index.tsx` | Pass `month`/`dayOfWeek` to envelope and stacked chart components |
