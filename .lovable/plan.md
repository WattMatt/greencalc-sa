

# Fix: Custom kW Input Snapping to Inverter Multiples

## Root Cause

The custom kW input IS set to `step="5"`, but a `useEffect` in **SimulationPanel.tsx** (line 443-449) overrides the solar capacity every time the inverter config changes:

```text
useEffect:
  acCapacity = inverterSize * inverterCount   // e.g. 125 * 6 = 750
  if (acCapacity !== solarCapacity)
    setSolarCapacity(acCapacity)              // OVERRIDES user's 630 back to 750
```

**What happens when you click the arrow:**
1. User is at 625 kW, clicks up arrow -> input fires `onChange(630)`
2. Handler sets `solarCapacity = 630` and `inverterCount = ceil(630/125) = 6`
3. The `useEffect` fires: `125 * 6 = 750`, sees `750 !== 630`, resets capacity to **750**

So it appears to jump by 125 kW, but it's actually the useEffect snapping to the nearest inverter multiple.

## Fix

**Remove** or **disable** the useEffect sync on lines 443-449 of `SimulationPanel.tsx`. Under the new design, the system size (AC) is the primary input and should NOT be overridden by `inverterSize * inverterCount`. The inverter count is derived from the system size, not the other way around.

### File: `src/components/projects/SimulationPanel.tsx`
- **Delete lines 443-449** (the `useEffect` that syncs `solarCapacity` from inverter config)
- The `InverterSliderPanel` already keeps `inverterCount` in sync as a derived value, so this useEffect is now redundant and harmful

No other files need changes. The `step="5"` on the input is already correct and will work once this override is removed.
