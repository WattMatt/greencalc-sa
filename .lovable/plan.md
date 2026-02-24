

## Restructure Battery Pane Layout and Add TOU Period Selector

### What Changes

**1. Reorder the Battery pane layout**

Move the DoD / Power / DC Capacity row **above** the Dispatch Strategy dropdown. The new order becomes:

```text
AC Capacity (kWh)  |  C-Rate
DoD (%)  |  Power (kW)  |  DC Capacity (kWh)
Dispatch Strategy: [Self-Consumption v]
(strategy-specific options below)
```

**2. Replace hour-number inputs with TOU Period selectors**

When **TOU Arbitrage** is selected, instead of typing raw hour numbers (22-6, 7-10), the Charge and Discharge fields become dropdowns that let you select a TOU period:

- **Off-Peak** (22:00 - 06:00)
- **Standard** (06:00 - 07:00, 10:00 - 18:00, 20:00 - 22:00)
- **Peak** (07:00 - 10:00, 18:00 - 20:00)

The charge/discharge windows are then auto-derived from the selected TOU period. This is simpler and aligns with SA tariff structures.

For **Scheduled** mode, the raw hour inputs remain (user-defined windows).

### Technical Details

**File:** `src/components/projects/SimulationPanel.tsx`

1. **Cut** lines 1560-1592 (the DoD/Power/DC grid) and **paste** them before line 1538 (above Dispatch Strategy)
2. **Add state** for `chargeTouPeriod` and `dischargeTouPeriod` (type `TOUPeriod`, defaults: `'off-peak'` and `'peak'`)
3. **Add a helper** to convert a TOU period name into hour windows using the existing `getTOUPeriod` definitions:
   - `off-peak`: `{start: 22, end: 6}`
   - `standard`: `{start: 6, end: 7}` + `{start: 10, end: 18}` + `{start: 20, end: 22}` (multiple windows)
   - `peak`: `{start: 7, end: 10}` + `{start: 18, end: 20}` (multiple windows)
4. **For TOU Arbitrage**: Replace the two pairs of hour inputs with two `Select` dropdowns (Charge from: Off-Peak/Standard/Peak, Discharge from: Off-Peak/Standard/Peak). When the user picks a period, auto-update `dispatchConfig.chargeWindows` and `dischargeWindows` with the correct hour ranges
5. **For Scheduled**: Keep the existing raw hour number inputs unchanged
6. **Update persistence** to save/load `chargeTouPeriod` and `dischargeTouPeriod` in `results_json`

**File:** `src/components/projects/simulation/EnergySimulationEngine.ts`

- Update the `isInWindow` logic to support **multiple windows** per charge/discharge config (e.g., peak has two windows: 07-10 and 18-20). Change `chargeWindows` and `dischargeWindows` from single-item arrays to proper multi-window arrays

No new files or dependencies needed.

