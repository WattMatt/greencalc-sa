

## Add "Exclude Load Profile" Checkbox for Solar-Only Financial Analysis

### What It Does
Adds a checkbox in the **Financial** pane that, when checked, recalculates all financial outputs based purely on total solar generation rather than load-vs-solar netting. This is useful for PPA/wheeling scenarios where revenue = all solar produced × tariff rate, regardless of on-site consumption.

### How It Works

**When unchecked (default — current behavior):**
- Financial savings = grid-only cost minus solar-offset cost (load profile drives the baseline).

**When checked (solar-only mode):**
- Annual income = `totalAnnualSolar × tariffRate` (all generation is monetized).
- No grid-only baseline comparison needed — revenue is purely generation-based.
- Demand savings, grid import costs, and self-consumption metrics are excluded from financial outputs.
- Energy KPIs (Annual Production, etc.) remain unchanged — only financial layer changes.

### Files to Change

1. **`src/components/projects/simulation/FinancialConfigPane.tsx`**
   - Add a `Checkbox` + label "Exclude Load Profile" below the tariff rate selector card.
   - Accept new props: `excludeLoadProfile: boolean`, `onExcludeLoadProfileChange: (v: boolean) => void`.

2. **`src/components/projects/SimulationPanel.tsx`**
   - Add `excludeLoadProfile` state (`useState(false)`).
   - Pass it down to `FinancialConfigPane` and to `useSimulationEngine`.

3. **`src/components/projects/simulation/useSimulationEngine.ts`**
   - Accept `excludeLoadProfile` in config.
   - When `true`, pass modified annual results to `calculateFinancialsFromAnnual` where:
     - `totalAnnualGridImport = 0` (no grid cost)
     - `totalAnnualGridExport = totalAnnualSolar` (all solar treated as revenue/savings)
     - `totalAnnualLoad = 0` and `peakLoad = 0` (no demand baseline)
   - Same override applied to the `dailyAdapter` fed into `runAdvancedSimulation` for the 20-year cashflow.

4. **`src/components/projects/simulation/FinancialAnalysis.ts`**
   - No structural changes needed — the overridden annual results will naturally produce solar-only financials through existing formulas (grid cost becomes 0, savings = export revenue from all solar).

### UI Placement
The checkbox sits inside the Financial pane, between the tariff rate selector card and the "Financial Return Outputs" card, as a compact inline element:
```
[✓] Exclude load profile from financial analysis
```

