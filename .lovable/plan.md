

## Analysis: Solar Generation Discrepancy & Degradation

### Why the chart shows ~5.7M kWh instead of ~2.7M kWh

There are **two separate calculation paths** that have diverged:

| Path | Value | Used By |
|------|-------|---------|
| **Simplified chain** | ~2.7M kWh | KPI cards (`effectiveAnnualProduction`) |
| **8,760-hour engine** | ~5.7M kWh | Financial chart, cashflow, NPV, IRR |

The 20-year chart and all financial metrics use `annualEnergyResults.totalAnnualSolar` from the hourly engine. The KPI cards use the simplified algebraic chain (`GHI × 0.85 × DC Capacity ÷ DC/AC Ratio`). The override scale factor was applied to the KPI cards but **not propagated into the 8,760-hour engine's base results** that feed the financial projections.

### Why degradation appears absent

Degradation **is** applied in the chart (`energyYield = baseAnnualSolar × panelEfficiency/100`), but at 0.5%/yr the drop from Year 1 to Year 20 is only ~9.5% — from ~5.7M to ~5.2M kWh. On a chart with a Y-axis starting at 0, this looks nearly flat.

### Proposed Fix

**Unify the source of truth** so the KPI cards and the financial engine use the same annual solar value.

**In `SimulationPanel.tsx`** — when the 8,760-hour engine runs, pass the `overrideScaleFactor` into `useSimulationEngine` so it scales `totalAnnualSolar` before it enters the financial projections. This ensures:
- The chart's Year 1 generation matches the KPI "Annual Production"
- NPV, IRR, LCOE, Payback are all based on the same ~2.7M figure
- Degradation applies on top of the correct baseline

**In `useSimulationEngine.ts`** — multiply `totalAnnualSolar` (and related solar splits) by the override scale factor before passing to `calculateAdvancedFinancials()`.

**Result**: Chart Year 1 will show ~2.7M kWh, degrading to ~2.5M by Year 20, consistent with the KPI cards and all financial outputs.

