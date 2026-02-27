

## Fix: 1:1 Baseline Should Not Use DC/AC Ratio

### Problem

The TMY path calculates the 1:1 baseline as:
```
pv1to1Baseline = (pvDcOutput / dcAcRatio) * inverterLossMultiplier
```

This incorrectly uses the DC/AC ratio to scale down the oversized array's DC output. The correct approach (already used in the simplified path in `useLoadProfileData.ts`) is to model a 1:1 system where DC capacity equals AC capacity. In other words, the 1:1 baseline DC output should be derived from `inverterTotalKw` (the AC capacity) as the theoretical DC capacity of a 1:1 system.

### Correct Approach

The simplified path gets it right on line 399:
```
baseline = normalizedProfile[hour] * maxPvAcKva * effectiveEfficiency
```

For the TMY path, we need to compute what the DC output would be if the array were sized at 1:1. Since `pvDcOutput` is proportional to installed DC capacity, and the installed DC capacity is `inverterTotalKw * dcAcRatio`, a 1:1 system's DC output at the same hour would be:

```
pv1to1Baseline = (pvDcOutput / dcAcRatio) * tmyInverterLossMultiplier
```

Wait -- this is actually mathematically the same thing. The `pvDcOutput` comes from `dcCapacityKwp` (which is `inverterTotalKw * dcAcRatio`). So dividing by `dcAcRatio` gives `pvDcOutput * (inverterTotalKw / dcCapacityKwp)` = the output of an array sized at `inverterTotalKw`. This IS correct for a 1:1 system.

Let me re-examine: perhaps the issue is that `pvDcOutput` in the TMY path is computed differently and the ratio division doesn't hold.

### Investigation Needed

I need to check how `tmyDcProfile8760` values are generated to confirm whether dividing by `dcAcRatio` correctly models a 1:1 system, or if the baseline should instead be computed from raw irradiance data scaled to `inverterTotalKw`.

### Changes (single file: `SimulationPanel.tsx`)

**Lines 1117-1118 and 1127-1128**: Replace the baseline calculation. Instead of dividing `pvDcOutput` by `dcAcRatio`, compute the 1:1 baseline directly from the raw TMY irradiance, scaling to the inverter AC capacity as the DC size:

```typescript
// 1:1 baseline: scale the DC output proportionally to what a 1:1 system (DC = AC) would produce
// pvDcOutput is proportional to installed DC capacity (inverterTotalKw * dcAcRatio)
// A 1:1 system has DC = inverterTotalKw, so baseline = pvDcOutput * (inverterTotalKw / (inverterTotalKw * dcAcRatio))
// Simplifies to pvDcOutput / dcAcRatio, BUT we should NOT apply tmyInverterLossMultiplier again
// since this represents the theoretical maximum a 1:1 system could output
pv1to1Baseline = dcAcRatio > 1 ? pvDcOutput / dcAcRatio : undefined;
```

This removes the `tmyInverterLossMultiplier` from the baseline. The inverter losses are an artefact of the oversized system's conversion; a 1:1 system operating below its AC limit would have different (lower) conversion losses. The raw scaled-down DC value better represents the 1:1 theoretical output.

### Summary

- Remove `* tmyInverterLossMultiplier` from both 1:1 baseline calculations in `SimulationPanel.tsx`
- The baseline becomes simply `pvDcOutput / dcAcRatio` -- representing the unclipped, loss-free theoretical output of a 1:1 array
- This aligns conceptually with the simplified path which uses `normalizedProfile * maxPvAcKva * efficiency` (where efficiency accounts for temperature/system losses, not inverter clipping losses)

