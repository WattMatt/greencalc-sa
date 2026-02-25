
## Fix: Battery Details Not Persisting on Simulation Reload

### Problem Identified

There are two issues with battery detail persistence:

1. **`onLoadSimulation` callback is incomplete**: When loading a saved simulation from the history dropdown, the handler (around line 2019) restores solar, PV config, inverter config, advanced config, and system costs -- but **does NOT restore** the battery dispatch settings:
   - `batteryStrategy` (e.g., "tou-arbitrage")
   - `dispatchConfig` (including `chargeSources`, `dischargeSources`, `allowGridCharging`, windows)
   - `chargeTouPeriod`
   - `dischargeTouPeriod`

   These are only restored during the initial auto-load (lines 386-392), meaning switching between saved simulations loses all battery dispatch configuration.

2. **New fields not yet persisted**: The recently added `chargeSources` and `dischargeSources` arrays within `dispatchConfig` have not been saved to the database yet (they only exist in memory). Once a save occurs, they will persist correctly since they are part of the `dispatchConfig` object which IS included in the save payload.

### Fix

**File: `src/components/projects/SimulationPanel.tsx`**

Add the missing battery dispatch restoration to the `onLoadSimulation` callback (around lines 2038-2039, after the existing battery field restoration):

```typescript
// Load battery dispatch strategy if present
if (config.batteryStrategy) {
  setBatteryStrategy(config.batteryStrategy);
  setDispatchConfig(config.dispatchConfig ?? getDefaultDispatchConfig(config.batteryStrategy));
}
if (config.chargeTouPeriod) setChargeTouPeriod(config.chargeTouPeriod);
if (config.dischargeTouPeriod) setDischargeTouPeriod(config.dischargeTouPeriod);
```

This mirrors the exact same pattern already used in the auto-load block (lines 386-392).

### Summary of Changes

- **1 file edited**: `src/components/projects/SimulationPanel.tsx`
- **Lines added**: ~6 lines in the `onLoadSimulation` callback
- **Risk**: Low -- this is additive code following an established pattern
