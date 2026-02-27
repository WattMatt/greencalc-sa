

# Fix TOU Background Bands — Merge Consecutive Same-Period Hours

## Problem
Each chart renders **24 separate semi-transparent `ReferenceArea` rectangles** (one per hour). Where two adjacent rectangles share the same TOU period and colour, SVG anti-aliasing at their shared boundary creates a visible seam — a thin line of blended colour. With 24 boundaries, these seams produce the appearance of many more than 3 colours.

## Solution
Group consecutive hours that share the same TOU period into **single contiguous `ReferenceArea` blocks**. For example, if hours 0-5 are all "off-peak", render one rectangle from `00:00` to `06:00` instead of six overlapping ones. This eliminates all internal boundaries and seams.

## Implementation

### 1. New shared utility file
**`src/components/projects/load-profile/utils/touReferenceAreas.tsx`**

A helper function that:
- Accepts a `getPeriod(hour) => TOUPeriod` callback
- Iterates hours 0-23, grouping consecutive hours with the same period into blocks
- Returns an array of `<ReferenceArea>` elements (typically 3-8 instead of 24)

```text
Example: If hours resolve to:
  0-5: off-peak, 6-8: peak, 9-11: standard, 12-13: off-peak, 14-16: standard, 17-18: peak, 19-21: standard, 22-23: off-peak

Result: 8 ReferenceArea blocks instead of 24
```

### 2. Update all 6 chart files

Replace the existing `Array.from({ length: 24 }, ...)` loop in each file with a call to the new utility, passing the existing `getPeriod` function.

Files to update:
- `BuildingProfileChart.tsx`
- `LoadChart.tsx`
- `SolarChart.tsx`
- `GridFlowChart.tsx`
- `BatteryChart.tsx`
- `StackedMeterChart.tsx`

Each change replaces the ~10-line mapping block with a single function call. No changes to colours, opacity, or any other chart properties.

