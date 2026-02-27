

# Restore Full TOU Arbitrage Discharge Matrix

## Problem
The TOU Arbitrage discharge selection currently shows only 3 checkboxes (Peak, Standard, Off-Peak), all reading/writing to `lowSeason.weekday` only. The full `DischargeTOUSelection` data structure supports 12 independent flags across 4 groups (High-Demand Weekday, High-Demand Weekend, Low-Demand Weekday, Low-Demand Weekend), each with Peak/Standard/Off-Peak toggles. The UI needs to expose all 12 cells.

## Solution
Replace the simple 3-checkbox row in `AdvancedSimulationConfig.tsx` (lines 1336-1369) with a proper grid/table layout:

```text
                    Peak    Standard   Off-Peak
High-Demand
  Weekday           [x]      [x]        [ ]
  Weekend           [ ]      [ ]        [ ]
Low-Demand
  Weekday           [x]      [x]        [ ]
  Weekend           [ ]      [ ]        [ ]
```

## File: `src/components/projects/simulation/AdvancedSimulationConfig.tsx`

**Lines 1336-1369** -- Replace the simplified 3-checkbox block with a 4-row x 3-column grid:

- **Header row**: Peak | Standard | Off-Peak (colour-coded per project standard: red, amber, teal)
- **4 data rows**: High-Demand Weekday, High-Demand Weekend, Low-Demand Weekday, Low-Demand Weekend
- Each cell is a `<Checkbox>` bound to the corresponding flag in `dischargeTouSelection`
- Season labels ("High-Demand", "Low-Demand") styled with indigo/violet per the project colour standard
- On change, build the full `DischargeTOUSelection` object and call `onDischargeTouSelectionChange`
- Keep the existing guard: at least one flag must remain checked (prevent all-unchecked state)

**Also update the strategy-change handler** (lines 1305-1316) to use the full selection object when computing discharge windows, not just `lowSeason.weekday`.

No changes needed to the data types (`DischargeTOUSelection` in `load-profile/types.ts` already has the full structure) or to `SimulationPanel.tsx` (it already passes the full selection object).

