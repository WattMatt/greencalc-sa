

## Update X-Axis: Day Numbers as Ticks, Month Name as Axis Title

### What Changes

In the daily view, the X-axis currently shows tick labels like "1-Jan", "2-Jan", etc. This will be updated so that:

- **X-axis ticks** show only the day number: 1, 2, 3, ... 31
- **X-axis title** shows the month name: "January"

This matches the single-day view pattern where ticks show times and the axis title shows the date.

### Technical Details

**File: `src/components/projects/generation/PerformanceChart.tsx`**

1. **Line 292** -- Change daily tick labels from `${day}-${monthShort}` to just `${day}` (the day number only)

2. **Line 550** -- Add an XAxis `label` prop for daily view showing the full month name:
   - When `timeframe === "daily"`, add `label={{ value: MONTH_FULL[month - 1], position: "bottom", style: { fontSize: 11 } }}`
   - Adjust height to accommodate the label

3. **Line 62** -- Also update `formatTimeLabel` for the daily case to return just the day number (for consistency, though daily data is built inline at line 292)
