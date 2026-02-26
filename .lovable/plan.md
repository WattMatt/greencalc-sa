

# Add "Hourly Rates" Toggle to Simulation Tariff Rate Card

## Overview

Add a toggle switch labelled "Hourly Rates" to the right of the blended rate dropdown in the Simulation Tariff Rate card. When enabled, it disables the dropdown and forces the financial engine to use granular hourly TOU rates (8,760-hour cycle). When disabled, the selected blended rate from the dropdown is used instead.

## Current Architecture

The hourly TOU calculation engine already exists in `AdvancedSimulationEngine.ts`:
- `calculateAnnualHourlyIncome()` iterates 6 season x day-type combinations across 24 hours, looking up TOU-specific rates per hour
- The decision to use hourly vs blended is currently automatic: if `tariffRates` are passed to `runAdvancedSimulation()`, it uses hourly TOU; otherwise it uses the single blended rate
- The toggle will give the user explicit control over this behaviour

## Changes

### File: `src/pages/ProjectDetail.tsx`

1. Add `useHourlyTouRates` state (boolean, default `true` since hourly TOU is the more accurate mode)
2. Persist it alongside `blendedRateType` in the project settings JSON
3. Pass the new state and setter down to `SimulationModes`

### File: `src/components/projects/SimulationModes.tsx`

1. Accept `useHourlyTouRates` and `onUseHourlyTouRatesChange` props
2. Forward them to `SimulationPanel`

### File: `src/components/projects/SimulationPanel.tsx`

1. Accept `useHourlyTouRates` and `onUseHourlyTouRatesChange` props
2. **UI**: Add a `Switch` toggle with "Hourly Rates" label to the right of the blended rate dropdown in the Simulation Tariff Rate card (line ~1742). When enabled, the `Select` dropdown gets `disabled={true}` styling
3. **Engine wiring**: In the `runAdvancedSimulation` call (line ~1034), conditionally pass `tariffRates` only when `useHourlyTouRates` is true:
   ```
   tariffRates: useHourlyTouRates ? tariffRates : undefined
   ```
   When `undefined`, the engine falls back to the `else` branch (legacy single blended rate) at line 640

### UI Layout

The Simulation Tariff Rate card content row will look like:

```text
[Dropdown: Solar Hours - Annual v]  [Hourly Rates toggle]  R1.3243/kWh
```

- When toggle is **off**: Dropdown is active, rate display shows the selected blended rate
- When toggle is **on**: Dropdown is disabled/greyed out, rate display shows "Hourly TOU" or the derived weighted average from the hourly engine

### Files Changed

| File | Change |
|------|--------|
| `src/pages/ProjectDetail.tsx` | Add `useHourlyTouRates` state, persist to settings, pass as prop |
| `src/components/projects/SimulationModes.tsx` | Forward new props |
| `src/components/projects/SimulationPanel.tsx` | Add Switch toggle UI, conditionally pass `tariffRates` to engine |

