

# Fix DC/AC Split Using PVsyst Loss Chain Properly

## Problem

The current `tmySolarConversion.ts` applies **all** PVsyst losses (irradiance, array, inverter, and post-inverter) into a single combined multiplier, then calls the result "dcOutput." This means the DC output already includes inverter conversion losses, making it nearly identical to AC output. The PVsyst methodology clearly separates these:

- **DC output** = energy after irradiance losses and array losses (at the panel/string level)
- **AC output** = DC output minus inverter losses and post-inverter losses (at the grid-connection point)

Additionally:
- The `pv1to1Baseline` dashed line still comes from the old static 24-hour profile, not TMY data
- The Inverter AC Limit reference line uses `solarCapacity` (the slider value) instead of the actual inverter total capacity (`inverterSize x inverterCount`)

## Solution

Split the loss chain in `tmySolarConversion.ts` into two distinct multipliers following PVsyst methodology, fix the baseline calculation, and use the correct inverter capacity.

## Changes

### 1. `src/utils/calculators/tmySolarConversion.ts` -- Split loss chain into DC and AC stages

Replace the single `calculateCombinedLossMultiplier` with two functions:

- **`calculateDcLossMultiplier`** -- irradiance losses (transposition, shading, IAM, soiling) and array losses (spectral, electrical shading, irradiance level, temperature, module quality, LID, degradation, mismatch, ohmic). This represents losses up to the DC bus.
- **`calculateInverterLossMultiplier`** -- inverter losses (efficiency, over-nominal power, max input current, voltage thresholds) and post-inverter losses (availability). This represents the DC-to-AC conversion.

Update the per-hour calculation:
```
dcOutput[i] = GHI * area * stcEfficiency * dcLossMultiplier * reductionFactor / 1000
acBeforeClip = dcOutput[i] * inverterLossMultiplier
acOutput[i] = min(acBeforeClip, maxAcOutputKw)   // inverter AC limit
```

Return `inverterLossMultiplier` in the result so the caller can compute the 1:1 baseline.

Update the `TMYConversionResult` interface:
```
interface TMYConversionResult {
  dcOutput: number[];              // 8,760 hourly DC values (after irradiance + array losses)
  acOutput: number[];              // 8,760 hourly AC values (after inverter losses + clipping)
  inverterLossMultiplier: number;  // For 1:1 baseline calculation
}
```

### 2. `src/components/projects/SimulationPanel.tsx` -- Use correct inverter capacity, recalculate baseline

In the `tmyConversionResult` memo:
- Pass `inverterConfig.inverterSize * inverterConfig.inverterCount` as `maxAcOutputKw` (not `solarCapacity`)
- Extract `inverterLossMultiplier` from the result

In the `simulationChartData` merge step:
- Use TMY `dcOutput` for `pvDcOutput` (now correctly represents panel-level DC)
- Calculate `pvClipping` as `max(0, dcOutput * inverterLossMultiplier - inverterTotalCapacity)`
- Recalculate `pv1to1Baseline` from TMY data: `(dcOutput / dcAcRatio) * inverterLossMultiplier` (what AC would be if DC array were sized 1:1 with inverter, no oversizing)

Update `maxPvAcKva` prop passed to `SolarChart`:
- Change from `solarCapacity` to `inverterConfig.inverterSize * inverterConfig.inverterCount`

### 3. No changes to other files

The `EnergySimulationEngine`, `useLoadProfileData`, `SolarChart`, and `pvsystLossChain.ts` remain unchanged. The engine continues to receive the AC-clipped `acOutput` array.

## Technical Detail

The PVsyst loss chain stages map as follows:

```text
GHI (W/m2)
  |
  v
[Irradiance Losses]     \
  - Transposition         |
  - Near Shading          |  dcLossMultiplier
  - IAM                   |
  - Soiling               |
[Array Losses]            |
  - Spectral              |
  - Electrical Shading    |
  - Irradiance Level      |
  - Temperature           |
  - Module Quality        |
  - LID                   |
  - Degradation           |
  - Mismatch              |
  - Ohmic Wiring         /
  |
  v
DC OUTPUT (panel bus)    <-- This is pvDcOutput on the chart
  |
  v
[Inverter Losses]        \
  - Efficiency            |  inverterLossMultiplier
  - Over Nominal Power    |
  - Max Input Current     |
  - Voltage Thresholds    |
[Post-Inverter Losses]    |
  - System Availability  /
  |
  v
AC OUTPUT (pre-clip)
  |
  v
[Inverter AC Clipping]   <-- min(acPreClip, inverterTotalCapacity)
  |
  v
AC OUTPUT (final)        <-- This is pvGeneration on the chart
```

## Files Modified
1. `src/utils/calculators/tmySolarConversion.ts` -- Split loss multiplier into DC and inverter stages, return `inverterLossMultiplier`
2. `src/components/projects/SimulationPanel.tsx` -- Use inverter total capacity for clipping and AC limit line, recalculate `pv1to1Baseline` from TMY DC data

