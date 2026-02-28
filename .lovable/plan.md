
# Simulation Tab: Review and Optimisation Plan

## Overview

The simulation tab consists of **~5,500 lines** across the core files:
- `SimulationPanel.tsx` (2,817 lines) -- the main orchestrator
- `EnergySimulationEngine.ts` (1,066 lines) -- 8,760-hour dispatch engine
- `AdvancedSimulationEngine.ts` (831 lines) -- multi-year projections
- `FinancialAnalysis.ts` (463 lines) -- tariff-based cost calculations
- `SavedSimulations.tsx` (645 lines) -- save/load/compare UI

## Findings

### 1. SimulationPanel.tsx is a 2,817-line monolith

This is the single biggest issue. The file mixes:
- **~30 useState declarations** (lines 205-312)
- Config loading/restoration logic (~130 lines, lines 340-472)
- Solar profile generation (5 separate useMemo blocks, lines 714-843)
- Energy simulation orchestration (lines 912-926)
- Financial calculations (lines 980-1096)
- Auto-save mutation and debounce logic (lines 1224-1399)
- Chart data merge logic (lines 1100-1147)
- **~1,000 lines of JSX** rendering config panels, KPI cards, chart tabs, and comparison views

**Proposed refactor**: Extract into focused custom hooks and sub-components.

### 2. Redundant simulation runs

Three separate `runAnnualEnergySimulation` calls exist (lines 912-926):
- `annualEnergyResults` -- primary (with TMY 8760)
- `annualEnergyResultsGeneric` -- generic profile comparison
- `annualEnergyResultsSolcast` -- Solcast comparison

Each runs 8,760 iterations. The Generic and Solcast comparison runs execute on **every config change** even when the Data Comparison tab is rarely viewed.

**Proposed fix**: Defer the comparison simulations behind a flag or lazy computation so they only run when the user opens the comparison tab.

### 3. Duplicate `useLoadProfileData` hook calls

Two calls to `useLoadProfileData` exist (lines 588-636):
- `stableChartData` -- all days/months (for the engine)
- `loadProfileChartData` -- filtered by selected day (for charts)

Both compute full tenant load profiles independently. The stable one never changes, but the per-day one recalculates on every day navigation.

**Proposed fix**: Derive the per-day chart data from the stable data or from the engine's `hourlyData` directly, eliminating the second hook call.

### 4. `JSON.stringify` in useEffect dependency arrays

The auto-save `useEffect` (lines 1361-1384) uses `JSON.stringify()` on 6 objects (`pvConfig`, `inverterConfig`, `pvsystConfig`, `advancedConfig`, `systemCosts`, `dispatchConfig`, `dischargeTouSelection`) every render cycle. This creates string allocations on every render even when nothing changed.

**Proposed fix**: Replace with a single hash/checksum of the config state, or use `useRef` to track previous values.

### 5. Console.log statements in production code

Multiple `console.log` calls exist in the hot path:
- Lines 777-793 in `annualPVsystResult` useMemo (fires on every config change)
- Line 344 in auto-load useEffect

**Proposed fix**: Remove or gate behind a debug flag.

### 6. Hardcoded fallback values in SavedSimulations.tsx

`SavedSimulations.tsx` line 352-354 still has the old non-zero defaults:
```typescript
solarCapacity: sim.solar_capacity_kwp || 100,
batteryCapacity: sim.battery_capacity_kwh || 50,
batteryPower: sim.battery_power_kw || 25,
```

This violates the "No Defaults" policy -- loading a saved simulation with null fields injects phantom values.

**Proposed fix**: Change all three fallbacks to `|| 0`.

### 7. Duplicate deep-merge logic for config restoration

The same deep-merge pattern for `pvsystConfig`, `advancedConfig`, and `inverterConfig` appears **three times**:
1. In the auto-load `useEffect` (lines 377-450)
2. In the `onLoadSimulation` callback (lines 1651-1718)
3. In the auto-save mutation data builder (lines 1256-1300)

**Proposed fix**: Extract a `restoreSimulationConfig(savedJson)` utility function.

### 8. Duplicate system cost calculation

The `calculateFinancials` and `calculateFinancialsFromAnnual` functions in `FinancialAnalysis.ts` both contain identical system cost calculation logic (additional costs, professional fees, contingency). The same logic also appears in `AdvancedSimulationEngine.ts` (lines 424-440).

**Proposed fix**: Extract a `calculateTotalSystemCost(systemCosts, solarCapacity, batteryCapacity)` pure utility.

### 9. The 24-hour `runEnergySimulation` function is dead code

The original `runEnergySimulation` (lines 594-758) runs a single 24-hour cycle. Since the entire system now uses `runAnnualEnergySimulation` exclusively (as per the memory notes), this function is only used indirectly by `LoadSheddingScenarios.ts`.

**Proposed fix**: Verify usage and either mark as `@deprecated` or refactor `LoadSheddingScenarios` to use the annual engine.

### 10. `DEFAULT_SYSTEM_COSTS` uses getter traps

`FinancialAnalysis.ts` lines 405-444 define `DEFAULT_SYSTEM_COSTS` with JavaScript getter properties that call `getDefaultSystemCosts()` on every access. This is a hidden performance concern since each property access triggers a full config rebuild.

**Proposed fix**: Cache the result or use a lazy singleton pattern.

---

## Implementation Plan

### Phase 1: Quick Wins (No architectural changes)

1. **Fix "No Defaults" in SavedSimulations.tsx** -- change `|| 100`, `|| 50`, `|| 25` to `|| 0` (3 lines)
2. **Remove console.log statements** from hot paths in SimulationPanel.tsx (lines 777-793, 344)
3. **Defer comparison simulations** -- wrap `annualEnergyResultsGeneric` and `annualEnergyResultsSolcast` behind a `showComparisonTab` flag so they only compute when the user opens the Data Comparison tab

### Phase 2: Extract shared utilities

4. **Create `restoreSimulationConfig()` utility** -- consolidate the 3 copies of deep-merge restoration logic into `src/utils/simulationConfig.ts`
5. **Create `calculateTotalSystemCost()` utility** -- deduplicate system cost calc from `FinancialAnalysis.ts` and `AdvancedSimulationEngine.ts`
6. **Replace `JSON.stringify` dependency tracking** -- use a ref-based change detection pattern for the auto-save effect

### Phase 3: Component extraction from SimulationPanel

7. **Extract `useSimulationState` hook** -- move the ~30 `useState` declarations and their restoration logic into a dedicated hook
8. **Extract `useSimulationEngine` hook** -- move energy config construction, solar profile generation, and simulation orchestration
9. **Extract `useAutoSave` hook** -- encapsulate auto-save debounce, mutation, and tracking
10. **Extract KPI card section** into `SimulationKPICards.tsx`
11. **Extract chart tab section** into `SimulationChartTabs.tsx`

### Phase 4: Engine optimisation

12. **Eliminate second `useLoadProfileData` call** -- derive per-day chart data from the engine's `hourlyData` array directly
13. **Mark `runEnergySimulation` as deprecated** or refactor `LoadSheddingScenarios` to use annual data
14. **Cache `DEFAULT_SYSTEM_COSTS`** with a lazy singleton

---

## Impact Summary

| Area | Current | After |
|------|---------|-------|
| SimulationPanel.tsx | 2,817 lines | ~800 lines (orchestrator only) |
| Unnecessary simulation runs | 3x 8,760-hour on every change | 1x primary + lazy comparisons |
| Config restore duplication | 3 copies | 1 shared utility |
| System cost duplication | 3 copies | 1 shared utility |
| JSON.stringify per render | 6 calls | 0 (ref-based tracking) |
| Console.log in hot path | 5+ statements | 0 |
| "No Defaults" violations | SavedSimulations.tsx | Fixed |

## Risk Assessment

- **Low risk**: Phases 1-2 are isolated fixes with no UI impact
- **Medium risk**: Phase 3 restructures code but preserves all existing behaviour
- **Low risk**: Phase 4 optimisations are performance-only changes
- All changes maintain backward compatibility with saved simulation data
