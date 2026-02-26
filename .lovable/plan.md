
# Remove 24-Hour Simulation Dependency: Annual 8,760-Hour as Single Source of Truth

## Overview

Every kWh figure, financial calculation, summary card, and chart overlay in the Simulation tab will be driven exclusively by the 8,760-hour annual simulation (`runAnnualEnergySimulation`). The 24-hour `runEnergySimulation` calls and `scaleToAnnual` helper will be removed from `SimulationPanel.tsx`. The chart will extract a representative 24-hour slice from the annual data for visualisation.

## What Changes

### 1. Remove 24-hour simulation calls from SimulationPanel.tsx

- Remove `energyResults` (line 858-861), `energyResultsGeneric` (line 869-872), `energyResultsSolcast` (line 874-877)
- Remove `annualEnergy = scaleToAnnual(energyResults)` (line 1001)
- Keep only `annualEnergyResults` as the single energy source

### 2. Add annual simulation variants for Generic and Solcast profiles

Currently `energyResultsGeneric` and `energyResultsSolcast` run the 24-hour engine with alternative solar profiles. These need to become annual simulations too:

```text
annualEnergyResultsGeneric = runAnnualEnergySimulation(loadProfile, solarProfileGeneric, energyConfig, touSettingsData)
annualEnergyResultsSolcast = runAnnualEnergySimulation(loadProfile, solarProfileSolcast, energyConfig, touSettingsData)
```

### 3. Update `calculateFinancials` to accept `AnnualEnergySimulationResults`

The `FinancialAnalysis.ts` function currently takes `EnergySimulationResults` (24-hour daily totals). It needs an overload or update to accept `AnnualEnergySimulationResults` directly, using the pre-summed annual totals instead of daily values multiplied by scaling factors.

Key mapping:
- `totalDailyLoad` becomes `totalAnnualLoad / 365` (for daily cost pro-rating) or direct annual use
- `totalGridImport` becomes `totalAnnualGridImport / 365`
- `peakLoad` and `peakGridImport` come directly from the annual results
- All cost outputs recalculated as annual-first (no `* 365` on daily)

### 4. Extract representative day from annual data for chart overlay

The building profile chart needs 24 hourly data points. Instead of the 24-hour simulation, extract a representative day from the 8,760-hour dataset:

```text
// Filter annual hourly data by current season + weekday, take first matching day
const representativeDay = annualEnergyResults.hourlyData
  .filter(h => h.season === currentSeason && h.dayType === 'weekday')
  .slice(0, 24);
```

This means the chart will show actual dispatch behaviour from the annual simulation (with carried-over battery SoC) for a representative weekday in the selected season, rather than an isolated 24-hour cycle.

### 5. Replace all `energyResults.*` references

Every reference to the old 24-hour results in `SimulationPanel.tsx` will be replaced:

| Old Reference | New Source |
|---|---|
| `energyResults.totalDailyLoad` | `annualEnergyResults.totalAnnualLoad / 365` |
| `energyResults.totalDailySolar` | `annualEnergyResults.totalAnnualSolar / 365` |
| `energyResults.totalDailySolar * 365` | `annualEnergyResults.totalAnnualSolar` |
| `energyResults.totalGridImport` | `annualEnergyResults.totalAnnualGridImport / 365` |
| `energyResults.totalGridImport * 2.5 * 365` | `annualEnergyResults.totalAnnualGridImport * 2.5` |
| `energyResults.totalSolarUsed` | `annualEnergyResults.totalAnnualSolarUsed / 365` |
| `energyResults.selfConsumptionRate` | `annualEnergyResults.selfConsumptionRate` |
| `energyResults.peakLoad` | `annualEnergyResults.peakLoad` |
| `energyResults.peakGridImport` | `annualEnergyResults.peakGridImport` |
| `energyResults.peakReduction` | `annualEnergyResults.peakReduction` |
| `energyResults.batteryCycles` | `annualEnergyResults.batteryCycles` |
| `energyResults.totalBatteryDischarge` | `annualEnergyResults.totalAnnualBatteryDischarge / 365` |
| `energyResults.hourlyData` | Representative day slice from annual data |

### 6. Update `runAdvancedSimulation` call

Remove `energyResults` as first argument. The function already supports `annualEnergyResults` and falls back to `baseEnergyResults` only when annual data is missing. With this change, the annual data is always present, so we can simplify the interface or pass a derived `EnergySimulationResults` adapter from the annual totals.

### 7. Update summary cards

The "Daily Load", "Solar Generated", "Grid Import" cards (lines 2009-2060) will show annual averages derived from the 8,760-hour totals (dividing by 365), ensuring they reflect the true annual simulation rather than a single representative day.

## Technical Details

### Files Changed

| File | Change |
|---|---|
| `src/components/projects/simulation/EnergySimulationEngine.ts` | Remove `scaleToAnnual` export (or keep for backwards compat but unused). No other changes needed -- the annual engine is already correct. |
| `src/components/projects/simulation/FinancialAnalysis.ts` | Add `calculateFinancialsFromAnnual(annualResults, tariff, systemCosts, ...)` that reads pre-summed annual totals directly. |
| `src/components/projects/SimulationPanel.tsx` | Remove 3 `runEnergySimulation` calls. Add 2 `runAnnualEnergySimulation` variants (Generic, Solcast). Replace all `energyResults.*` references. Extract representative day for chart. Update `calculateFinancials` calls to use new annual function. |
| `src/components/projects/simulation/index.ts` | Export `calculateFinancialsFromAnnual` if added as new function. |

### Chart Representative Day Logic

```text
const chartRepresentativeDay = useMemo(() => {
  if (!annualEnergyResults?.hourlyData) return [];
  const season = showHighSeason ? 'high' : 'low';
  // Find first weekday in selected season
  const startIdx = annualEnergyResults.hourlyData
    .findIndex(h => h.season === season && h.dayType === 'weekday');
  if (startIdx === -1) return [];
  return annualEnergyResults.hourlyData.slice(startIdx, startIdx + 24);
}, [annualEnergyResults, showHighSeason]);
```

### Performance

No performance concern. The annual simulation already runs in sub-millisecond time. Removing the separate 24-hour simulation reduces total computation.
