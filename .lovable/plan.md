

# Fix PV DC Output and Clipping to Use TMY Data

## Problem
The PV DC output line and clipping values on the Solar Chart are calculated from the old static 24-hour normalised profile (in `useLoadProfileData.ts`), while the AC generation bars now come from the TMY 8,760-hour engine data. This mismatch causes a visible offset between the DC line and the AC bars.

## Solution
Update the conversion utility to return both DC (pre-clipping) and AC (post-clipping) arrays, then use the DC array in the chart merge step to overwrite `pvDcOutput` and `pvClipping`.

## Changes

### 1. Update `tmySolarConversion.ts` -- Return DC and AC arrays

Change the return type from `number[]` to `{ dcOutput: number[], acOutput: number[] }`.

- Add an optional `maxAcOutputKw` parameter to `TMYConversionParams`
- `dcOutput`: the raw hourly values (existing calculation, unchanged)
- `acOutput`: each hour capped at `maxAcOutputKw` (inverter AC limit)
- When `maxAcOutputKw` is not provided, both arrays are identical (no clipping)

### 2. Update `SimulationPanel.tsx` -- Store and use both arrays

In the `tmySolarProfile8760` memo:
- Pass `solarCapacity` (the AC inverter size) as `maxAcOutputKw`
- Destructure the result into `tmyDcProfile8760` and `tmyAcProfile8760`
- Pass `tmyAcProfile8760` to `runAnnualEnergySimulation` (same as before, but now explicitly AC-clipped)

In the `simulationChartData` merge (lines 1099-1117):
- When `tmyDcProfile8760` is available, calculate the day index and use `tmyDcProfile8760[dayIndex * 24 + i]` for `pvDcOutput`
- Calculate `pvClipping` as `max(0, pvDcOutput - solarCapacity)`

### 3. No other files change

The `EnergySimulationEngine`, `useLoadProfileData`, and chart components remain unchanged -- they already consume `pvDcOutput` and `pvClipping` from the merged chart data.

## Technical Detail

```text
tmySolarConversion.ts:
  interface TMYConversionParams {
    ...existing fields...
    maxAcOutputKw?: number;  // NEW: inverter AC limit for clipping
  }

  Returns: { dcOutput: number[], acOutput: number[] }

SimulationPanel.tsx merge:
  const dayIndex = cycleDay;  // already available
  const idx = dayIndex * 24 + i;
  merged.pvDcOutput = tmyDcProfile8760[idx] || 0;
  merged.pvClipping = Math.max(0, merged.pvDcOutput - solarCapacity);
```

## Files Modified
1. **`src/utils/calculators/tmySolarConversion.ts`** -- New return type with DC/AC split, add `maxAcOutputKw` param
2. **`src/components/projects/SimulationPanel.tsx`** -- Destructure DC/AC arrays, pass AC to engine, use DC in chart merge

