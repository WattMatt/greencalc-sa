

# Refactor Profile Charts: Daily Day-by-Day Navigation + Annual Average from 8,760-Hour Data

## Overview

Replace the current day-of-week navigation (Mon-Sun) and High/Low Demand toggle with a **day-of-year navigator** (Day 1 = Jan 1 through Day 365 = Dec 31). Each day shows the actual 24-hour slice from the annual simulation's `hourlyData`. The Annual Average mode averages all 365 days into one composite 24-hour profile. The High/Low Demand toggle is removed entirely.

## Changes

### 1. SimulationPanel.tsx -- State and Navigation

**Remove:**
- `selectedDay` (DayOfWeek state -- "Wednesday", etc.)
- `showHighSeason` state and its `localStorage` persistence
- `navigateDay` callback (prev/next cycling through days of week)

**Add:**
- `selectedDayIndex` state (number, 0-364) -- the day-of-year index matching `AnnualHourlyEnergyData.dayIndex`
- `navigateDayIndex` callback: prev/next that clamps to 0-364
- A date label derived from `dayIndex` (e.g. dayIndex 0 = "1 January", dayIndex 181 = "1 July")

### 2. SimulationPanel.tsx -- Chart Data Extraction

**Replace `representativeDay` memo** with two new memos:

```text
// Daily: extract the exact 24h slice for selectedDayIndex
const dailySlice = annualEnergyResults.hourlyData
  .filter(h => h.dayIndex === selectedDayIndex);
// Should always return exactly 24 entries

// Annual Average: average all 365 days by hour
const annualAverageSlice = Array.from({ length: 24 }, (_, h) => {
  const hourEntries = annualEnergyResults.hourlyData
    .filter(d => parseInt(d.hour) === h);
  // Average each numeric field across all 365 entries for that hour
  return {
    hour: `${h.toString().padStart(2, '0')}:00`,
    load: avg(hourEntries, 'load'),
    solarUsed: avg(hourEntries, 'solarUsed'),
    gridImport: avg(hourEntries, 'gridImport'),
    gridExport: avg(hourEntries, 'gridExport'),
    batteryCharge: avg(hourEntries, 'batteryCharge'),
    batteryDischarge: avg(hourEntries, 'batteryDischarge'),
    ...
  };
});
```

**Update `simulationChartData`** to use `dailySlice` or `annualAverageSlice` based on `showAnnualAverage`.

### 3. SimulationPanel.tsx -- TOU Background Context

**Daily view:** Each day's 24 hours already have `touPeriod` tagged in the annual data. Pass this per-hour TOU info to the chart so the TOU background colours are derived from the actual data (not from a representative month).

**Annual Average view:** Use low-demand season TOU periods for the background (as specified by user).

This requires updating `BuildingProfileChart` (and `LoadChart`, `GridFlowChart`, `SolarChart`) to accept an optional `touPeriodsOverride: TOUPeriod[]` array (24 entries). When provided, use it instead of calling `getTOUPeriod()` with a representative month.

### 4. SimulationPanel.tsx -- Remove High/Low Demand Toggle

Remove all three instances of the High/Low Demand `Switch` from the Building Profile, Load Profile, and Grid Profile tab headers. Also remove the `isHighSeason` prop from chart components and `TOULegend`.

### 5. BuildingProfileChart.tsx (and other chart components)

**Add optional prop:** `touPeriodsOverride?: string[]` (24 entries, one per hour)

When provided:
- Use `touPeriodsOverride[h]` instead of `getTOUPeriod(h, isWeekend, undefined, representativeMonth)` for ReferenceArea fills and tooltip badges
- Remove `isHighSeason` prop (no longer needed)

### 6. SimulationPanel.tsx -- Header Display

**Daily mode title:** Show the actual date, e.g. "15 June (Day 166)" with season and day-type badges derived from the annual data (e.g. "High Demand | Weekday")

**Annual Average title:** "Annual Average (Year 1)" (unchanged)

### 7. useLoadProfileData Integration

The `selectedDays` and `selectedMonths` passed to `useLoadProfileData` need updating:
- **Daily mode:** Pass the specific day-of-week and month for that `dayIndex`
- **Annual Average:** Pass all days/months (current behaviour)

## Files Changed

| File | Change |
|------|--------|
| `src/components/projects/SimulationPanel.tsx` | Replace day-of-week nav with day-of-year (0-364) nav; remove `showHighSeason`; extract daily slice and annual average from annual data; pass `touPeriodsOverride` to charts; update `useLoadProfileData` params |
| `src/components/projects/load-profile/charts/BuildingProfileChart.tsx` | Add `touPeriodsOverride` prop; use per-hour TOU from data instead of `getTOUPeriod()` with representative month; remove `isHighSeason` |
| `src/components/projects/load-profile/charts/LoadChart.tsx` | Same: add `touPeriodsOverride`, remove `isHighSeason` |
| `src/components/projects/load-profile/charts/GridFlowChart.tsx` | Same pattern |
| `src/components/projects/load-profile/charts/SolarChart.tsx` | Same pattern |
| `src/components/projects/load-profile/components/TOULegend.tsx` | Remove `isHighSeason` prop; derive legend from provided TOU periods or default to showing all three period types |

## Expected Result

- User can scroll from Day 1 (1 January) to Day 365 (31 December), seeing the exact simulation output for each day with correct TOU backgrounds
- Annual Average shows a true 365-day average with low-demand TOU backgrounds
- No more High/Low Demand toggle -- the TOU context is derived from the actual day's data
