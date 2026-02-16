

## Fix Duplicate "1 January" Label in 30-Min View

### Problem

After the previous X-axis update, the single-day (30-min) view now shows the date label twice:
1. Once via the XAxis `label` prop (added in the last edit)
2. Once via the custom `<p>` element rendered below the chart (line 605-607)

Both display "1 January", causing duplication as visible in the screenshot.

### Solution

Remove the XAxis `label` for the single-day case, since the custom block below the chart (lines 605-620) already handles that label along with the inline legend. The XAxis `label` should only apply to the `daily` timeframe.

### Technical Change

**File: `src/components/projects/generation/PerformanceChart.tsx`**

On line 550, change the XAxis `label` prop from:

```
label={timeframe === "daily" ? { value: MONTH_FULL[...], ... } : isSingleDay ? { value: singleDayLabel, ... } : undefined}
```

to:

```
label={timeframe === "daily" ? { value: MONTH_FULL[month - 1], position: "bottom", offset: -5, style: { fontSize: 11 } } : undefined}
```

This removes the `isSingleDay` branch from the XAxis label, leaving only the daily timeframe case. The single-day label continues to be rendered by the existing custom block below the chart.

Also revert the `height` condition to only apply the shorter height for daily (not `isSingleDay`), since the single-day view no longer has an axis label to accommodate:

```
height={timeframe === "daily" ? 50 : 60}
```

