

## Fix: Enforce "No Defaults" Policy When No Configuration is Saved

### Problem

When the Simulation tab loads, it auto-loads the last saved simulation and applies **hardcoded non-zero fallback values** for missing fields. This contradicts the "No Defaults" policy where everything should start at zero/empty/unselected unless explicitly configured.

### Hardcoded Fallbacks to Fix

In `SimulationPanel.tsx` (lines 347-358), the auto-load `useEffect` uses these non-zero fallbacks:

| Parameter | Current Fallback | Correct Default |
|-----------|-----------------|-----------------|
| `solar_capacity_kwp` | `\|\| 100` | `\|\| 0` |
| `batteryMinSoC` | `?? 10` | `?? 0` |
| `batteryMaxSoC` | `?? 95` | `?? 0` |
| `battery_capacity_kwh` | `\|\| 50` | `\|\| 0` |
| `battery_power_kw` | `\|\| 25` | `\|\| 0` |

Additionally, `chargeTouPeriod` defaults to `'off-peak'` (line 254) instead of `undefined` or a neutral value.

### Changes

**File: `src/components/projects/SimulationPanel.tsx`**

1. **Line 347**: Change `lastSavedSimulation.solar_capacity_kwp || 100` to `lastSavedSimulation.solar_capacity_kwp || 0`
2. **Line 348**: Change `savedResultsJson?.batteryMinSoC ?? 10` to `savedResultsJson?.batteryMinSoC ?? 0`
3. **Line 349**: Change `savedResultsJson?.batteryMaxSoC ?? 95` to `savedResultsJson?.batteryMaxSoC ?? 0`
4. **Line 355**: Change `lastSavedSimulation.battery_capacity_kwh || 50` to `lastSavedSimulation.battery_capacity_kwh || 0`
5. **Line 356**: Change `lastSavedSimulation.battery_power_kw || 25` to `lastSavedSimulation.battery_power_kw || 0`
6. **Line 254**: Change `'off-peak'` default for `chargeTouPeriod` to `undefined` (requires updating the type to `TOUPeriod | undefined`)

### Impact

- When **no saved simulation exists**, all values remain at zero (from the `useState` initialisers, which are already correct)
- When a **saved simulation exists** with null/missing battery fields, those fields stay at zero rather than injecting phantom 100 kWp solar / 50 kWh battery values
- Existing saved simulations with explicit values are unaffected -- those values are read directly from the database
- Battery will only charge/discharge when the user has explicitly configured capacity, power, SoC limits, and dispatch strategy

