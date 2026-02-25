

## Fix Battery Not Charging/Discharging in Profile Charts

### Root Cause

The profile charts use data from `useLoadProfileData`, which has a **duplicate, simplified battery simulation** (lines 414-443) that is completely disconnected from the proper `EnergySimulationEngine`. This simplified logic:

1. **Only charges from excess PV** (`gridExport`) -- when solar is disabled, `gridExport = 0`, so the battery **never charges**
2. **Ignores the dispatch strategy entirely** -- no TOU arbitrage, no peak shaving, no scheduled dispatch
3. **Starts SoC at 20%** instead of the configured initial SoC (50%)

Meanwhile, `EnergySimulationEngine.runEnergySimulation()` already produces correct hourly battery data (`energyResults.hourlyData`) with full dispatch strategy support, but this data is **never used** for the charts.

### Solution

Replace the broken battery simulation in `useLoadProfileData` with an overlay approach: after `useLoadProfileData` computes load + PV + grid data, `SimulationPanel` merges `energyResults.hourlyData` battery and grid fields onto the chart data. This keeps load/PV computation in the hook but uses the authoritative engine for battery and grid flows.

### Changes

**File: `src/components/projects/SimulationPanel.tsx`** (lines ~896-898)

Replace the direct assignment `simulationChartData = loadProfileChartData` with a `useMemo` that overlays `energyResults.hourlyData` onto `loadProfileChartData`:

- For each hour, copy `batteryCharge`, `batteryDischarge`, `batterySoC` from `energyResults.hourlyData`
- Also copy `gridImport`, `gridExport`, `gridImportWithBattery` from the engine results (since the engine accounts for battery dispatch when computing grid flows)
- This ensures the charts reflect the actual dispatch strategy (self-consumption, TOU arbitrage, peak shaving, or scheduled)

**File: `src/components/projects/load-profile/hooks/useLoadProfileData.ts`** (lines 414-443)

Remove the duplicate battery simulation block entirely. The hook should only compute load profiles, PV generation, and basic grid fields (without battery). Battery overlay is now handled in `SimulationPanel`.

### Data Flow After Fix

```text
useLoadProfileData (hook)
  --> load profiles (total per hour)
  --> PV generation (if solar enabled)
  --> grid import/export (without battery)

EnergySimulationEngine (pure function)
  --> Uses loadProfile + solarProfile from hook
  --> Runs proper dispatch strategy
  --> Produces hourlyData with battery + adjusted grid

SimulationPanel (merge)
  --> Takes hook's chartData (load + PV)
  --> Overlays engine's battery + grid fields
  --> Result = simulationChartData for all charts
```

### Why This Approach

- Keeps load/PV calculation in the hook (shared with Load Profile tab)
- Uses the battle-tested dispatch engine for battery (no duplicate logic)
- All four strategies work: self-consumption, TOU arbitrage, peak shaving, scheduled
- Battery works with or without solar (TOU arbitrage grid-charging)
- Single source of truth for battery simulation

