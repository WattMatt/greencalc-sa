

# TOU Arbitrage Discharge Grid — Checkbox Matrix

## Overview
Replace the single "Discharge during" dropdown with a dual-table checkbox grid. Users can select exactly which season/day-type/period combinations the battery should discharge during.

## UI Layout

```text
Discharge Strategy: [TOU Arbitrage v]

  High Demand                    Low Demand
  Weekday  Weekend               Weekday  Weekend
  [x] Peak    [ ] Peak           [ ] Peak    [ ] Peak
  [ ] Std     [ ] Std            [ ] Std     [ ] Std
  [ ] Off-Pk  [ ] Off-Pk         [ ] Off-Pk  [ ] Off-Pk
```

- Two mini-tables side by side (grid-cols-2), each with a header ("High Demand" / "Low Demand") using the standard season colours (Indigo / Violet)
- Within each table: 2 columns (Weekday, Weekend) and 3 rows (Peak, Standard, Off-Peak)
- Each cell is a small checkbox with a label
- Default: only Peak Weekday checked for both seasons (matching current "peak" default)

## Data Model Change

### New type: `DischargeTOUSelection`
```typescript
interface DischargeTOUSelection {
  highSeason: {
    weekday: { peak: boolean; standard: boolean; offPeak: boolean };
    weekend: { peak: boolean; standard: boolean; offPeak: boolean };
  };
  lowSeason: {
    weekday: { peak: boolean; standard: boolean; offPeak: boolean };
    weekend: { peak: boolean; standard: boolean; offPeak: boolean };
  };
}
```

This replaces the single `dischargeTouPeriod: TOUPeriod` string.

### Default value
Peak weekday checked for both seasons, everything else unchecked.

## Simulation Engine Integration

### Updated `touPeriodToWindows` approach
Currently the engine checks `isSourceActiveAtHour()` using a flat list of TOU period names. With the new grid, the discharge window resolver must also consider:
1. Which **season** the current month falls in (high vs low) — already available from TOU settings
2. Which **day type** the current day is (weekday vs weekend)
3. Which **periods** are checked for that season+day combination

The `dischargeWindows` in `DispatchConfig` will be computed dynamically based on month/day context, or the engine's `getDischargePermissions` function will be extended to accept the new selection grid.

**Preferred approach**: Extend the existing `dischargeTouPeriods` array on `DischargeSource` items to carry the full grid, and update `isSourceActiveAtHour` to resolve against season+day+period.

## Files to Modify

1. **`src/components/projects/load-profile/types.ts`** — Add `DischargeTOUSelection` type and default
2. **`src/components/projects/simulation/AdvancedSimulationConfig.tsx`**:
   - Replace the "Discharge during" dropdown (lines 1334-1361) with the new checkbox grid component
   - The grid is rendered inline (no separate file needed — it's small)
   - Wire checkbox changes to update dispatch config
3. **`src/components/projects/SimulationPanel.tsx`**:
   - Replace `dischargeTouPeriod` state (single string) with `dischargeTouSelection` state (the grid object)
   - Update `touPeriodToWindows` or create a new resolver that factors in season + day type
   - Pass new state to `AdvancedSimulationConfig`
4. **`src/components/projects/simulation/EnergySimulationEngine.ts`**:
   - Update `isSourceActiveAtHour` to accept and resolve the grid-based selection when the strategy is `tou-arbitrage`
   - The hour-by-hour loop already has access to determine if a given hour is weekday/weekend and which month it is; extend to check the correct grid cell
5. **`src/components/projects/SavedSimulations.tsx`** — Update serialisation/deserialisation to persist the new grid object instead of the single string

## Technical Details

- The checkbox grid is compact (~6 checkboxes per season table, 12 total) and fits cleanly in the existing panel width
- Season header colours follow the existing standard: Deep Indigo for High Demand, Soft Violet for Low Demand
- Period row labels use the existing TOU colours: Red (Peak), Amber (Standard), Teal (Off-Peak)
- No new dependencies required — uses existing Checkbox component from Shadcn

