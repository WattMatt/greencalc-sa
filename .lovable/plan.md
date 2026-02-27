

# Fix: Battery Profile TOU Period Overlay

## Problem
The Battery Profile chart in daily (day-to-day) mode does not display the Time-of-Use period background colours (Peak/Standard/Off-Peak), even though other charts like Load Profile and Grid Profile do.

## Root Cause
After investigation, the TOU overlay code **does exist** in `BatteryChart.tsx` and the correct props are being passed from `SimulationPanel.tsx`. However, the `fillOpacity` is set to `0.08` -- significantly lower than other charts which use `0.12`. Combined with the chart's white background and the fact that if no `touPeriodsOverride` is available, the fallback `getTOUPeriod(h, isWeekend)` is called **without** month or dayOfWeek context, meaning all hours may resolve to "off-peak" (a single uniform teal), rendering the overlay effectively invisible.

## Fix

### 1. Increase TOU overlay opacity in BatteryChart (match other charts)
Change `fillOpacity` from `0.08` to `0.12` to match LoadChart, GridFlowChart, SolarChart, and BuildingProfileChart.

### 2. Pass month and dayOfWeek context to BatteryChart
Update the `BatteryChart` props to accept `month` and `dayOfWeek` so the fallback `getTOUPeriod` call can correctly determine the season and distinguish Saturday from Sunday -- matching how other charts resolve TOU periods.

### 3. Pass month/dayOfWeek from SimulationPanel
Use the existing `dayDateInfo` (which already contains the date for the selected day index) to derive the month and dayOfWeek values and pass them to `BatteryChart`.

## Files Changed

| File | Change |
|------|--------|
| `src/components/projects/load-profile/charts/BatteryChart.tsx` | Increase `fillOpacity` to `0.12`; accept `month` and `dayOfWeek` props; pass them to `getTOUPeriod` fallback |
| `src/components/projects/SimulationPanel.tsx` | Derive month/dayOfWeek from `dayDateInfo` and pass to `BatteryChart` |
