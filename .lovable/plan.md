

## Fix: Use Flat 15% System Loss & Add Toggle for Extra Losses

### Problem
`calculateSystemEfficiency` multiplies together module type efficiency, array type modifier, inverter efficiency, individual system losses, **tilt factor**, and **azimuth factor** — resulting in a complex compounded efficiency far from the simple 85% (n_system = 0.85) model. The user wants a clean 15% system loss by default, with an **opt-in toggle** to include tilt, azimuth, and other extra losses.

### Changes

**File: `src/components/projects/PVSystemConfig.tsx`**

1. **Add `useDetailedLosses: boolean` to `PVSystemConfigData` interface** (default `false`)
2. **Update `getDefaultPVConfig()`** to include `useDetailedLosses: false`
3. **Simplify `calculateSystemEfficiency()`**:
   - When `config.useDetailedLosses === false`: return flat `0.85` (i.e. 1 - 0.15)
   - When `config.useDetailedLosses === true`: use the current full calculation (module type × array modifier × inverter eff × loss multiplier × tilt factor × azimuth factor)
4. **Add a Switch/Toggle in the PV System Configuration UI** (near the top of the card content):
   - Label: "Include detailed losses (tilt, azimuth, module type, etc.)"
   - When OFF: show "System Efficiency: 85%" badge, collapse/hide the detailed loss sliders
   - When ON: show full efficiency calculation and all configuration controls

This toggle will automatically propagate to all downstream calculations (daily output, specific yield, annual production) since they all call `calculateSystemEfficiency()`.

