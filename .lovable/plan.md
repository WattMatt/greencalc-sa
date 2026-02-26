
# Full 8,760-Hour Energy Simulation and Financial Model

## Problem

Currently, the energy simulation runs a **single 24-hour cycle** (one representative day) and the financial engine approximates annual results by multiplying daily totals by 365 or using 6 season/day-type combinations with day counts. This means:

- Battery state-of-charge resets every day (never carries over)
- Dispatch behaviour is identical for weekdays, Saturdays, and Sundays despite different TOU periods
- The `* 365` scaling is an approximation, not an exact simulation

The requirement is that **all kWh simulation and financial results are based on actual 1-hour intervals across 365 days (8,760 hours)**, regardless of tariff configuration.

## Solution Overview

### 1. New `runAnnualEnergySimulation` function (EnergySimulationEngine.ts)

Create a new function that runs the existing dispatch logic for 8,760 consecutive hours:

- Build a **365-day calendar** where each day is tagged with its season (`high`/`low` from `TOUSettings.highSeasonMonths`) and day-type (`weekday`/`saturday`/`sunday`)
- For each day, use the same 24-hour load and solar profiles (as currently done implicitly via `* 365`)
- **Battery SoC carries over** from day to day (no daily reset)
- Dispatch permissions are resolved per-hour using the correct TOU hour map for that day's season and day-type
- Output: `AnnualEnergySimulationResults` containing 8,760 `AnnualHourlyEnergyData` entries (each tagged with `dayIndex`, `season`, `dayType`, `touPeriod`)

```text
Interface: AnnualHourlyEnergyData extends HourlyEnergyData
  + dayIndex: number (0-364)
  + season: 'high' | 'low'
  + dayType: 'weekday' | 'saturday' | 'sunday'
  + touPeriod: 'peak' | 'standard' | 'off-peak'
```

The existing `runEnergySimulation` (24-hour) is preserved for chart visualisation.

### 2. Update financial engine (AdvancedSimulationEngine.ts)

- `runAdvancedSimulation` accepts an optional `AnnualEnergySimulationResults` parameter
- Replace all `* 365` scaling with direct annual totals from the 8,760-hour results
- Replace `calculateAnnualHourlyIncome` (6-combo approach) with a direct iteration over the 8,760 tagged hours, looking up the TOU rate per hour from its `season` + `touPeriod`
- This eliminates the blended-vs-hourly toggle distinction: the financial model always uses the 8,760-hour data with per-hour TOU rates
- Grid charge cost is calculated exactly per-hour (no more weighted average approximation)

### 3. Update SimulationPanel.tsx

- Call `runAnnualEnergySimulation` alongside the existing 24-hour simulation
- Pass the annual results to `runAdvancedSimulation`
- The 24-hour `runEnergySimulation` results continue to power the building/battery profile charts
- The annual results power all financial calculations

## Technical Details

### Calendar Generation Helper

```text
function buildAnnualCalendar(touSettings: TOUSettings): DayInfo[]
  For day 0-364:
    month = lookup from cumulative month lengths
    dayOfWeek = (startDay + dayIndex) % 7
    season = highSeasonMonths.includes(month) ? 'high' : 'low'
    dayType = dayOfWeek in [1-5] ? 'weekday' : dayOfWeek === 6 ? 'saturday' : 'sunday'
  Returns 365 entries with { month, dayOfWeek, season, dayType, hourMap }
```

### Annual Simulation Loop

```text
function runAnnualEnergySimulation(
  loadProfile: number[24],
  solarProfile: number[24],
  config: EnergySimulationConfig,
  touSettings: TOUSettings
): AnnualEnergySimulationResults

  batteryState = initialSoC * capacity
  for each day (0-364):
    hourMap = touSettings[season][dayType]
    for each hour (0-23):
      touPeriod = hourMap[hour]
      resolve dispatch permissions using touPeriod context
      run dispatch (same logic as current)
      tag result with { dayIndex, season, dayType, touPeriod }
      carry battery state to next hour
```

### Financial Engine Changes

```text
// Before (approximation):
const baseSolarDirectKwh = baseEnergyResults.totalSolarUsed * 365;

// After (exact):
const baseSolarDirectKwh = annualResults.totalAnnualSolarUsed;  // pre-summed from 8,760 hours
```

```text
// Before (6-combo income):
for combo in combinations:
  income += hourData[h].solarUsed * combo.dayCount * rate

// After (direct 8,760 iteration):
for each of 8,760 tagged hours:
  rate = getCombinedRate(tariffRates, hour.touPeriod, hour.season)
  income += hour.solarUsed * rate
```

### Performance Consideration

8,760 iterations with simple arithmetic is negligible (sub-millisecond). The results are memoised via `useMemo` in `SimulationPanel.tsx` with the same dependency array as the existing 24-hour simulation.

## Files Changed

| File | Change |
|------|--------|
| `src/components/projects/simulation/EnergySimulationEngine.ts` | Add `AnnualHourlyEnergyData` interface, `AnnualEnergySimulationResults` interface, `buildAnnualCalendar` helper, `runAnnualEnergySimulation` function |
| `src/components/projects/simulation/AdvancedSimulationEngine.ts` | Update `runAdvancedSimulation` to accept annual results, replace all `* 365` scaling with direct totals, replace 6-combo income calculation with direct 8,760-hour iteration |
| `src/components/projects/SimulationPanel.tsx` | Call `runAnnualEnergySimulation`, pass annual results to financial engine |
| `src/components/projects/simulation/index.ts` | Export new function and types |
