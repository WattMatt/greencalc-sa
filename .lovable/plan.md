

# Financial Analysis Refinement — Revenue Accounting Correction

## Problem

The current financial engine (`AdvancedSimulationEngine.ts`) calculates **Energy Income** as:

```text
Energy Income = Total Solar Generation x Tariff Rate
```

This is incorrect because solar energy used to **charge the battery** is not revenue — it is intermediate energy storage. Revenue should only be recognised when energy actually **displaces grid consumption** (serves load directly or via battery discharge) or is **exported to the grid**.

## Correct Revenue Model

Revenue-generating kWh = Solar directly used by load (`totalSolarUsed`) + Battery discharge to load (`totalBatteryDischarge`) + Grid export (`totalGridExport`)

The battery absorbs round-trip losses (charging/discharging efficiency), so the kWh discharged is already net of losses — no double-counting.

## Changes Required

### 1. `EnergySimulationEngine.ts` — Add revenue-relevant totals to results

Add a new field `revenueKwh` to `EnergySimulationResults` that sums `totalSolarUsed + totalBatteryDischarge + totalGridExport`. This makes the revenue-generating quantity explicit and available to all consumers.

Also add `totalGridExportRevenue` concept awareness: grid export may earn at a different rate (feed-in tariff), so the engine should separate:
- `directSolarToLoad` (displaces grid at full tariff)
- `batteryDischargeToLoad` (displaces grid at full tariff)
- `gridExport` (earns at export rate, which may differ)

### 2. `AdvancedSimulationEngine.ts` — Fix income calculation

**Current (incorrect):**
```typescript
const energyYield = baseAnnualSolar * (panelEfficiency / 100);
const energyIncomeR = energyYield * baseEnergyRate * energyRateIndex;
```

**Corrected:**
```typescript
// Revenue-generating energy = solar directly used + battery discharge + export
const baseRevenueKwh = baseEnergyResults.totalSolarUsed * 365 
                     + baseEnergyResults.totalBatteryDischarge * 365;
const baseExportKwh = baseEnergyResults.totalGridExport * 365;

// Apply degradation to revenue kWh (proportional to generation decline)
const revenueKwh = baseRevenueKwh * (panelEfficiency / 100);
const exportKwh = baseExportKwh * (panelEfficiency / 100);

// Energy Income = revenue kWh at tariff rate + export kWh at export rate
const energyIncomeR = revenueKwh * baseEnergyRate * energyRateIndex
                    + exportKwh * exportRate * energyRateIndex;
```

The `energyYield` field (total solar generation) remains for the **Energy Yield column** in the cashflow table and LCOE denominator — it represents production, not revenue.

A new `revenueKwh` field will be added to `YearlyProjection` so the table can display both total generation and revenue-earning kWh.

### 3. `AdvancedSimulationTypes.ts` — Extend `YearlyProjection`

Add fields to the projection type:
- `revenueKwh: number` — kWh that actually earn revenue (solar-to-load + battery-to-load)
- `exportKwh: number` — kWh exported to grid (earns at export rate)
- `exportIncomeR: number` — Revenue from grid export (separate line)

Update `energyIncomeR` description to clarify it covers load-displacement revenue only.

### 4. `AdvancedResultsDisplay.tsx` — Show revenue breakdown in cashflow table

Add columns or sub-columns to distinguish:
- **Energy Yield** (total production — unchanged)
- **Revenue kWh** (load displacement + battery discharge)
- **Export kWh** (grid export, if applicable)
- **Energy Income** (revenue at tariff rate)
- **Export Income** (export at feed-in rate, shown separately if export rate exists)

### 5. `FinancialAnalysis.ts` (basic engine) — Already correct

The basic `calculateFinancials` function uses a cost-avoidance model (`gridOnlyCost - withSolarCost = savings`), which inherently only counts grid displacement. No changes needed here.

### 6. `SimulationPanel.tsx` — Financial Return Outputs table

Update the **Financial Return Outputs** metrics to use revenue-based kWh where appropriate:
- **ZAR / kWh (Incl. 3-Yr O&M)**: Should use revenue kWh (not total generation) in denominator for an accurate cost-per-useful-kWh metric
- **Initial Yield**: Already correct (uses totalIncomeR which will now be revenue-based)
- Tooltip formulas updated to reflect the new revenue breakdown

### 7. `EnergySimulationResults` — Surface battery-to-load explicitly

Currently `totalSolarUsed` tracks direct solar-to-load and `totalBatteryDischarge` tracks battery-to-load. These are already separate in the engine results. No structural change needed — just ensure the advanced engine uses them correctly.

## Summary of File Changes

| File | Change |
|------|--------|
| `EnergySimulationEngine.ts` | Add `revenueKwh` computed field to results |
| `AdvancedSimulationTypes.ts` | Add `revenueKwh`, `exportKwh`, `exportIncomeR` to `YearlyProjection` |
| `AdvancedSimulationEngine.ts` | Fix income calculation to use revenue kWh instead of total generation |
| `AdvancedResultsDisplay.tsx` | Add Revenue kWh column to cashflow table; show export income if applicable |
| `SimulationPanel.tsx` | Update Financial Return Outputs tooltips to reflect revenue-based accounting |

## Key Principle

- **Energy Yield** = total solar production (for LCOE, degradation tracking)
- **Revenue kWh** = energy that displaces grid or is exported (for income calculations)
- **Battery charging** = intermediate storage, not revenue

This ensures the financial model accurately reflects that storing energy in a battery does not create value — only discharging it to serve load or export does.

