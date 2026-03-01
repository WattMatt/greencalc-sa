

## Reset Battery Capacity After Replacement

### The Problem

Currently, `getBatteryCapacityRemaining(year, degradation)` calculates cumulative degradation from Year 1 through the entire project lifetime. When a battery replacement occurs (e.g., at Year 10), the capacity just keeps declining. It should reset to 100% and begin degrading again from that point.

### The Fix

**One file changed:** `src/components/projects/simulation/AdvancedSimulationEngine.ts`

**1. Update `getBatteryCapacityRemaining` to accept a replacement year parameter**

The function will check if the current year is past the replacement year. If so, it calculates degradation relative to the replacement year (i.e., years since replacement) instead of Year 1.

```text
getBatteryCapacityRemaining(year, config, replacementYear?)
```

Logic:
- If `year <= replacementYear` (or no replacement): degrade normally from Year 1
- If `year > replacementYear`: reset effective age to `year - replacementYear`, apply degradation from that point (so Year 11 with replacement at Year 10 behaves like Year 2 — one year of degradation from 100%)

**2. Pass `replacementYear` into the 20-year loop call**

In the main simulation loop (~line 475), pass the replacement year so the capacity correctly resets:

```text
const replacementYear = systemCosts.replacementYear ?? 10;
const batteryRemaining = getBatteryCapacityRemaining(year, degradation, replacementYear);
```

### Example

With 3%/year degradation and replacement at Year 10:
- Year 1: 100% (no degradation in Year 1)
- Year 5: 88% (4 years of 3%)
- Year 10: 73% (9 years of 3%)
- Year 11: 100% (replaced, reset, no degradation in first year after replacement)
- Year 15: 88% (4 years of 3% since replacement)
- Year 20: 73% (9 years of 3% since replacement)

### Technical Details

The `batteryReplacementPercent` cost (default 30%) already exists in the financial model at the replacement year. This change makes the capacity model consistent with that cost — you pay for a replacement and actually get new capacity back.

Only `AdvancedSimulationEngine.ts` needs modification: the `getBatteryCapacityRemaining` function (lines 188-217) and the call site in the 20-year loop (line 475).

