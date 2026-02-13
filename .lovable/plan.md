

# Fix: Council Data Not Displaying in Chart

## Root Cause

When council (building load) data is uploaded via the CSV import, the `refetch` callback invalidates query caches to refresh the UI. However, it only invalidates three query keys:

- `generation-record`
- `generation-daily`
- `generation-readings`

The System Performance chart uses a **different** query key: `generation-readings-chart`. This key is never invalidated after the upload, so the chart continues showing stale cached data without the council values.

Similarly, the Performance Summary Table uses `generation-readings-daily`, which is also not invalidated.

## Fix

Add the missing query key invalidations to the `refetch` function in `GenerationTab.tsx`:

```
generation-readings-chart
generation-readings-daily
```

### File: `src/components/projects/generation/GenerationTab.tsx`

Update the `refetch` function (lines 83-87) to also invalidate:
- `generation-readings-chart` (used by PerformanceChart)
- `generation-readings-daily` (used by PerformanceSummaryTable)

This is a two-line addition to ensure all chart and table components re-fetch their data after any upload or reset action.

