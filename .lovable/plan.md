
# Fix: Wire Discharge/Charge Source Settings into ALL Dispatch Strategies

## Root Cause (3 Bugs)

1. **`solarUsed` is hardcoded**: Line 255 always sets `solarUsed = Math.min(solar, load)`. The engine always sends solar directly to the load -- there is no check for whether "Load" is enabled/disabled as a discharge destination.

2. **Permissions ignored by 3 of 4 strategies**: The `permissions` object (charge/discharge source settings) is computed every hour but only passed to `dispatchSelfConsumption`. The `dispatchTouArbitrage`, `dispatchPeakShaving`, and `dispatchScheduled` functions never receive it, so they ignore all source configs.

3. **`getDischargePermissions` is incomplete**: It only checks the `battery` discharge source. It never checks the `load` or `grid-export` discharge sources, so disabling "Load" in the UI has zero effect.

## Fix Plan

### File: `src/components/projects/simulation/EnergySimulationEngine.ts`

**A. Expand `getDischargePermissions` to return all three flags**

```text
Current return: { batteryDischargeAllowed: boolean }
New return:     { loadDischargeAllowed: boolean; batteryDischargeAllowed: boolean; gridExportAllowed: boolean }
```

Check each discharge source (`load`, `battery`, `grid-export`) for enabled status and TOU period match at the given hour.

**B. Add permissions parameter to all dispatch functions**

- `dispatchTouArbitrage(s, hour, config)` --> `dispatchTouArbitrage(s, hour, config, permissions)`
- `dispatchPeakShaving(s, hour, config)` --> `dispatchPeakShaving(s, hour, config, permissions)`
- `dispatchScheduled(s, hour, config)` --> `dispatchScheduled(s, hour, config, permissions)`

**C. Respect `loadDischargeAllowed` in solar dispatch**

In every dispatch function, change:
```text
Before: solarUsed = Math.min(solar, load)       // always feeds load
After:  solarUsed = loadDischargeAllowed ? Math.min(solar, load) : 0
```

When `loadDischargeAllowed = false`:
- Solar does NOT offset load; the full load is met by grid (or battery if allowed)
- All solar generation goes to battery (if charge allowed) or grid export (if allowed)
- `netLoad` effectively equals `load` (solar is ignored for load purposes)

**D. Respect `gridExportAllowed` in export logic**

When `gridExportAllowed = false`, any excess solar that cannot go to battery is curtailed (set to 0) instead of exported.

**E. Pass permissions from the main loop**

Update the switch statement (lines 451-465) to pass `permissions` to all four dispatch functions, not just self-consumption.

## Summary of Behavioural Changes

| Discharge Source | Enabled | Effect |
|---|---|---|
| Load | OFF | Solar does not offset load. Load is met by grid/battery only. Solar goes to battery or export. |
| Load | ON  | Solar offsets load first (current behaviour). |
| Battery | OFF | Battery never discharges to cover load shortfall. |
| Battery | ON  | Battery discharges during matching TOU periods. |
| Grid Export | OFF | Excess solar that can't go to battery is curtailed. |
| Grid Export | ON  | Excess solar exported to grid. |

### Files Modified
1. `src/components/projects/simulation/EnergySimulationEngine.ts` -- All changes are in this single file
