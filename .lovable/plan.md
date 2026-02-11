

## Fix Y-Axis to Consistent Scale Across All Days

### Problem
Currently, when navigating between different days (or date ranges), the Y-axis auto-scales to fit just the visible data. This makes it hard to compare values across days since the scale changes each time.

### Solution
Calculate the maximum Y-axis value from the **entire month's dataset** (respecting the current timeframe, hour filter, unit, and visible series), then set a fixed `domain` on the `YAxis` component so it stays consistent as you navigate between days.

### Technical Details

**File: `src/components/projects/generation/PerformanceChart.tsx`**

1. **Compute global Y-axis maximum** -- Add a `useMemo` that iterates over the full filtered readings (before date filtering) aggregated at the current timeframe level. For each data point, compute the visible bar height (sum of stacked visible series + unit conversion) and track the maximum. Also consider the guarantee line value.

2. **Apply fixed domain to YAxis** -- Change line 451 from:
   ```
   <YAxis fontSize={12} label={...} />
   ```
   to:
   ```
   <YAxis fontSize={12} domain={[0, yAxisMax]} allowDataOverflow label={...} />
   ```

3. The `yAxisMax` computation will:
   - Use `filteredReadings` (hour-filtered but NOT date-filtered) so it covers the whole month
   - Aggregate to the current timeframe (30min/hourly/daily)
   - Apply unit conversion (kW divisor)
   - For each data point, calculate the total bar height considering stacking and hidden series
   - Take the max of all data points and the guarantee line value
   - Round up slightly (e.g., multiply by 1.05) for visual padding

This ensures that as you click the navigation arrows to move between days or date ranges, the bars remain visually comparable since the Y-axis scale never changes within the same month/timeframe/filter combination.
