
# Fix TOU Coloured Bars -- Use Recharts Customized Component

## Root Cause
Recharts does NOT pass `xAxis` metadata (including `bandSize`) to custom tick components. The `filterProps` function strips non-DOM props, so `props.xAxis?.bandSize` is always `undefined`, resulting in `bandSize = 0` and rects with width=0 (invisible). The bars were never actually rendering.

## Solution
Use Recharts' `<Customized>` component instead of rendering bars inside the tick. `<Customized>` receives the full chart `props` and `state`, including `xAxisMap` which contains `bandSize` and all tick coordinate data. This gives us everything needed to draw continuous TOU period bars.

## Implementation

### 1. Rewrite `touReferenceAreas.tsx`
- Keep `TOUXAxisTick` but simplify it to ONLY render the text label (no rect). When `showTOU` is true, shift the label down slightly to leave room for the bars above.
- Add a new `TOUBarsLayer` component designed for use with `<Customized component={<TOUBarsLayer ... />} />`:
  - Receives full chart state from Recharts (including `xAxisMap`)
  - Extracts the xAxis from `xAxisMap` to get `bandSize` and all tick coordinates
  - For each tick/data point, renders a coloured rect spanning the full `bandSize` width
  - Positioned just below the axis line (between axis and labels)
  - Uses `getPeriod(hourNum)` to determine the colour per hour

### 2. Update all 7 chart files
- Add `import { Customized } from "recharts"` (already available)
- Add `<Customized component={<TOUBarsLayer getPeriod={getPeriod} showTOU={showTOU} />} />` inside each `<ComposedChart>`
- The `TOUXAxisTick` continues to handle label rendering and vertical spacing

### Files to edit
- `src/components/projects/load-profile/utils/touReferenceAreas.tsx`
- `src/components/projects/load-profile/charts/LoadChart.tsx`
- `src/components/projects/load-profile/charts/BuildingProfileChart.tsx`
- `src/components/projects/load-profile/charts/SolarChart.tsx`
- `src/components/projects/load-profile/charts/GridFlowChart.tsx`
- `src/components/projects/load-profile/charts/BatteryChart.tsx`
- `src/components/projects/load-profile/charts/StackedMeterChart.tsx`
- `src/components/projects/load-profile/charts/LoadEnvelopeChart.tsx`

### Technical Detail

```text
TOUBarsLayer component (inside <Customized>):
  - Extract xAxis from props.xAxisMap (first entry)
  - Get bandSize and scale from xAxis
  - For each data point's hour value, compute x = scale(hour)
  - Render <rect x={x - bandSize/2} y={axisY} width={bandSize} height={5} fill={touColor} />
  - axisY = chart offset.top + offset.height (bottom of plot area)
```

This approach guarantees access to the axis coordinate system and band width, producing continuous coloured bars along the x-axis.
