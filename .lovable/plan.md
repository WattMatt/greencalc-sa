
# Hourly TOU-Aware Income Calculation Across 8,760 Hours

## Problem

The financial engine currently multiplies total annual kWh by a single blended average rate (`tariff.averageRatePerKwh`). This is inaccurate -- each hour of every day in the year has a specific TOU rate (peak/standard/off-peak) that differs by season (high/low) and day type (weekday/saturday/sunday). The income should be calculated by iterating through all 8,760 hours of the year.

## Approach

Build a new function that iterates day-by-day through a full 365-day year. For each day it determines the season (high/low from `TOUSettings.highSeasonMonths`), the day type (weekday/saturday/sunday), and then for each of the 24 hours looks up the TOU period and its corresponding tariff rate from the `tariffRates` array. It multiplies each hour's kWh (from the energy simulation's hourly profile) by the applicable rate, accumulating total income and total kWh per stream (solar direct, battery discharge, export, grid charge).

The derived "Solar Rate" becomes `totalIncome / totalKwh` -- a weighted reference value.

## Day-by-Day Calendar Logic

Using the `SEASONAL_DAYS` distribution already defined in `tariffCalculations.ts`:
- High season: 66 weekdays, 13 saturdays, 13 sundays (92 days)
- Low season: 195 weekdays, 39 saturdays, 39 sundays (273 days)

For each combination (6 total: high-weekday, high-saturday, high-sunday, low-weekday, low-saturday, low-sunday), iterate over 24 hours, look up the rate, multiply by hourly kWh, then multiply by the number of days in that category. This produces exact annual totals without needing to simulate 8,760 individual days.

## Implementation Steps

### 1. New utility function in `AdvancedSimulationEngine.ts`

Create `calculateAnnualHourlyIncome()`:

```text
Inputs:
  - hourlyData: HourlyEnergyData[] (24 hours from energy engine)
  - tariffRates: TariffRate[] (from DB)
  - touSettings: TOUSettings (from localStorage)
  - tariff?: { legacy_charge_per_kwh?: number }

Outputs:
  - annualSolarDirectIncome: number (R)
  - annualBatteryDischargeIncome: number (R)
  - annualExportIncome: number (R)
  - annualGridChargeCost: number (R)
  - derivedSolarDirectRate: number (R/kWh)
  - derivedBatteryDischargeRate: number (R/kWh)
  - derivedExportRate: number (R/kWh)
  - derivedGridChargeRate: number (R/kWh)
  - totalAnnualSolarDirectKwh: number
  - totalAnnualBatteryDischargeKwh: number
  - totalAnnualExportKwh: number
  - totalAnnualGridChargeKwh: number
```

Logic:
- For each of the 6 (season x dayType) combinations:
  - Get the TOU hour map from `touSettings`
  - Get the day count from `SEASONAL_DAYS`
  - For each hour 0-23:
    - Determine TOU period from the hour map
    - Look up rate via `getCombinedRate(tariffRates, touPeriod, season, tariff)`
    - Multiply: `hourlyData[h].solarUsed * rate * dayCount` (accumulate to solarDirectIncome)
    - Same for `batteryDischarge`, `gridExport`, and `batteryChargeFromGrid` (if tracked)
- Derive weighted rates: `derivedRate = totalIncome / totalKwh`

### 2. Update `runAdvancedSimulation` signature

Add optional parameters:
- `tariffRates?: TariffRate[]`
- `touSettings?: TOUSettings`

When these are provided, use the hourly-weighted calculation instead of `baseEnergyRate * kWh`. The base annual income (Year 1) comes from `calculateAnnualHourlyIncome()`. For subsequent years, apply escalation index and degradation as before.

### 3. Update `SimulationPanel.tsx`

Pass `tariffRates` and TOU settings into `runAdvancedSimulation`:

```text
runAdvancedSimulation(
  energyResults,
  tariffData,
  systemCosts,
  solarCapacity,
  batteryCapacity,
  advancedConfig,
  tariffRates,     // NEW
  touSettings      // NEW (from useTOUSettings hook)
)
```

Add `useTOUSettings()` hook import to `SimulationPanel.tsx`.

### 4. Update `AdvancedConfigComparison.tsx`

Same parameter additions for the comparison panel's call to `runAdvancedSimulation`.

### 5. Yearly projection logic changes in `AdvancedSimulationEngine.ts`

When hourly income data is available:
- Year 1 base values come from the hourly calculation (already annualised)
- `solarDirectIncomeR = baseAnnualSolarDirectIncome * (panelEfficiency/100) * energyRateIndex`
- `solarDirectRateR` becomes the derived rate (reference only)
- Same pattern for battery discharge, export, and grid charge cost
- Grid charge cost: `gridChargeCostR = baseAnnualGridChargeCost * (panelEfficiency/100) * energyRateIndex`

### 6. No changes to types

The `YearlyProjection` and `ColumnTotals` interfaces already have all needed fields. The rate fields (`solarDirectRateR`, `batteryDischargeRateR`, `exportRateR`) will now contain derived weighted averages instead of the single blended rate.

## Files Modified

1. **`src/components/projects/simulation/AdvancedSimulationEngine.ts`** -- Add `calculateAnnualHourlyIncome()`, update `runAdvancedSimulation` signature and income logic
2. **`src/components/projects/SimulationPanel.tsx`** -- Pass `tariffRates` and TOU settings; add `useTOUSettings` hook
3. **`src/components/projects/simulation/AdvancedConfigComparison.tsx`** -- Pass `tariffRates` and TOU settings

## Backward Compatibility

- If `tariffRates` is not provided, falls back to the current blended rate approach (no breaking changes)
- All existing interfaces remain unchanged
- The function signature uses optional parameters
