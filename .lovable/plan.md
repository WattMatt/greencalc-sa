

# Keep Council Demand Out of System Summary Tables

## Current State

The four System Summary tabs (Production, Down Time, Revenue, Performance) already do **not** display council demand / building load data. They only show solar production sources derived from `actual_kwh` per source. No code changes are needed for the tables.

However, the `building_load_kwh` field is still being fetched in the readings query unnecessarily. This plan cleans that up to make it explicit.

## Changes

### `src/components/projects/generation/PerformanceSummaryTable.tsx`

1. **Remove `building_load_kwh` from the readings query** -- the summary tables don't use it, so stop selecting it. Change the `.select()` to only fetch `timestamp, actual_kwh, source`.

2. **Remove `building_load_kwh` from the `MonthData` interface** used by this component (it's not referenced anywhere in the table rendering).

This is a small cleanup to make it absolutely clear that council demand data is excluded from these tables.

## What This Does NOT Change

- The **PerformanceChart** component (the graph above the tables) is a separate file and is not modified here. Restoring council demand bars in the chart would be a separate task if you want that later.

