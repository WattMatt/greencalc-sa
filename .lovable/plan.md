

# Fix: Battery Discharge Must Respect TOU Selection Matrix Per Hour in 8,760-Hour Simulation

## Problem

The user has configured TOU arbitrage to discharge the battery **only during peak hours in the high-demand season**. However, the cashflow shows a battery rate that does not match the peak rate, and battery kWh is suspiciously uniform -- indicating the battery discharges at the same clock hours every day regardless of season or day type.

### Root Cause

The `dispatchTouArbitrage` function in `EnergySimulationEngine.ts` decides whether to discharge based on **static time windows** (`config.dischargeWindows`), which are the same fixed clock hours for all 365 days. It never reads the `dischargeTouSelection` matrix (the 12-cell checkbox grid: high/low season x weekday/weekend x peak/standard/off-peak).

This means:
- If discharge windows are set to hours 7-10 and 18-20 (typical peak clock hours), the battery discharges at those hours **every single day** -- weekends, low season, etc.
- On a **Sunday in low season**, hours 7-10 might be Off-Peak, but the battery still discharges because the static window says so
- The result: battery kWh is evenly spread across 365 days, and the derived rate is a diluted blend of peak/standard/off-peak rates instead of pure peak

## Solution

Replace the static `dischargeWindows` check in `dispatchTouArbitrage` with a per-hour check against the `dischargeTouSelection` matrix, using each day's actual TOU context (season, dayType, touPeriod).

### Changes to `EnergySimulationEngine.ts`

**1. Add a helper function to check the discharge TOU selection matrix:**

```text
function isDischargePermittedByTouSelection(
  season: 'high' | 'low',
  dayType: 'weekday' | 'saturday' | 'sunday',
  touPeriod: 'peak' | 'standard' | 'off-peak',
  selection?: DischargeTOUSelection
): boolean
```

Maps dayType to the matrix key (`weekday` or `weekend`), then checks `selection[season][dayTypeKey][touPeriod]`. Returns `true` if no selection matrix exists (backwards compatibility).

**2. Update `dispatchTouArbitrage` signature to accept TOU context:**

Add parameters for `season`, `dayType`, `touPeriod`, and `dischargeTouSelection`. Replace the `isDischargeHour = isInAnyWindow(hour, config.dischargeWindows)` check with:

```text
const isDischargeHour = isDischargePermittedByTouSelection(
  season, dayType, touPeriod, config.dischargeTouSelection
);
```

This means the battery only discharges when the current hour's actual TOU context (resolved from the calendar) is permitted by the user's 12-cell matrix selection.

**3. Update the annual simulation loop to pass TOU context to dispatch:**

In `runAnnualEnergySimulation`, resolve `touPeriod` before the dispatch call (move it above the switch statement) and pass `season`, `dayType`, `touPeriod`, and `dischargeTouSelection` to `dispatchTouArbitrage`.

**4. Update the 24-hour simulation loop similarly** (for chart consistency).

### Expected Result

- If the user selects only "Peak / High / Weekday" in the TOU arbitrage matrix:
  - Battery only discharges during peak hours on high-season weekdays
  - Battery kWh in cashflow reflects ~130 weekdays x peak hours only (not 365 days)
  - Battery rate in cashflow matches the peak energy rate (no dilution)
- All other hours: battery sits idle (or charges if charge windows permit)

### Files Changed

| File | Change |
|------|--------|
| `src/components/projects/simulation/EnergySimulationEngine.ts` | Add `isDischargePermittedByTouSelection` helper; update `dispatchTouArbitrage` to accept and use TOU context instead of static windows; update both simulation loops to pass context |

