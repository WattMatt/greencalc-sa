
## Change Final Down Time Column from Intervals to Lost Production

### What Changes

The "Down Time (06:00-18:00)" summary column currently displays `downtimeSlots` (count of 30-min intervals). It should instead display `downtimeEnergy` (summed lost production in kWh).

### File: `src/components/projects/generation/PerformanceSummaryTable.tsx`

Three lines need updating:

1. **Header (line 465)**: Change `"30-Min Intervals"` to `"Lost Production (kWh)"`
2. **Row cells (line 479)**: Change `{row.downtimeSlots}` to `{formatNum(row.downtimeEnergy)}`
3. **Footer total (line 496)**: Change `{totals.downtimeSlots}` to `{formatNum(totals.downtimeEnergy)}`

Both `row.downtimeEnergy` and `totals.downtimeEnergy` already exist and contain the correct summed lost production values across all sources. The `formatNum` helper is already used elsewhere in the table for kWh formatting.
