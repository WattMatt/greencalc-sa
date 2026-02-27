
# Replace TOU Dashed Lines with Coloured X-Axis Period Bars

## Approach
Remove all `ReferenceLine` TOU rendering. Instead, render coloured horizontal bars flush against the x-axis that span each TOU period. These bars will sit **between the axis line and the tick labels**, coloured by the TOU period (red=peak, amber=standard, teal=off-peak). Each bar stretches -0.5 to +0.5 of its hour tick (filling the full category band width with no gaps).

## Implementation

### 1. Rewrite `touReferenceAreas.tsx`
- Remove `buildTOUBoundaryLines` and `ShiftedReferenceLine`
- Add a new `buildTOUPeriodBars` utility that returns contiguous period blocks: `{ startHour: number, endHour: number, color: string, period: TOUPeriod }[]`
- Add a `TOUXAxisTick` custom tick component for Recharts XAxis:
  - Receives standard Recharts tick props (`x`, `y`, `payload`, `visibleTicksCount`, plus injected `xAxis` metadata)
  - Draws a coloured `<rect>` at each tick position spanning the full `bandSize` width, positioned just above the label (between axis line and tick text)
  - Renders the normal tick label text below the rect
  - Uses `getPeriod(hourNum)` to determine the colour
  - Height ~6px, with slight rounding

### 2. Update all 7 chart files
- Remove `ReferenceLine` imports and TOU boundary line `.map()` blocks
- Remove imports of `buildTOUBoundaryLines` and `ShiftedReferenceLine`
- On `<XAxis>`, replace the simple `tick` prop with `tick={<TOUXAxisTick getPeriod={getPeriod} showTOU={showTOU} />}`
- Increase bottom margin slightly (e.g. `bottom: 8`) to accommodate the coloured bar between axis and labels

### Files to edit
- `src/components/projects/load-profile/utils/touReferenceAreas.tsx` -- full rewrite
- `src/components/projects/load-profile/charts/LoadChart.tsx`
- `src/components/projects/load-profile/charts/BuildingProfileChart.tsx`
- `src/components/projects/load-profile/charts/SolarChart.tsx`
- `src/components/projects/load-profile/charts/GridFlowChart.tsx`
- `src/components/projects/load-profile/charts/BatteryChart.tsx`
- `src/components/projects/load-profile/charts/StackedMeterChart.tsx`
- `src/components/projects/load-profile/charts/LoadEnvelopeChart.tsx`

### Visual Result
Solid coloured bars (red/amber/teal) running along the x-axis beneath the chart area, each spanning the full width of its period with no gaps. Labels remain visible below.
