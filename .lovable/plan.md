

# Chart Styling and Interaction Updates

All changes are in a single file: `src/components/projects/generation/PerformanceChart.tsx`.

## Changes

### 1. Title: "Daily Performance" to "System Performance"
Update line 166 from `Daily Performance` to `System Performance`.

### 2. Solar PV Bar Color
- Fill color: `#CCCC33`
- Stroke/outline: `#999999`
Update the `chartConfig` and the `<Bar>` for `actual` to use these colors directly, adding a `stroke` prop.

### 3. Guarantee Line
- Change from dashed (`strokeDasharray="5 5"`) to solid (remove `strokeDasharray`)
- Change color from `hsl(var(--destructive))` to `#3399CC`

### 4. Add Guarantee to Legend
Replace the `ReferenceLine` approach with a `Line` series for the guarantee. This renders a flat line at the guarantee value across all data points AND automatically appears in the legend. Each data point will get a `guarantee` field set to the computed `guaranteeValue`.

### 5. Legend Click to Toggle Visibility
Add state tracking for hidden series. Use the `onClick` handler on `<Legend>` to toggle series visibility. When a legend item is clicked, its `dataKey` is added/removed from a hidden set. Hidden bars/lines get `opacity: 0` or are conditionally rendered.

## Technical Details

- Add `import { Line }` from recharts
- Add state: `const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())`
- Add guarantee values to chart data: `guarantee: guaranteeValue ?? 0`
- Legend `onClick` handler toggles entries in `hiddenSeries`
- Each `<Bar>` and `<Line>` checks `hiddenSeries.has(dataKey)` to set `hide={true}` or render with 0 opacity
- Update `chartConfig` to include a `guarantee` entry with color `#3399CC`

