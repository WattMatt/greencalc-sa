

## Recalculate Lost Production Based on Overridden 30-Min Intervals

### Problem

When you manually adjust the 30-Min Intervals using the up/down arrows, only the interval count updates. The associated "Lost Production (kWh)" for that source, the total "Down Time" column, and footer totals all remain unchanged because the override values are not fed back into the energy calculations.

### Root Cause

The main data computation (`useMemo` at line 214) calculates `downtimeEnergy` and `downtimeSlots` from raw readings but does not consider `slotOverrides`. The override map is only used for display in the `DowntimeSlotCell` component and the footer slot count -- it never feeds back into the energy figures.

### Solution

After the base downtime calculation completes, apply a correction pass that adjusts energy values when an override exists:

1. Add `slotOverrides` as a dependency to the main `useMemo` block
2. After the existing downtime loop, iterate over all day/source combinations and check for overrides
3. When an override exists, recalculate the source's lost production as: `overriddenSlots * perSlotEnergy` (replacing the original calculated energy)
4. Update both the per-source `sourceDayMap` entry and the aggregate `dayMap` entry so that the total "Down Time" column and all footer totals reflect the override

### Formula

```
perSlotEnergy = (sourceMonthlyGuarantee / totalDays) / sunHourSlots
overriddenLostProduction = overriddenSlots * perSlotEnergy
```

### What Updates Automatically

- Per-source "Lost Production (kWh)" column for overridden rows
- Total "Down Time (06:00-18:00)" column (leftmost lost production)
- Footer totals for both per-source lost production and total lost production
- Production tab "Down Time kWh" and "Theoretical Generation" columns (since they derive from the same `dailyRows`)
- Revenue tab "Down Time (R)" column (since it multiplies `downtimeEnergy * rate`)

### Technical Details

**File: `src/components/projects/generation/PerformanceSummaryTable.tsx`**

- In the main `useMemo` (line 214), after the downtime calculation loop (around line 383), add an override correction pass:
  - For each day and source, check `slotOverrides.get(\`${d}-${src}\`)`
  - If an override exists, compute `newEnergy = override * perSlotEnergy`
  - Compute `delta = newEnergy - sd.downtimeEnergy`
  - Apply delta to both `sd.downtimeEnergy`, `sd.downtimeSlots`, and the corresponding `dayMap` entry
- Add `slotOverrides` to the `useMemo` dependency array (line 410)
- The `perSlotEnergy` calculation already exists inside the loop; it needs to be accessible during the correction pass (store it per-source in a small map)

No changes needed to `DowntimeSlotCell.tsx` or the database -- this is purely a recalculation fix in the table component.

