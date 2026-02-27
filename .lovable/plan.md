

# Fix: Battery Chart Missing TOU Background in Load Profile View

## Problem

The BatteryChart in the load-profile view (line 366 of `load-profile/index.tsx`) is rendered without the `showTOU` and `isWeekend` props. Since `showTOU` defaults to `false` in BatteryChart, the TOU period backgrounds never appear on the battery chart -- even though they show correctly on the Load, Solar, Grid, and Envelope charts in the same view.

## Root Cause

When the BatteryChart call was added to `load-profile/index.tsx`, only `chartData`, `batteryCapacity`, `batteryPower`, `month`, and `dayOfWeek` were passed. The `showTOU` and `isWeekend` props were omitted, so TOU backgrounds are always hidden.

## Fix

Update the BatteryChart rendering in `src/components/projects/load-profile/index.tsx` (line 366) to include the missing props, matching the pattern used by all other charts in that file:

```tsx
// Before
<BatteryChart chartData={chartData} batteryCapacity={batteryCapacity} batteryPower={batteryPower} month={representativeMonth} dayOfWeek={representativeDayOfWeek} />

// After
<BatteryChart
  chartData={chartData}
  batteryCapacity={batteryCapacity}
  batteryPower={batteryPower}
  showTOU={showTOU}
  isWeekend={isWeekend}
  month={representativeMonth}
  dayOfWeek={representativeDayOfWeek}
/>
```

## Files Changed

| File | Change |
|------|--------|
| `src/components/projects/load-profile/index.tsx` | Add `showTOU={showTOU}` and `isWeekend={isWeekend}` to BatteryChart rendering |

This is a one-line fix -- two missing props.

