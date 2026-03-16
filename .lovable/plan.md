

## Add Formula Hover Tooltips to KPI Cards

### What
Add hover tooltips to the 6 KPI cards at the bottom of the Profile Builder tab (Daily Load, Solar Generated, Annual Production, Grid Import, Self-Consumption, Peak Reduction). On hover, each card shows the formula and actual values used — matching the existing `FinancialMetricRow` tooltip pattern.

### Changes

**1. Create `src/components/projects/simulation/MetricTooltip.tsx`**
- Reusable HoverCard wrapper accepting `formula: string` and `inputs: {label, value}[]`
- Wraps children (the numeric value) with dashed underline + cursor-help
- On hover shows formula header + inputs table (same visual style as `FinancialMetricRow` tooltips)

**2. Update `SimulationKPICards.tsx`**
- Add a `breakdowns` prop: a record mapping each metric to `{ formula, inputs[] }`
- Wrap each `CardTitle` value in `MetricTooltip`

**3. Update `SimulationPanel.tsx` (~line 502)**
- Build breakdown objects using values already in scope and pass to `SimulationKPICards`:

| Card | Formula | Inputs |
|------|---------|--------|
| Daily Load | `Annual Load ÷ 365` | `annualLoad` |
| Solar Generated | `Annual Solar ÷ 365` | `annualSolar` |
| Annual Production | PVsyst: `eGrid × reductionFactor`; Simplified: `dailyOutput × 365` | relevant values |
| Grid Import | `Annual Grid Import ÷ 365` | `annualGridImport` |
| Self-Consumption | `(Solar Used On-Site ÷ Total Solar) × 100` | `totalSolarUsed`, `totalSolar` |
| Peak Reduction | `(Peak Load − Peak Grid Import) ÷ Peak Load × 100` | `peakLoad`, `peakGridImport` |

All values are already available via `engine.annualEnergyResults` and existing local variables — no new computation needed, just formatting them into breakdown objects.

