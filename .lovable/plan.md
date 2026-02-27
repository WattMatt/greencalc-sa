

# Replace TOU Background Bands with Vertical Boundary Lines

## Problem
The `ReferenceArea` approach for TOU backgrounds has persistent rendering issues (SVG anti-aliasing, Recharts prop compatibility with multiple Y axes). The coloured backgrounds blend and fail across different chart configurations.

## Solution
Replace all TOU background shading with **vertical dashed lines** at each TOU period transition boundary. Each line uses the colour of the **incoming** period (the period that starts at that hour).

For example, if off-peak runs 00:00-06:00 and peak starts at 06:00, a red dashed vertical line appears at 06:00.

## Implementation

### 1. Rewrite `touReferenceAreas.tsx` utility

Replace `buildTOUBlocks` with `buildTOUBoundaryLines` that:
- Iterates hours 0-23, detecting where the period changes
- Returns an array of `{ hour: string, color: string, period: TOUPeriod }` objects for each boundary
- Also includes hour 0 (the very first period start)

### 2. Update all 7 chart files

Replace `ReferenceArea` rendering with `ReferenceLine` rendering at each boundary:
- **Import**: Swap `ReferenceArea` for `ReferenceLine` where not already imported
- **Rendering**: Replace the `.map()` block to render `<ReferenceLine x={line.hour} stroke={line.color} strokeDasharray="4 3" strokeWidth={1.5} />` for each boundary
- **No more `{ hour: "24:00" }` padding** needed since we are not drawing area blocks

Files to update:
- `src/components/projects/load-profile/utils/touReferenceAreas.tsx`
- `src/components/projects/load-profile/charts/BuildingProfileChart.tsx`
- `src/components/projects/load-profile/charts/LoadChart.tsx`
- `src/components/projects/load-profile/charts/SolarChart.tsx`
- `src/components/projects/load-profile/charts/GridFlowChart.tsx`
- `src/components/projects/load-profile/charts/BatteryChart.tsx` (needs `yAxisId="power"` on ReferenceLine)
- `src/components/projects/load-profile/charts/StackedMeterChart.tsx`
- `src/components/projects/load-profile/charts/LoadEnvelopeChart.tsx`

### Visual Result
Clean vertical dashed lines in red, amber, or teal at each period transition -- no background fills, no anti-aliasing issues, no multi-axis compatibility problems.

