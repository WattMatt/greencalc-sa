

## Fix: Insurance Cost Display Missing x12 Multiplier

**Problem**: The insurance rate slider's cost display in the Costs tab shows a monthly insurance value but labels it as annual (`/yr`). The simulation engine correctly multiplies by 12 to annualise the value, but the Costs tab display does not.

**Evidence**: In `AdvancedSimulationEngine.ts` line 447:
```
const insuranceBase = initialCost * (insuranceRatePercent / 100) * 12;
```
The comment on line 444 confirms: "Insurance Rate produces a monthly amount - multiply by 12 for annual."

**Fix**: One-line change in `SystemCostsManager.tsx` line 1260 -- add `* 12` to the calculation.

**Before**:
```
R {((totalCapitalCost + totalMaintenancePerYear) * (costs.insuranceRatePercent / 100)).toLocaleString(...)}
```

**After**:
```
R {((totalCapitalCost + totalMaintenancePerYear) * (costs.insuranceRatePercent / 100) * 12).toLocaleString(...)}
```

Note: The simulation engine applies insurance only to `initialCost` (capital cost), but the Costs tab display also includes maintenance. This matches the existing formula that was added previously. Only the missing `* 12` multiplier is being corrected.
