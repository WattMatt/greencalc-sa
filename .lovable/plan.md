
# Simulation Tab: Review and Optimisation Plan

## Status: ✅ COMPLETE

All four phases have been implemented. The simulation tab has been refactored from a 2,817-line monolith into a modular system.

---

## Final Architecture

### Custom Hooks
- **`useSolarProfiles.ts`** — Solar data fetching (Solcast/PVGIS) and 8,760h profile generation
- **`useSimulationEngine.ts`** — 8,760h energy simulation orchestration, financial analysis, advanced 20-year cashflows, chart data merging
- **`useAutoSave.ts`** — Debounced auto-save with ref-based change tracking (no JSON.stringify)

### UI Components
- **`SimulationKPICards.tsx`** — Energy summary KPI cards
- **`SimulationChartTabs.tsx`** — Chart visualisation tabs
- **`FinancialConfigPane.tsx`** — Tariff selection and financial return metrics (NPV, IRR, LCOE, Payback)

### Logic Utilities
- **`restoreSimulationState.ts`** — Standardised snapshot rehydration (single source of truth for config restore)
- **`simulationConfig.ts`** — Centralised `calculateTotalSystemCost()` and deep-merge utilities

### Performance Optimisations
- Comparison simulations (Solcast/Generic) deferred behind `comparisonTabViewed` flag
- `DEFAULT_SYSTEM_COSTS` uses proxy-based lazy singleton with 5-second TTL
- `runEnergySimulation` (24h) marked `@deprecated` — all paths use annual engine
- Console.log statements removed from hot paths
- "No Defaults" violations fixed in SavedSimulations.tsx

---

## Completed Phases

### Phase 1: Quick Wins ✅
1. ✅ Fixed "No Defaults" in SavedSimulations.tsx — `|| 0` everywhere
2. ✅ Removed console.log from hot paths
3. ✅ Deferred comparison simulations behind `comparisonTabViewed` flag

### Phase 2: Shared Utilities ✅
4. ✅ Created `restoreSimulationState.ts` — consolidated 3 copies of deep-merge logic
5. ✅ Created `calculateTotalSystemCost()` in `simulationConfig.ts`
6. ✅ Auto-save uses direct value deps (no JSON.stringify)

### Phase 3: Component Extraction ✅
7. ✅ State management kept inline (extracting would increase complexity without clarity gains)
8. ✅ Extracted `useSimulationEngine` hook (~350 lines)
9. ✅ Extracted `useAutoSave` hook
10. ✅ Extracted `SimulationKPICards.tsx`
11. ✅ Extracted `SimulationChartTabs.tsx`
12. ✅ Extracted `FinancialConfigPane.tsx`
13. ✅ Extracted `useSolarProfiles.ts` (~300 lines)

### Phase 4: Engine Optimisation ✅
14. ✅ `runEnergySimulation` marked `@deprecated`, unused import removed from LoadSheddingScenarios
15. ✅ `DEFAULT_SYSTEM_COSTS` cached with lazy singleton + TTL
16. ⏭️ Duplicate `useLoadProfileData` kept — both use fallback path (O(tenants*24), minimal overhead); eliminating would require major chart refactor

---

## Impact Summary

| Area | Before | After |
|------|--------|-------|
| SimulationPanel.tsx | 2,817 lines | ~1,013 lines (64% reduction) |
| Unnecessary simulation runs | 3× 8,760h on every change | 1× primary + lazy comparisons |
| Config restore duplication | 3 copies | 1 shared utility |
| System cost duplication | 3 copies | 1 shared utility |
| JSON.stringify per render | 6 calls | 0 (direct value deps) |
| Console.log in hot path | 5+ statements | 0 |
| "No Defaults" violations | SavedSimulations.tsx | Fixed |
