
# Fix: Battery Charging Blocked by Empty TOU Period Default

## Problem
The battery never charges despite the user configuring PV to charge during Off-Peak and Standard periods. The chart shows 0 charge, 0 discharge, and flat SoC.

## Root Cause
The `isSourceActiveAtHour` function in `EnergySimulationEngine.ts` treats `undefined` TOU periods the same as "explicitly restricted to nothing":

```text
Line 190: const periods = touPeriods ?? defaultPeriods;
```

When `touPeriods` is `undefined` (not configured) and `defaultPeriods` is `[]` (the "no defaults" change), `periods` becomes `[]`. The loop iterates over zero items and returns `false` -- charging is blocked for every hour.

This breaks because:
1. `DEFAULT_CHARGE_SOURCES` defines `{ id: 'pv', enabled: true }` with NO `chargeTouPeriods`
2. Sources exist, so the legacy fallback (`pvChargeAllowed: true`) is skipped (line 206-208)
3. But each source's `chargeTouPeriods` is `undefined` which maps to `[]` which means "never active"
4. Even after the user clicks checkboxes, any config restore (cache, strategy change) can lose `chargeTouPeriods` and silently revert to blocking

## Fix

**Single change in `isSourceActiveAtHour`** (line 190-191): When `touPeriods` is `undefined` AND `defaultPeriods` is empty, treat it as "no restriction configured" and return `true` (always active). This distinguishes three states:

- `undefined` + empty default = **unrestricted** (no TOU filtering configured -- always active)
- `['off-peak', 'standard']` = **restricted** to those specific periods
- `[]` = **fully blocked** (impossible to reach via UI since at least 1 checkbox is required)

```text
// EnergySimulationEngine.ts, isSourceActiveAtHour function
function isSourceActiveAtHour(
  hour: number,
  touPeriods: ('off-peak' | 'standard' | 'peak')[] | undefined,
  defaultPeriods: ('off-peak' | 'standard' | 'peak')[],
  touPeriodToWindowsFn?: (period: 'off-peak' | 'standard' | 'peak') => TimeWindow[],
): boolean {
  // If no TOU periods configured and no defaults provided, source is unrestricted
  if (touPeriods === undefined && defaultPeriods.length === 0) return true;
  
  const periods = touPeriods ?? defaultPeriods;
  if (!touPeriodToWindowsFn) return true;
  for (const p of periods) {
    const windows = touPeriodToWindowsFn(p);
    if (windows.some(w => isInWindow(hour, w))) return true;
  }
  return false;
}
```

No other files need to change. This respects "no defaults" while correctly handling unconfigured sources.

## Files Changed

| File | Change |
|------|--------|
| `src/components/projects/simulation/EnergySimulationEngine.ts` | Add early return in `isSourceActiveAtHour` when `touPeriods` is undefined and defaults are empty |
