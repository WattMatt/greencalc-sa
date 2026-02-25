

# Wire Charge/Discharge Strategy Settings into the Simulation Engine

## Problem
The Charge Strategy and Discharge Strategy UI panels allow users to:
- Enable/disable charge sources (PV, Grid, Generator) with per-source TOU period checkboxes
- Enable/disable discharge destinations (Load, Battery, Grid Export) with per-source TOU period checkboxes
- Reorder sources by priority

However, none of these settings flow into the `EnergySimulationEngine`. The engine only reads `chargeWindows`, `dischargeWindows`, and `allowGridCharging` from the `DispatchConfig`, which are either hardcoded defaults or derived from the legacy single-period TOU selectors.

## Solution

### 1. Derive `chargeWindows` and `dischargeWindows` from per-source TOU periods

In `SimulationPanel.tsx`, when the `dispatchConfig.chargeSources` or `dispatchConfig.dischargeSources` change, automatically compute merged `chargeWindows` and `dischargeWindows` by unioning all enabled sources' TOU periods via the existing `touPeriodToWindows()` helper.

**File: `src/components/projects/SimulationPanel.tsx`**
- Add a `useMemo` or `useEffect` that watches `dispatchConfig.chargeSources` and `dispatchConfig.dischargeSources`
- For charge: collect all unique TOU periods from enabled charge sources, convert each to windows via `touPeriodToWindows()`, merge into `chargeWindows`
- For discharge: same logic for enabled discharge sources into `dischargeWindows`
- Set `allowGridCharging` = whether the 'grid' charge source is enabled
- Update `dispatchConfig` with these derived windows

### 2. Update `AdvancedSimulationConfig.tsx` to propagate TOU changes

When a user toggles a TOU period checkbox on any charge or discharge source, the `onChange` handler must also recompute and update the parent's `chargeWindows`/`dischargeWindows` on the `dispatchConfig`.

**File: `src/components/projects/simulation/AdvancedSimulationConfig.tsx`**
- In `ChargeSourcesList` `onChange`: after updating `chargeSources`, also recompute `chargeWindows` from merged TOU periods
- In `DischargeSourcesList` `onChange`: after updating `dischargeSources`, also recompute `dischargeWindows`
- Pass `touPeriodToWindows` function down to these list components

### 3. Enhance the Engine to respect source-level granularity

**File: `src/components/projects/simulation/EnergySimulationEngine.ts`**

Modify the dispatch functions to use `chargeSources` and `dischargeSources` from the config:

- **Charging logic**: For each hour, check which charge sources are enabled AND have TOU periods matching the current hour. PV always charges from excess solar regardless. Grid charging only occurs if the grid source is enabled and the current hour falls within its TOU periods.
- **Discharging logic**: Battery only discharges during hours matching the enabled discharge sources' TOU periods.
- **Source priority**: Process sources in priority order (array index). Higher-priority sources are used first.

Key engine changes:
- Add a helper `isHourInSourceTouPeriods(hour, source, touPeriodToWindowsFn)` that checks if the current hour matches any of a source's enabled TOU periods
- Modify `dispatchSelfConsumption` to check charge/discharge source configs
- Modify `dispatchTouArbitrage`, `dispatchPeakShaving`, `dispatchScheduled` similarly
- Pass `chargeSources` and `dischargeSources` through the `DispatchConfig` (already defined, just unused)

### 4. Pass `touPeriodToWindows` into the engine config

**File: `src/components/projects/simulation/EnergySimulationEngine.ts`**

Add an optional `touPeriodToWindows` function to `EnergySimulationConfig` so the engine can resolve TOU period names to hour windows at simulation time.

**File: `src/components/projects/SimulationPanel.tsx`**

Pass `touPeriodToWindows` into the `energyConfig` object.

## Technical Details

### Window Merging Logic
```text
For each enabled source:
  For each selected TOU period (e.g. ['off-peak', 'standard']):
    windows += touPeriodToWindows(period)
Deduplicate overlapping windows
Set on dispatchConfig.chargeWindows / dischargeWindows
```

### Engine Hour Check
```text
For hour h:
  canCharge = any enabled charge source has a TOU period whose window contains h
  canDischarge = any enabled discharge source has a TOU period whose window contains h
  gridChargeAllowed = grid source enabled AND h is in grid source's TOU windows
```

### Files Modified
1. `src/components/projects/simulation/EnergySimulationEngine.ts` -- Engine uses `chargeSources`/`dischargeSources` and their TOU periods
2. `src/components/projects/SimulationPanel.tsx` -- Pass `touPeriodToWindows` to engine config; derive windows from sources
3. `src/components/projects/simulation/AdvancedSimulationConfig.tsx` -- Propagate TOU checkbox changes to `chargeWindows`/`dischargeWindows` on `dispatchConfig`

