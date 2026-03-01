
## Add Battery Parasitic (Standby) Loss

### What Changes
LiFePO4 batteries lose approximately 2% of their charge per month when idle due to internal resistance and BMS electronics. This feature adds that drain to the simulation engine and exposes the setting in the Battery Characteristics dropdown.

### Implementation Steps

**1. Add config field to `EnergySimulationConfig`** (`EnergySimulationEngine.ts`)
- New optional field: `batteryStandbyLossPercent?: number` (default: 2, meaning 2%/month)

**2. Apply hourly parasitic drain in the 8,760-hour loop** (`EnergySimulationEngine.ts`, ~line 847)
- After each hour's dispatch updates `batteryState`, subtract the parasitic loss:
```text
hourlyLossFraction = (standbyLossPercent / 100) / 720
parasiticLoss = batteryState * hourlyLossFraction
batteryState = max(batteryState - parasiticLoss, minBatteryLevel)
```
- Accumulate `totalParasiticLoss` for reporting

**3. Add `totalAnnualParasiticLoss` to `AnnualEnergySimulationResults`** (`EnergySimulationEngine.ts`)
- New field on the results interface, populated from the accumulator

**4. Wire through `useSimulationEngine`** (`useSimulationEngine.ts`)
- Add `batteryStandbyLossPercent` to `SimulationEngineConfig` interface
- Pass it into the `energyConfig` memo object
- Add to the `useMemo` dependency array

**5. Add UI control to Battery Characteristics section** (`DispatchSections.tsx`)
- Add `batteryStandbyLossPercent` and `onBatteryStandbyLossPercentChange` to `BatteryCharacteristicsSectionProps`
- Render a `NumericInput` slider-style control:
  - Label: "Standby Loss (%/month)"
  - Range: 0 - 5%, step 0.5, default 2
  - Below it, display calculated annual loss: `batteryCapacity * (percent/100) * 365 * 24 / 720` kWh/yr (approximate)

**6. Thread the prop through `AdvancedSimulationConfig.tsx`**
- Add `batteryStandbyLossPercent` and `onBatteryStandbyLossPercentChange` to `AdvancedSimulationConfigProps`
- Pass them down to `BatteryCharacteristicsSection`

**7. Thread from the parent page** (wherever `AdvancedSimulationConfigPanel` is rendered)
- Add state for `batteryStandbyLossPercent` (default 2)
- Pass it to `AdvancedSimulationConfigPanel` and into `useSimulationEngine`

### Files Modified
- `src/components/projects/simulation/EnergySimulationEngine.ts` -- Config, results, hourly loop
- `src/components/projects/simulation/useSimulationEngine.ts` -- Config passthrough
- `src/components/projects/simulation/advanced-config/DispatchSections.tsx` -- UI control
- `src/components/projects/simulation/AdvancedSimulationConfig.tsx` -- Prop threading
- Parent page component (prop threading and state)

### Default Behaviour
With the default of 2%/month, a 100 kWh battery loses roughly 0.003% per hour when idle, equating to approximately 24 kWh/year in parasitic losses. This is consistent with published LiFePO4 specifications (1-3% cell self-discharge + 1-3% BMS draw per month).
