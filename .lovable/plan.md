
# Fix TOU Period Background Colours — Solid Blocks, No Gradient Effect

## Problem
The TOU period background colours in the daily chart view appear as faint, gradient-like washes that blend into each other. The user wants three clearly distinct, solid colour blocks for Peak, Standard, and Off-Peak.

## Root Cause
The `fillOpacity` on `ReferenceArea` components is set extremely low (0.08 in some charts, 0.12 in others), making the colours almost invisible and creating the illusion of gradients where periods transition.

## Solution
Increase the `fillOpacity` to a consistent, visible value (e.g., `0.18`) across all six chart files so the TOU period colours are clearly distinguishable as solid blocks.

## Files to Update

1. **`src/components/projects/load-profile/charts/BuildingProfileChart.tsx`** — Change `fillOpacity={0.08}` to `fillOpacity={0.18}`
2. **`src/components/projects/load-profile/charts/LoadChart.tsx`** — Change `fillOpacity={0.12}` to `fillOpacity={0.18}`
3. **`src/components/projects/load-profile/charts/GridFlowChart.tsx`** — Change `fillOpacity={0.08}` to `fillOpacity={0.18}`
4. **`src/components/projects/load-profile/charts/SolarChart.tsx`** — Check and standardise `fillOpacity` to `0.18`
5. **`src/components/projects/load-profile/charts/BatteryChart.tsx`** — Change `fillOpacity={0.12}` to `fillOpacity={0.18}`
6. **`src/components/projects/load-profile/charts/StackedMeterChart.tsx`** — Change `fillOpacity={0.12}` to `fillOpacity={0.18}`

Each change is a single-property update on the existing `ReferenceArea` component within the TOU rendering loop. No structural changes required.
