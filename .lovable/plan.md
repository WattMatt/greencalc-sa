
# Fix: Day-to-Day Navigation and Configuration Consistency

## Problem

The day-to-day (365-day) navigation in the Simulation tab is fundamentally broken. When you navigate between days, the following chain of events causes incorrect and inconsistent results:

1. Changing the selected day updates `selectedDays` (day-of-week) and `selectedMonths` filters
2. This causes `useLoadProfileData` to recompute `loadProfileChartData` for that specific day-type/month combination
3. The recomputed data feeds new `loadProfile` and `solarProfile` into the 8,760-hour annual engine
4. The ENTIRE annual simulation re-runs with a different representative profile each time you navigate
5. Annual KPIs (total solar, savings, payback) change depending on which day you are viewing
6. The "Day X of 365" display becomes meaningless because every day in the engine has the same profile

In short: the annual engine is supposed to be run once and sliced -- instead it is being rebuilt from scratch on every day change, using a profile that only represents one day-type.

## Root Cause

The `useLoadProfileData` hook is called with day/month filters that change on navigation (lines 578-581 of SimulationPanel.tsx). Its output simultaneously drives both:
- **Chart display** (what you see)
- **Engine input** (what calculates the 365-day results)

These two concerns should be decoupled: the engine should always use an annual-average profile, while the chart display should show the engine's per-day slice.

## Fix

### 1. Decouple engine inputs from day navigation

Add a SECOND call to `useLoadProfileData` that always uses all-days/all-months (the annual average) for the engine. The existing call remains for chart-level PV generation display.

```
-- Before --
useLoadProfileData(selectedDays=currentDay, selectedMonths=currentMonth)
  --> feeds both charts AND engine

-- After --
useLoadProfileData(selectedDays=ALL, selectedMonths=ALL)  --> feeds engine (stable)
useLoadProfileData(selectedDays=currentDay, selectedMonths=currentMonth)  --> feeds chart PV display only
```

### 2. Stabilise the annual engine

The `annualEnergyResults` `useMemo` will consume the stable (all-days/all-months) load and solar profiles, so it only recalculates when actual configuration changes (capacity, battery settings, dispatch strategy) -- NOT when the user navigates between days.

### 3. Enrich `simulationChartData` with engine PV data

Currently `simulationChartData` preserves `pvGeneration` from `loadProfileChartData`. When viewing a specific day, the chart's `pvGeneration` comes from the day-type average, but the engine's `solar` value for that day-index may differ. Fix: also overlay `pvGeneration` from the engine's hourly `solar` field onto the chart data, ensuring the solar bar always matches what the engine dispatched.

### 4. Preserve day-type variation for load display

The navigated-day `loadProfileChartData` correctly shows load variation by day-of-week/month (weekday vs weekend, summer vs winter). This is fine for the load bars. Only the engine's dispatch results (battery, grid, solarUsed) need to come from the stable annual run's per-day slice.

## Files Changed

| File | Change |
|------|--------|
| `src/components/projects/SimulationPanel.tsx` | Add stable `useLoadProfileData` call for engine; decouple engine inputs from navigation state; overlay engine `solar` as `pvGeneration` in `simulationChartData` |

## Technical Detail

### SimulationPanel.tsx changes

1. **New stable data source** (~line 575): Add a second `useLoadProfileData` call with `selectedDays: new Set([0,1,2,3,4,5,6])` and `selectedMonths: new Set([0..11])` -- always the annual average. This produces `stableLoadProfile` and `stableChartSolarProfile`.

2. **Engine inputs** (~line 835-856): Change `loadProfile` and `effectiveSolarProfile` to use the stable data source instead of `loadProfileChartData`.

3. **Chart data merge** (~line 1050-1067): Add `pvGeneration: engineHour.solar` to the merge, so PV generation in charts always reflects what the engine used for dispatch on that specific day.

4. **Remove the per-day re-run**: Since the engine now uses stable inputs, navigating days only changes which slice is displayed -- the engine does not re-run.

## Impact

- Annual KPIs become stable regardless of which day is selected
- Day-to-day navigation becomes instant (no engine recalculation)
- PV production, battery dispatch, and grid flows are consistent across all views
- Configuration changes (capacity, battery, dispatch) still trigger a proper full recalculation
