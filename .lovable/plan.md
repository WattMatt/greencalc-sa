

## Simplify DC Capacity & Specific Yield Calculations

### Problem
1. **DC Capacity** is currently derived from module count rounding (`moduleCount × moduleWattage`), giving an `actualDcCapacityKwp` that differs from the simple `AC × DC/AC ratio`. The user wants: **DC = System Size AC × DC/AC Ratio** — no module rounding.
2. **Specific Yield** should be derived directly from the annual GHI value shown in Solar Forecast (kWh/m²/year) by applying system efficiency: **Specific Yield = GHI (kWh/m²/year) × n_system (0.85) × (1 - production reduction)**. Currently it's back-calculated from the hourly profile sum.

### Changes

**File 1: `src/components/projects/SimulationPanel.tsx`**

Update the `calculatedSpecificYield` and `calculatedDailyOutput` passed to `SolarModulesPane` for the simplified mode:

- **DC Capacity**: Use `solarCapacity * inverterConfig.dcAcRatio` directly (instead of `moduleMetrics.actualDcCapacityKwp`)
- **Specific Yield (simplified)**: `annualGHI × 0.85 × reductionFactor` — this converts the kWh/m²/year GHI directly to kWh/kWp/year
- **Daily Output (simplified)**: `DC_capacity × (specificYield / 365)`

This keeps the PVsyst mode unchanged (it has its own loss chain).

**File 2: `src/components/projects/simulation/SolarModulesPane.tsx`**

No structural changes — it already receives `calculatedDailyOutput` and `calculatedSpecificYield` as props. Optionally display "DC Capacity" as a read-only line showing `AC × DC/AC`.

### Math Summary

```text
DC Capacity   = AC System Size × DC/AC Ratio
Specific Yield = Annual GHI (kWh/m²/yr) × 0.85 × (1 - prodReduction%)
Daily Output   = DC Capacity × Specific Yield / 365
Annual Prod    = DC Capacity × Specific Yield
```

For Kingswalk (example):
- AC = 1,680 kW, DC/AC = 1.3 → DC = 2,184 kWp
- Annual GHI = 1,971 kWh/m²/yr, n_system = 0.85, reduction = 15%
- Specific Yield = 1,971 × 0.85 × 0.85 = 1,424 kWh/kWp/yr
- Daily Output = 2,184 × 1,424 / 365 = 8,520 kWh/day

