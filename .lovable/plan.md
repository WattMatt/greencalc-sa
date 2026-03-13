
Goal
- Make specific yield / daily output overrides actually recalculate annual simulation outputs (Annual Production, Grid Import, self-consumption, financials), not just UI fields.

What I found
- `SimulationPanel.tsx` computes `effectiveReductionFactor` correctly from overrides.
- `useSimulationEngine.ts` receives `reductionFactor` but does not apply it to the solar profiles used by `runAnnualEnergySimulation`.
- Main annual simulation uses:
  - `chartSolarProfile` (from load-profile chart data), which is currently unscaled by override/base reduction.
  - Optional `tmySolarProfile8760`, which is already base-reduced in `useSolarProfiles`.
- Result: override changes do not propagate into the annual engine totals.

Implementation plan
1) Split scaling intent in `SimulationPanel.tsx`
- Keep:
  - `baseReductionFactor` = existing production reduction from solar profiles hook.
  - `overrideScaleFactor` = user override ratio (specific yield first, then daily output).
  - `effectiveReductionFactor = baseReductionFactor * overrideScaleFactor`.
- Pass both factors to `useSimulationEngine`:
  - `baseReductionFactor`
  - `overrideScaleFactor`
  - (and keep `effectiveReductionFactor` for KPI/financial display props).

2) Apply scaling where simulation inputs are built (`useSimulationEngine.ts`)
- Extend `SimulationEngineConfig` with `baseReductionFactor` and `overrideScaleFactor`.
- Build scaled solar inputs with memoization:
  - `scaledChartSolarProfile = chartSolarProfile * (baseReductionFactor * overrideScaleFactor)` for primary annual simulation path.
  - `scaledTmySolarProfile8760 = tmySolarProfile8760 * overrideScaleFactor` (TMY already has base reduction applied upstream).
  - `scaledSolarProfileGeneric = solarProfileGeneric * overrideScaleFactor`.
  - `scaledSolarProfileSolcast = solarProfileSolcast * overrideScaleFactor`.
- Use these scaled arrays in all `runAnnualEnergySimulation(...)` calls (main + comparison).

3) Keep UI totals consistent
- Continue using `effectiveReductionFactor` in KPI/financial cards where already wired.
- Ensure main source-of-truth annual totals come from the newly scaled engine outputs.

Technical details
- Avoid double-applying base reduction for TMY and generic/solcast profiles (they already include base reduction from `useSolarProfiles`).
- Guard against invalid math:
  - If baseline yield/daily is 0, fallback `overrideScaleFactor = 1`.
  - Prevent `NaN`/`Infinity` from propagating.
- Update hook dependency arrays so override edits trigger recomputation immediately.

Validation checklist
- Change “Specific yield” and confirm these update live:
  - Annual Production
  - Grid Import
  - Self-Consumption / Peak Reduction
  - Financial outputs tied to annual kWh
- Change “Expected daily output” and verify same behavior.
- Reset buttons should return outputs to calculated baseline.
- Test with and without TMY data source to confirm scaling logic is correct in both paths.
