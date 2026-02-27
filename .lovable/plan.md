
# Fix Solar Chart to Show Full PV Generation

## Problem
When the simulation dispatches solar energy to the battery, the PV Profile chart only displays `solarUsed` (solar direct to load) instead of the full `pvGeneration`. This makes it look like less solar was generated, even though the energy was produced and dispatched to the battery.

## Root Cause
Line 197 of `SolarChart.tsx`:
```
<Bar dataKey={hasSolarUsedData ? "solarUsed" : "pvGeneration"} ... />
```
When simulation data is present, `solarUsed` exists and the bar switches to it, hiding battery-bound generation.

## Fix
**File**: `src/components/projects/load-profile/charts/SolarChart.tsx`

1. Always use `pvGeneration` as the bar dataKey -- this is the total AC output regardless of dispatch destination.
2. Update the header stats to show `totalPv` as the AC value (not `effectiveGeneration` which uses `solarUsed`).
3. Keep the breakdown badges (To Load, To Battery, Exported) as they are -- these correctly show where the energy went without double-counting.

The badges already handle the breakdown:
- "To Load" = `solarUsed`
- "To Battery" = `batteryCharge`  
- "Exported" = `gridExport`

So the bar shows total generation, and the badges explain the dispatch. No double-counting.
