

# Fix: Solar Generation Not Reflecting Module/Inverter Configuration

## Problem

After the previous fix, the main engine path correctly uses `moduleMetrics.actualDcCapacityKwp`. However, three **simplified solar profile generators** still use `solarCapacity` (the AC system size) instead of the actual DC capacity derived from the selected module. These profiles feed into comparison engine runs and the Load Shedding Analysis panel, causing inconsistency.

## Affected Code Paths

All in `src/components/projects/SimulationPanel.tsx`:

1. **`solarProfileSolcastSimplified`** (~line 722): `generateSolarProfile(pvConfig, solarCapacity, solcastHourlyProfile)`
2. **`solarProfilePVGISSimplified`** (~line 728): `generateSolarProfile(pvConfig, solarCapacity, pvgisHourlyProfile)`
3. **`solarProfileGenericSimplified`** (~line 734): `generateSolarProfile(pvConfig, solarCapacity, undefined)`

These profiles are consumed by:
- `annualEnergyResultsGeneric` and `annualEnergyResultsSolcast` (comparison engine runs)
- `LoadSheddingAnalysisPanel` (via the `solarProfile` variable)
- The `solarProfile` selector (lines 835-851) which picks between PVsyst and simplified modes

## Root Cause

`generateSolarProfile()` (in `PVSystemConfig.tsx`) expects a **DC capacity in kWp** as its second argument (`capacityKwp`), but all three calls pass `solarCapacity`, which is the **AC system size**. When a user changes the module type, `moduleMetrics.actualDcCapacityKwp` changes but `solarCapacity` stays the same, so the simplified profiles never update.

## Solution

Replace `solarCapacity` with `moduleMetrics.actualDcCapacityKwp` in all three simplified profile generators. Also add `moduleMetrics` to their dependency arrays.

### Changes (single file: `SimulationPanel.tsx`)

**Line 724** -- Change:
```
generateSolarProfile(pvConfig, solarCapacity, solcastHourlyProfile)
```
to:
```
generateSolarProfile(pvConfig, moduleMetrics.actualDcCapacityKwp, solcastHourlyProfile)
```

**Line 730** -- Change:
```
generateSolarProfile(pvConfig, solarCapacity, pvgisHourlyProfile)
```
to:
```
generateSolarProfile(pvConfig, moduleMetrics.actualDcCapacityKwp, pvgisHourlyProfile)
```

**Line 735** -- Change:
```
generateSolarProfile(pvConfig, solarCapacity, undefined)
```
to:
```
generateSolarProfile(pvConfig, moduleMetrics.actualDcCapacityKwp, undefined)
```

Update all three dependency arrays to replace `solarCapacity` with `moduleMetrics.actualDcCapacityKwp` (or `moduleMetrics`).

### Cleanup

Remove the debug `console.log` statements from the `moduleMetrics` useMemo block (lines 489-495) now that the fix is verified.

### Impact

- All solar profile paths (simplified, PVsyst hourly, PVsyst annual, TMY 8760-hour) will consistently use actual DC capacity derived from the selected module
- Comparison charts (Generic vs Solcast vs PVGIS) will correctly reflect module selection
- Load Shedding Analysis panel will use accurate solar generation
- Financial costing continues to use `solarCapacity` (AC) for system cost, which is correct

