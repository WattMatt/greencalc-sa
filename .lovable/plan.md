

## Fix: Specific Yield Override Should Drive Simulation Output

### Problem
The `specificYieldOverride` and `dailyOutputOverride` fields in the Solar Modules pane are cosmetic — they update the displayed input value but are never fed into the simulation engine or KPI cards. The engine always uses its own calculated solar output regardless of what the user types.

### Solution
When the user sets a `specificYieldOverride`, scale the simulation's solar production accordingly. The simplest approach:

1. **Derive an override-based reduction factor** — If the user overrides specific yield, calculate a scaling ratio: `overrideYield / calculatedYield`. Multiply this with the existing `reductionFactor` to produce an `effectiveReductionFactor`.

2. **Pass `effectiveReductionFactor` to the engine and KPI cards** instead of `reductionFactor` — This way the 8,760-hour simulation scales all solar output by the user's override, and all downstream metrics (Annual Production, Grid Import, Self-Consumption, financials) update automatically.

3. **Same for `dailyOutputOverride`** — If set, derive the implied annual production and compute the scaling ratio from that.

4. **Priority**: If both overrides are set, `specificYieldOverride` takes precedence (since daily output can be derived from it).

### Files to Change

**`src/components/projects/SimulationPanel.tsx`**
- Compute `effectiveReductionFactor` from overrides + base `reductionFactor`
- Pass `effectiveReductionFactor` to `useSimulationEngine()` and `SimulationKPICards` instead of `reductionFactor`

### Logic
```
calculatedYield = annualPVsystResult?.specificYield ?? (annualSolar / solarCapacity)
if specificYieldOverride:
  scaleFactor = specificYieldOverride / calculatedYield
elif dailyOutputOverride:
  calculatedDaily = annualSolar / 365
  scaleFactor = dailyOutputOverride / calculatedDaily
else:
  scaleFactor = 1.0

effectiveReductionFactor = reductionFactor * scaleFactor
```

This keeps the override mechanism simple — one multiplication — and all existing downstream logic (engine, KPIs, financials) works unchanged since they already consume `reductionFactor`.

