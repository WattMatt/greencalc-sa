
# Add "All Hours" / "Sun Hours" Toggle to Performance Chart

## Overview
Add a toggle switch to the left of the timeframe dropdown that filters chart data between "All Hours" (full 24-hour day) and "Sun Hours" (06:00 to 17:30 inclusive).

## Changes

**File: `src/components/projects/generation/PerformanceChart.tsx`**

### 1. Add Toggle State
Add a new state variable: `hoursFilter` with values `"all"` or `"sun"`, defaulting to `"all"`.

### 2. Add Toggle UI
Place a toggle switch (using the existing `Toggle` or a simple button group) to the left of the timeframe `Select` in the `CardHeader`. Two small buttons labeled **"All Hours"** and **"Sun Hours"** styled as a segmented control, or use a `ToggleGroup` from Radix.

### 3. Filter Logic
When `hoursFilter === "sun"`, filter the raw `readings` array to only include timestamps where the time is between 06:00 and 17:30 (inclusive). The filtering happens before any aggregation (30min, hourly, daily).

The filter function:
```text
function isSunHour(timestamp: string): boolean {
  const d = new Date(timestamp);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  return timeInMinutes >= 360 && timeInMinutes <= 1050;
  // 06:00 = 360 min, 17:30 = 1050 min
}
```

This filter applies to all timeframe views (30min, hourly, daily) except "monthly" which uses the pre-aggregated `monthData` values directly (no interval data to filter).

### 4. Guarantee Line Adjustment
When "Sun Hours" is active, the guarantee line value should scale proportionally. Sun hours span 11.5 hours out of 24, so the daily guarantee in sun-hours mode would be `dailyGuarantee * (11.5 / 24)` -- or alternatively keep the guarantee unchanged since it represents solar generation which inherently occurs during sun hours. The guarantee value will remain unchanged since guaranteed generation already represents solar output.

## Technical Details

- Import `ToggleGroup` and `ToggleGroupItem` from `@/components/ui/toggle-group`
- Add state: `const [hoursFilter, setHoursFilter] = useState<"all" | "sun">("all")`
- Apply filter to readings before aggregation: `const filteredReadings = hoursFilter === "sun" ? readings.filter(r => isSunHour(r.timestamp)) : readings`
- Use `filteredReadings` instead of `readings` in all the aggregation logic (30min, hourly, daily branches)
- For "monthly" view, no filtering is possible (data is pre-aggregated), so the toggle has no effect there
- The toggle sits in the `CardHeader` flex row, between the title and the dropdown
