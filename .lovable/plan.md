
# Fix Battery Discharge During Forbidden TOU Periods + Add Battery Tab Navigation

## Bug: Battery Discharges in Peak Despite User Config

### Root Cause

In `dispatchTouArbitrage` (EnergySimulationEngine.ts, line 437-438), when an hour is **neither a discharge hour nor a charge hour**, it falls back to `dispatchSelfConsumption(s, permissions)`. Self-consumption uses `batteryDischargeAllowed` from `getDischargePermissions`, which checks the **source-level** `dischargeTouPeriods` (defaulting to `['peak']`).

So during peak hours:
1. The TOU arbitrage matrix correctly says `isDischargeHour = false` (user unchecked peak)
2. Peak is also not a charge hour, so `isChargeHour = false`
3. Code hits the `else` branch and calls `dispatchSelfConsumption(s, permissions)`
4. `batteryDischargeAllowed` is `true` during peak (source default = `['peak']`)
5. Self-consumption happily discharges the battery -- **bypassing the user's TOU matrix**

### Fix

Line 438: Change the fallback from:
```text
return dispatchSelfConsumption(s, permissions);
```
to:
```text
return dispatchSelfConsumption(s, { ...permissions, batteryDischargeAllowed: false });
```

In TOU arbitrage mode, if the hour is not a designated discharge hour, the battery must not discharge -- period. The user's TOU selection matrix is the law. The same applies to scheduled dispatch (line ~535 area if it has a similar fallback).

## Battery Tab Navigation

The Battery Storage tab has a static header while all other tabs (Building Profile, Load, Grid, Solar) have day-by-day navigation (prev/next, day label, Annual Avg toggle). Add the same navigation pattern.

### Change in SimulationPanel.tsx

Replace the Battery tab's `CardHeader` (lines 2535-2540) with the same navigation header used by the other tabs:
- Prev/Next day buttons (disabled at Day 1 / Day 365)
- Day label showing date and day number (e.g. "15 June (Day 166)")
- Season and day-type badges
- Annual Avg toggle switch

## Files Changed

| File | Change |
|------|--------|
| `src/components/projects/simulation/EnergySimulationEngine.ts` | Fix TOU arbitrage fallback to disable battery discharge during non-discharge hours |
| `src/components/projects/SimulationPanel.tsx` | Add day navigation header to Battery tab |
