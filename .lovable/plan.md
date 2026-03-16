

## Bug: Displayed Daily Output & Specific Yield Don't Match Simplified Math

### Root Cause

There are **two disconnected solar profile paths** in simplified mode:

1. **`useSolarProfiles`** → creates `solarProfile` using real GHI data from PVGIS, proper system efficiency, and reduction factor. This profile is mathematically correct but **not used by the engine for the annual simulation**.

2. **`useLoadProfileData`** → creates `pvGeneration` (chart data) using a **hardcoded bell curve** (`[0, 0, 0, ..., 0.92, 1.0, 0.98, ...]`) multiplied by DC capacity. This does NOT incorporate GHI data or the production reduction factor. The engine's `totalAnnualSolar` comes from this path.

When we display `engine.annualEnergyResults.totalAnnualSolar / 365` as daily output and `/ dcCapacity` as specific yield, the values are inflated because they're based on the bell curve, not the GHI-based simplified model.

For Kingswalk:
- **Bell curve path** gives ~14,626 kWh/day → yield ~2,372 kWh/kWp/yr
- **GHI-based path** should give ~8,500 kWh/day → yield ~1,380 kWh/kWp/yr

### Fix

**File: `src/components/projects/SimulationPanel.tsx`**

Use `solarProfile` (from `useSolarProfiles`, which is GHI-based and includes reduction factor) to compute the displayed metrics and override scale factor, instead of the engine's `totalAnnualSolar`.

**1. Compute `simplifiedDailyOutput` from `solarProfile` (add after line 246):**
```typescript
const simplifiedDailyOutput = useMemo(() => 
  solarProfile.reduce((sum, v) => sum + v, 0),
  [solarProfile]
);
```

**2. Fix `overrideScaleFactor` (lines 249-263)** — use `simplifiedDailyOutput` and derive yield from it:
```typescript
const overrideScaleFactor = useMemo(() => {
  const dcCapacity = moduleMetrics.actualDcCapacityKwp;
  const dailyOut = annualPVsystResult
    ? annualPVsystResult.eGrid / 365
    : simplifiedDailyOutput;
  const calcYield = annualPVsystResult?.specificYield
    ?? (dcCapacity > 0 ? (dailyOut * 365) / dcCapacity : 0);

  if (specificYieldOverride !== null && calcYield > 0) {
    return specificYieldOverride / calcYield;
  } else if (dailyOutputOverride !== null && dailyOut > 0) {
    return dailyOutputOverride / dailyOut;
  }
  return 1.0;
}, [specificYieldOverride, dailyOutputOverride, annualPVsystResult, 
    moduleMetrics.actualDcCapacityKwp, simplifiedDailyOutput]);
```

**3. Fix displayed values (lines 462-463)** — use `simplifiedDailyOutput` and DC capacity:
```typescript
calculatedDailyOutput={annualPVsystResult 
  ? Math.round(annualPVsystResult.eGrid / 365) 
  : Math.round(simplifiedDailyOutput)}
calculatedSpecificYield={annualPVsystResult 
  ? Math.round(annualPVsystResult.specificYield) 
  : Math.round(moduleMetrics.actualDcCapacityKwp > 0 
      ? (simplifiedDailyOutput * 365) / moduleMetrics.actualDcCapacityKwp 
      : 0)}
```

This ensures all three values (daily output, specific yield, and override scale factor) derive from the same GHI-based simplified profile that matches the mathematical model explained to the user.

