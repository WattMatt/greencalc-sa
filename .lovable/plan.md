

# Cashflow Table Restructure — LCOE Fix + Shared Energy Index + Source Split

## Overview

Three changes:
1. **LCOE denominator**: Change from total solar generation (`energyYield`) to total delivered kWh (`solarDirectKwh + batteryDischargeKwh + exportKwh`)
2. **Remove Energy Yield column**: No longer needed in the table since LCOE uses delivered kWh
3. **Single shared Energy Index column**: One index column used by all four income groups (Solar PV, Battery, Export, Demand), followed by each group's kWh, Rate, and Income columns

## New Table Layout

```text
Year | Index | Solar kWh | Solar Rate | Solar Income | Batt kWh | Batt Rate | Batt Income | Export kWh | Export Rate | Export Income | Demand kVA | Demand Rate | Demand Income | Total Income | Insurance | O&M | Replacements | Total Cost | Net Cashflow | PV Factor | Present Value | Cumulative
```

The **Index** column (escalation factor: 1.00, 1.10, 1.21...) applies equally to all four groups. Each group then shows its own kWh (or kVA), Rate (base rate x index), and Income (kWh x Rate).

**Total Income = Solar Income + Battery Income + Export Income + Demand Income**

## Technical Changes

### 1. `AdvancedSimulationTypes.ts`

Add new fields to `YearlyProjection`:
- `solarDirectKwh: number` — kWh solar consumed directly by load
- `solarDirectRateR: number` — R/kWh (base energy rate x index)
- `solarDirectIncomeR: number` — R (solarDirectKwh x solarDirectRateR)
- `batteryDischargeKwh: number` — kWh battery discharged to load
- `batteryDischargeRateR: number` — R/kWh (base energy rate x index)
- `batteryDischargeIncomeR: number` — R (batteryDischargeKwh x batteryDischargeRateR)
- `exportRateR: number` — R/kWh (export rate x index)

Update `discountedEnergyYield` comment to clarify it now discounts delivered kWh, not total generation.

Update `ColumnTotals` to include sums for each new column.

### 2. `AdvancedSimulationEngine.ts`

**Split revenue calculation** (in the yearly loop, ~lines 387-433):
```
baseSolarDirectKwh = baseEnergyResults.totalSolarUsed * 365
baseBatteryDischargeKwh = baseEnergyResults.totalBatteryDischarge * 365
baseExportKwh = baseEnergyResults.totalGridExport * 365

// Apply degradation
solarDirectKwh = baseSolarDirectKwh * (panelEfficiency / 100)
batteryDischargeKwh = baseBatteryDischargeKwh * (panelEfficiency / 100)
exportKwh = baseExportKwh * (panelEfficiency / 100)

// Income per source
solarDirectIncomeR = solarDirectKwh * baseEnergyRate * energyRateIndex
batteryDischargeIncomeR = batteryDischargeKwh * baseEnergyRate * energyRateIndex
exportIncomeR = exportKwh * exportRate * energyRateIndex

energyIncomeR = solarDirectIncomeR + batteryDischargeIncomeR + exportIncomeR
```

**Fix LCOE denominator** (~line 493):
Change `discountedEnergyYield` to use delivered kWh instead of total generation:
```
const deliveredKwh = solarDirectKwh + batteryDischargeKwh + exportKwh;
const discountedEnergyYield = deliveredKwh / Math.pow(1 + lcoeRate / 100, year);
```

The `energyYield` field (total generation) remains calculated for legacy compatibility and charts, but is no longer displayed in the cashflow table or used for LCOE.

Push all new fields into the projection object.

### 3. `AdvancedResultsDisplay.tsx`

**Replace table headers** (~lines 294-316):
- Remove: "Energy Yield (kWh)", "Revenue kWh", "Export kWh" columns
- Remove: "Energy Index", "Energy Rate", "Energy Income", "Export Income" columns
- Remove: "Demand Index" column
- Add: Single "Index" column (shared escalation factor)
- Add: "Solar kWh", "Solar Rate", "Solar Income" group
- Add: "Batt kWh", "Batt Rate", "Batt Income" group
- Add: "Export kWh", "Export Rate", "Export Income" group
- Keep: "Demand kVA", "Demand Rate", "Demand Income" group (remove separate Demand Index)

**Update row cells** (~lines 349-425):
Map each row to the new column structure using the new projection fields.

**Update Year 0 row** (~lines 320-348):
Adjust dash placeholders to match new column count.

**Update totals row** (~lines 427-449):
Sum each kWh and income column; show "-" for rate and index columns.

### 4. `LoadSheddingScenarios.ts`

Add default values (0) for all new fields to maintain compatibility.

## Summary

| File | Change |
|------|--------|
| `AdvancedSimulationTypes.ts` | Add solarDirect/batteryDischarge fields to YearlyProjection |
| `AdvancedSimulationEngine.ts` | Split revenue into 3 sources; fix LCOE to use delivered kWh |
| `AdvancedResultsDisplay.tsx` | Restructure table: single Index + 4 source groups |
| `LoadSheddingScenarios.ts` | Add default values for new fields |

## Key Principle

- **LCOE denominator** = NPV of delivered kWh (Solar Direct + Battery + Export) — not total solar generation
- **Index** = single escalation factor column shared by all income sources
- **Each source** = kWh + Rate + Income (3 columns per source)
- **Total Income** = Solar Income + Battery Income + Export Income + Demand Income

