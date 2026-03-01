

## Two Changes: Remove Self-Discharge Slider + Wire Up Battery Degradation

### 1. Remove Self-Discharge Rate (%/month) Control

The "Standby Loss (%/month)" slider in the Battery Characteristics dropdown will be removed. The auxiliary power draw (W) — which models the dominant real-world parasitic loss — stays.

**Files:**
- `DispatchSections.tsx` — Remove the "Standby Loss (%/month)" NumericInput and its annual loss display
- `EnergySimulationEngine.ts` — Remove `batteryStandbyLossPercent` from config, remove the `hourlyParasiticFraction` calculation and its application in the hourly loop (keep only the auxiliary draw logic)
- `useSimulationEngine.ts` — Remove `batteryStandbyLossPercent` from the config interface and memo
- `AdvancedSimulationConfig.tsx` — Remove the prop threading for standby loss
- `SimulationPanel.tsx` — Remove the `batteryStandbyLossPercent` state

### 2. Fix Battery Degradation — Actually Apply It

Currently, `getBatteryCapacityRemaining(year, degradation)` is called in the 20-year loop but its result is only stored for display. The battery discharge volumes are scaled only by `panelEfficiency`, not by battery capacity remaining. This means a battery configured to lose 3%/year still delivers full discharge every year in the financial model.

**Fix in `AdvancedSimulationEngine.ts` (the 20-year loop, ~line 486-490):**

Currently:
```text
batteryDischargeKwh = baseBatteryDischargeKwh * (panelEfficiency / 100)
```

Will become:
```text
batteryDischargeKwh = baseBatteryDischargeKwh * (panelEfficiency / 100) * (batteryRemaining / 100)
```

This applies the battery's reduced capacity to the discharge volume each year. A battery at 85% remaining capacity in Year 6 will deliver 85% of its baseline annual discharge. The same factor will also be applied to the battery's contribution in the revenue calculation to ensure financial projections reflect reduced battery performance over time.

### Summary of File Changes

| File | Change |
|---|---|
| `EnergySimulationEngine.ts` | Remove self-discharge % config and hourly loop logic |
| `AdvancedSimulationEngine.ts` | Apply `batteryRemaining / 100` factor to battery discharge in the 20-year loop |
| `DispatchSections.tsx` | Remove "Standby Loss (%/month)" UI control |
| `useSimulationEngine.ts` | Remove standby loss from config interface and memo |
| `AdvancedSimulationConfig.tsx` | Remove standby loss prop threading |
| `SimulationPanel.tsx` | Remove standby loss state |

