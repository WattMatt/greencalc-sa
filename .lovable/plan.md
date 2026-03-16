

## Bug: Specific Yield Using AC Capacity Instead of DC Capacity

### Problem

The displayed specific yield of **2,847 kWh/kWp/yr** is approximately double what it should be (~1,339). The root cause is on **line 462 of `SimulationPanel.tsx`**:

```
calculatedSpecificYield={annualPVsystResult
  ? Math.round(annualPVsystResult.specificYield)
  : Math.round(engine.annualEnergyResults.totalAnnualSolar / solarCapacity)}
```

`solarCapacity` is **AC capacity** (inverterSize × inverterCount = e.g. 1,875 kW), but specific yield must be divided by **DC capacity in kWp** (e.g. 2,250 kWp). With a 1.2 DC/AC ratio, this inflates the result by ~1.2×. Combined with the simplified model's higher generation (no clipping/temperature losses), the result lands at ~2,847.

The same issue affects the `overrideScaleFactor` simplified fallback on line 251, which also uses `solarCapacity` instead of DC capacity.

### Fix

**File: `src/components/projects/SimulationPanel.tsx`**

1. **Line 462** — Replace `solarCapacity` with `moduleMetrics.actualDcCapacityKwp`:
   ```
   : Math.round(engine.annualEnergyResults.totalAnnualSolar / moduleMetrics.actualDcCapacityKwp)
   ```

2. **Line 251** — Fix the simplified fallback in `overrideScaleFactor`:
   ```
   const calculatedYield = annualPVsystResult?.specificYield
     ?? (moduleMetrics.actualDcCapacityKwp > 0
       ? engine.annualEnergyResults.totalAnnualSolar / moduleMetrics.actualDcCapacityKwp
       : 0);
   ```

This ensures specific yield always uses DC capacity (kWp) as the denominator, matching the PVsyst path which correctly uses `capacityKwp`.

