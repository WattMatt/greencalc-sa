

## Bug: Annual Production KPI Still Uses Engine's Bell-Curve Value

### Problem

The "Annual Production" KPI card displays **5,338,518 kWh** (from the engine's `totalAnnualSolar`) instead of the correct **~3,013,340 kWh** (from the GHI-based `simplifiedDailyOutput`).

The Daily Output and Specific Yield fields in the Solar Modules pane were fixed to use `simplifiedDailyOutput`, but the KPI card on line 504 still passes `engine.annualEnergyResults.totalAnnualSolar` directly:

```typescript
annualSolar={engine.annualEnergyResults.totalAnnualSolar}
```

In simplified mode, the engine's solar total comes from the hardcoded bell-curve `pvGeneration` profile (~14,626 kWh/day), not the GHI-based profile (~8,256 kWh/day).

### Fix

**File: `src/components/projects/SimulationPanel.tsx`, line 504**

Replace the `annualSolar` prop to use `simplifiedDailyOutput * 365` in simplified mode:

```typescript
annualSolar={annualPVsystResult 
  ? engine.annualEnergyResults.totalAnnualSolar 
  : simplifiedDailyOutput * 365}
```

This ensures the Annual Production KPI card matches the Daily Output and Specific Yield values already corrected in the Solar Modules pane.

