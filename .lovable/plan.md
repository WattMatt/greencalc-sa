

# Fix: Battery Not Charging During Daytime Despite User Configuration

## Problem

The battery only charges during off-peak weekend hours, even though the user has configured PV charging to be allowed across all TOU periods.

## Root Cause

In `EnergySimulationEngine.ts`, the `getChargePermissions` function (line 216) uses a **hardcoded default of `['off-peak']`** for ALL charge sources when `chargeTouPeriods` is not explicitly set:

```text
const active = isSourceActiveAtHour(hour, src.chargeTouPeriods, ['off-peak'], touPeriodToWindowsFn);
```

The `DEFAULT_CHARGE_SOURCES` (line 33-35) do NOT set `chargeTouPeriods`:
```text
{ id: 'pv', enabled: true }       // No chargeTouPeriods -> defaults to ['off-peak']
{ id: 'grid', enabled: true }     // No chargeTouPeriods -> defaults to ['off-peak']
```

This means even if the user has "PV" enabled as a charge source, the engine only allows PV charging during off-peak hours. Since off-peak on weekdays is typically late night (no solar), the battery never charges from PV on weekdays. On weekends, off-peak spans more hours, which explains the "only off-peak weekend" pattern.

The default `['off-peak']` makes sense for grid charging (cheap rates), but is wrong for PV -- solar energy is free and should charge the battery whenever available by default.

## Fix (single file: `EnergySimulationEngine.ts`)

### 1. Use source-specific defaults in `getChargePermissions`

Change the default periods to be source-aware:
- **PV**: Default to `['off-peak', 'standard', 'peak']` (charge from solar whenever available)
- **Grid**: Keep default at `['off-peak']` (charge from grid during cheap rates)

```text
// Line 216: Change from a single default to source-specific defaults
for (const src of sources) {
  if (!src.enabled) continue;
  const defaultPeriods: ('off-peak' | 'standard' | 'peak')[] =
    src.id === 'pv' ? ['off-peak', 'standard', 'peak'] : ['off-peak'];
  const active = isSourceActiveAtHour(hour, src.chargeTouPeriods, defaultPeriods, touPeriodToWindowsFn);
  ...
}
```

### 2. Update `DEFAULT_CHARGE_SOURCES` with explicit `chargeTouPeriods`

Set `chargeTouPeriods` explicitly on defaults so the UI and engine are always in sync:

```text
export const DEFAULT_CHARGE_SOURCES: ChargeSource[] = [
  { id: 'pv', enabled: true, chargeTouPeriods: ['off-peak', 'standard', 'peak'] },
  { id: 'grid', enabled: true, chargeTouPeriods: ['off-peak'] },
  { id: 'generator', enabled: false },
];
```

### 3. Update the UI default fallback in `AdvancedSimulationConfig.tsx`

The `ChargeSourcesList` component (line 1012) also defaults to `['off-peak']` when rendering:

```text
const periods = source.chargeTouPeriods ?? (source.chargeTouPeriod ? [source.chargeTouPeriod] : ['off-peak']);
```

Change this to use a source-specific default:

```text
const defaultPeriods = source.id === 'pv' ? ['off-peak', 'standard', 'peak'] : ['off-peak'];
const periods = source.chargeTouPeriods ?? (source.chargeTouPeriod ? [source.chargeTouPeriod] : defaultPeriods);
```

## Expected Result

- PV will charge the battery during **all** TOU periods by default (peak, standard, off-peak)
- Grid charging remains restricted to off-peak by default (cost-efficient)
- Users who have already explicitly configured their TOU periods are unaffected (their saved `chargeTouPeriods` overrides defaults)
- Battery charges from solar excess throughout the day as expected

## Files Changed

| File | Change |
|------|--------|
| `src/components/projects/simulation/EnergySimulationEngine.ts` | Source-specific default TOU periods in `getChargePermissions`; explicit `chargeTouPeriods` on `DEFAULT_CHARGE_SOURCES` |
| `src/components/projects/simulation/AdvancedSimulationConfig.tsx` | Source-specific default fallback in `ChargeSourcesList` UI |

