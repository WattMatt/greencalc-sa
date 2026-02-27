

# Convert Remaining `<Input type="number">` to `<NumericInput>`

Replace all raw `<Input type="number">` fields with the `NumericInput` component (from `src/components/ui/numeric-input.tsx`) across the four remaining files. `NumericInput` handles focus/blur commit, min/max clamping, and prevents invalid character entry -- matching the pattern already established elsewhere in the app.

**Note:** Some inputs use managed string state for inline-edit patterns (e.g. `solarCostEditValue`, `solarPercentageInput`, `batteryPercentageInput`). These already implement their own commit-on-blur/keydown logic and will be left as-is since converting them would require refactoring their parent state management.

---

## File 1: `src/components/projects/simulation/FutureEnhancementsConfig.tsx`

**Import change:** Replace `Input` import with `NumericInput` import.

Convert ~20 numeric inputs across the sub-sections:
- **Feed-In Tariff:** escalationRate, minimumExportPrice, maximumExportPrice, gridConnectionFee
- **Portfolio:** benchmarkIrr, targetPayback
- **Carbon:** gridEmissionFactor, carbonTaxRate, transmissionLossPercent, recPricePerMwh
- **Financing/PPA:** ppaRate, ppaEscalationRate, contractTerm (integer), performanceGuarantee
- **Financing/Lease:** monthlyPayment, leaseTerm (integer), residualValue
- **Financing/Loan:** interestRate, loanTerm (integer), downPayment

Each converts from:
```tsx
<Input type="number" value={x} onChange={(e) => set(parseFloat(e.target.value) || 0)} ... />
```
To:
```tsx
<NumericInput value={x} onChange={(v) => set(v)} ... />
```
With `integer={true}` added for integer fields (contractTerm, leaseTerm, loanTerm).

---

## File 2: `src/components/projects/SystemCostsManager.tsx`

**Import change:** Add `NumericInput` import.

Convert the following direct-onChange inputs (~15):
- **Fixed costs:** healthAndSafetyCost, waterPointsCost, cctvCost, mvSwitchGearCost
- **Fees:** professionalFeesPercent, projectManagementPercent, contingencyPercent
- **Replacement:** replacementYear (integer), equipmentCostPercent, moduleSharePercent, inverterSharePercent, solarModuleReplacementPercent, inverterReplacementPercent, batteryReplacementPercent
- **Financial:** mirrFinanceRate, mirrReinvestmentRate, insuranceRatePercent

**Skip** (string-state managed): solarCostEditValue, batteryCostEditValue, solarPercentageInput, batteryPercentageInput -- these have their own blur/keydown commit handlers.

---

## File 3: `src/components/projects/SimulationPanel.tsx`

**Import change:** Add `NumericInput` import.

Convert 4 editable inputs:
- **dailyOutputOverride** -- needs special handling since value can be `null` (uses computed fallback). Will use `NumericInput` with the computed value as fallback.
- **specificYieldOverride** -- same null pattern as above.
- **productionReductionPercent** -- integer, min 0, max 100.
- **batteryAcCapacity** -- integer, min 0, max 5000.

**Skip** (disabled/read-only): batteryChargePower, batteryDischargePower, batteryCapacity -- these are display-only.

---

## File 4: `src/components/projects/TenantManager.tsx`

**Import change:** Add `NumericInput` import.

Convert 1 input:
- **kWh/month override** popover (line 127): Convert to `NumericInput`. Currently uses string state `value`/`setValue` -- will need to change to numeric state or adapt.

**Skip** (string-state form fields): The area_sqm fields in the Add Tenant and Edit Tenant forms use string state (`newTenant.area_sqm`, `editTenant?.area_sqm`) that feeds into form validation and `parseFloat()` on submit. These are form fields where empty string is a valid intermediate state, so they remain as `<Input>`.

---

## Technical Details

- All conversions follow the same pattern: remove `type="number"`, change `value` from string to number, change `onChange` from event handler to direct value callback, add `integer={true}` where `parseInt` was used.
- `min`, `max`, `step`, `className`, and other passthrough props remain unchanged.
- No new dependencies required.

