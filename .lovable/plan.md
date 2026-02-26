

# Add Grid Battery Charging Cost to Cashflow

## Problem

When the battery charges from the grid (e.g., during off-peak TOU arbitrage), those kWh are imported from the grid and must be paid for. Currently, the energy engine correctly adds grid-charge kWh to `gridImport`, but the financial engine does not account for this cost. The `totalCostR` only includes insurance and maintenance, so grid charging appears "free".

## Solution

Track grid-charged battery kWh separately in the energy simulation, then cost them in the financial engine using the applicable tariff rate.

### Step 1: Energy Engine -- Track grid-charge kWh separately

**File:** `src/components/projects/simulation/EnergySimulationEngine.ts`

- Add `batteryChargeFromGrid: number` to `HourResult`, `HourlyEnergyData`, and `EnergySimulationResults` (as `totalBatteryChargeFromGrid`).
- In `dispatchTouArbitrage`, `dispatchPeakShaving`, and `dispatchScheduled`, track the `gridCharge` portion separately (where `gridImport += gridCharge`).
- In `dispatchSelfConsumption`, grid charging is never allowed, so `batteryChargeFromGrid = 0`.
- Accumulate the daily total in the simulation loop.

### Step 2: Financial Engine -- Add grid charging cost

**File:** `src/components/projects/simulation/AdvancedSimulationEngine.ts`

- Read `totalBatteryChargeFromGrid` from the base energy results.
- Annualise it: `baseBatteryChargeFromGridKwh = totalBatteryChargeFromGrid * 365`.
- Apply degradation proportionally (same as other streams).
- Calculate cost: `gridChargeCostR = batteryChargeFromGridKwh * baseEnergyRate * energyRateIndex` (charged at the prevailing energy rate).
- Add to `totalCostR`: `totalCostR = insuranceCostR + maintenanceCost + gridChargeCostR`.

### Step 3: Types -- Add new fields to YearlyProjection

**File:** `src/components/projects/simulation/AdvancedSimulationTypes.ts`

- Add `gridChargeCostR: number` and `batteryChargeFromGridKwh: number` to `YearlyProjection`.

### Step 4: Cashflow Table -- Display grid charging cost

**File:** `src/components/projects/simulation/AdvancedResultsDisplay.tsx`

- Add a "Grid Charge Cost (R)" column in the costs section of the cashflow table.
- Display `gridChargeCostR` for each year.
- Include in column totals.

### Step 5: Column Totals

**File:** `src/components/projects/simulation/AdvancedSimulationEngine.ts`

- Add `gridChargeCostR` to the `ColumnTotals` interface and accumulate it in the totals loop.

## Technical Notes

- The grid charge rate should use the same `baseEnergyRate * energyRateIndex` as other energy flows. In a future iteration, a separate off-peak rate could be applied for more accuracy.
- This cost is distinct from the regular grid import cost (which the building pays regardless). It represents the **additional** grid consumption solely for battery charging.
- Net cashflow formula becomes: `totalIncomeR - totalCostR - replacementCost` (unchanged structure, but `totalCostR` now includes grid charging).

