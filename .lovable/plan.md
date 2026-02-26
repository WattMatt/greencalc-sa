

# Fix Calendar Year to 2026 and Eliminate Simultaneous Battery Charge/Discharge

## Two Issues

### Issue 1: Calendar starts on wrong day

The annual simulation calendar (`buildAnnualCalendar`) hardcodes `startDayOfWeek = 3` (Wednesday). The chart label (`dayDateInfo`) hardcodes year 2024. Both need to reflect 2026, where 1 January is a Thursday (`dayOfWeek = 4`).

This affects which days are weekdays vs weekends, and therefore which TOU periods apply to each of the 365 days.

### Issue 2: Battery charges and discharges simultaneously

When `loadDischargeAllowed = false` (solar not permitted to serve load directly), the dispatch functions set:
- `solarUsed = 0`, so `effectiveNetLoad = load` (full load remains)
- `solarExcess = solar` (full solar available)

Both values are positive simultaneously during sunshine hours, causing the battery to discharge to meet load AND charge from solar excess in the same hour. This is physically impossible -- a battery inverter operates in one direction at a time.

**Fix:** After each dispatch function calculates raw charge and discharge, apply netting. If both are positive, reduce the larger by the smaller and zero out the smaller. Also adjust `newBatteryState` and `gridImport` accordingly to maintain energy balance.

For example, if an hour produces `batteryCharge = 200 kW` and `batteryDischarge = 300 kW`:
- Net discharge = 100 kW, net charge = 0
- The 200 kW of solar that would have charged the battery instead offsets 200 kW of load directly (reducing grid import by 200 kW)

## Changes

### File: `src/components/projects/simulation/EnergySimulationEngine.ts`

**1. Update `buildAnnualCalendar` to use 2026 start day**

Replace the hardcoded `startDayOfWeek = 3` with the actual day-of-week for 1 January 2026:

```text
// 1 January 2026 is a Thursday
const startDayOfWeek = new Date(2026, 0, 1).getDay(); // 4 = Thursday
```

This ensures every day in the 365-day calendar gets the correct weekday/Saturday/Sunday classification and therefore the correct TOU hour map.

**2. Add battery netting function**

Create a helper that nets simultaneous charge and discharge, applied to every `HourResult` before it is returned:

```text
function netBatteryFlows(result: HourResult): HourResult {
  if (result.batteryCharge > 0 && result.batteryDischarge > 0) {
    const netCharge = result.batteryCharge - result.batteryDischarge;
    if (netCharge >= 0) {
      // Net charging: solar excess > load deficit
      // The discharge amount of solar effectively served load (reduce grid import)
      const offset = result.batteryDischarge;
      return {
        ...result,
        solarUsed: result.solarUsed + offset,
        batteryCharge: netCharge,
        batteryDischarge: 0,
        gridImport: Math.max(0, result.gridImport - offset),
      };
    } else {
      // Net discharging: load deficit > solar excess
      // The charge amount of solar effectively served load (reduce grid import)
      const offset = result.batteryCharge;
      return {
        ...result,
        solarUsed: result.solarUsed + offset,
        batteryCharge: 0,
        batteryDischarge: -netCharge,
        gridImport: Math.max(0, result.gridImport - offset),
      };
    }
  }
  return result;
}
```

**3. Apply netting in all dispatch functions**

Wrap the return value of `dispatchSelfConsumption`, `dispatchTouArbitrage`, `dispatchPeakShaving`, and `dispatchScheduled` with `netBatteryFlows()`. This is a single-line change at each return statement.

### File: `src/components/projects/SimulationPanel.tsx`

**4. Update `dayDateInfo` to use 2026**

Change line 319 from:
```text
const date = new Date(2024, 0, 1 + selectedDayIndex);
```
to:
```text
const date = new Date(2026, 0, 1 + selectedDayIndex);
```

This ensures the chart header shows "1 January (Day 1)" with the correct weekday classification for 2026.

## Files Changed

| File | Change |
|------|--------|
| `src/components/projects/simulation/EnergySimulationEngine.ts` | Use 2026 start day in calendar; add `netBatteryFlows` helper; apply netting to all dispatch returns |
| `src/components/projects/SimulationPanel.tsx` | Update `dayDateInfo` year from 2024 to 2026 |

## Impact

- Day 1 (1 January 2026) is correctly a Thursday, Day 2 is Friday, Day 3 is Saturday, etc.
- TOU periods for each day match 2026's actual weekday/weekend pattern
- Battery never shows simultaneous charge and discharge -- only net flow is reported
- Energy balance (grid import, solar used) remains correct after netting
- Chart legend totals (Charge kWh, Discharge kWh) will show realistic non-overlapping values

