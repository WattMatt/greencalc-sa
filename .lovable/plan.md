

# Fix: 1% Threshold for Downtime Slots

## Change

In `src/components/projects/generation/PerformanceSummaryTable.tsx`, update the downtime check in the sun-hour slot loop (around lines 187-194) to treat any slot producing less than 1% of the per-slot expected energy as downtime.

## Current Code (approx lines 187-194)

```typescript
if (val === undefined || val === null || val === 0) {
  entry.downtimeSlots += 1;
  entry.downtimeEnergy += perSlotEnergy;
}
```

## New Code

```typescript
const actualVal = (val !== undefined && val !== null) ? val : 0;
const threshold = perSlotEnergy * 0.01; // 1% of expected slot energy
if (actualVal < threshold) {
  entry.downtimeSlots += 1;
  entry.downtimeEnergy += (perSlotEnergy - actualVal);
}
```

## What This Does

- Slots producing less than 1% of the per-slot guarantee are classified as downtime.
- The downtime energy contribution is the difference between expected and actual (so near-zero production days like Day 11 with 0.27 kWh will have Theoretical Generation matching the Yield Guarantee).
- Slots producing 1% or more of the expected value are treated as operational (no downtime).

Single file, ~4 lines changed. No database changes.

