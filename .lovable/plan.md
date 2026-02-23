
## Fix TOU Period Background Colour Alignment

### Problem
The TOU (Time-of-Use) colour bands don't fully cover the chart area. Specifically:
- **Hour 23** has zero width because `x1="23:00"` and `x2="23:00"` (same value)
- The bands may not extend to the full edges of the chart area

### Solution
Add a 25th data point (`"24:00"`) to the chart data so the last ReferenceArea can span from `"23:00"` to `"24:00"`. Update the `nextHour` calculation to use `24` instead of clamping to `23`.

### Technical Details

**`LoadEnvelopeChart.tsx`** — two changes:

1. **Chart data**: append a duplicate of the last point with hour `"24:00"` so the x-axis extends to cover the full 24-hour range:
```typescript
const chartData = envelopeData.map((d) => ({
  hour: d.hour,
  base: d.min,
  band: d.max - d.min,
  avg: d.avg,
  min: d.min,
  max: d.max,
}));

// Add endpoint so TOU band covers hour 23-24
const lastPoint = chartData[chartData.length - 1];
if (lastPoint) {
  chartData.push({ ...lastPoint, hour: "24:00" });
}
```

2. **ReferenceArea loop**: remove the `h === 23 ? 23 : h + 1` clamping so hour 23 maps to `"24:00"`:
```typescript
const nextHour = h + 1; // was: h === 23 ? 23 : h + 1
```

This same fix pattern exists in **5 chart files** — all will be updated consistently:
- `LoadEnvelopeChart.tsx`
- `LoadChart.tsx`
- `GridFlowChart.tsx`
- `StackedMeterChart.tsx`
- `SolarChart.tsx`
