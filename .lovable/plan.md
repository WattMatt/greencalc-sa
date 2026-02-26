

# Replace TOU Toggle with High/Low Demand Season Toggle

## What Changes

The current "TOU" on/off toggle on each simulation chart tab will be replaced with a "High Demand" / "Low Demand" season toggle. TOU background colours will **always** be visible on the charts -- no option to hide them.

## Changes Required

### 1. Replace `showTOU` state with `showHighSeason` state in `SimulationPanel.tsx`

- Remove the `showTOU` boolean state and its localStorage persistence
- Add a new `showHighSeason` boolean state (default `false` = Low Demand, `true` = High Demand), persisted to localStorage
- Replace every `showTOU={showTOU}` prop with `showTOU={true}` (always on)
- Replace every `isWeekend={loadProfileIsWeekend}` with logic that also passes the season context
- Pass `showHighSeason` to chart components so they can determine the correct TOU period map
- Remove all `{showTOU && <TOULegend />}` conditionals -- always render `<TOULegend />`
- Replace the TOU Switch UI with a season toggle labelled "High Demand" / "Low Demand"

### 2. Update chart component interfaces

**Files:** `LoadChart.tsx`, `GridFlowChart.tsx`, `BuildingProfileChart.tsx`, `SolarChart.tsx`

- Add an `isHighSeason` prop (boolean) to each chart's props interface
- Update the `getTOUPeriod()` calls inside each chart to pass a representative month based on `isHighSeason`:
  - High season: pass a month from `touSettings.highSeasonMonths` (e.g. month index 6 for July)
  - Low season: pass a month NOT in `highSeasonMonths` (e.g. month index 0 for January)
- Remove dependency on the `showTOU` boolean for rendering `ReferenceArea` blocks (always render them)

### 3. Update `TOULegend` component

- Always rendered (no conditional). Optionally display the current season label ("High-Demand Season" or "Low-Demand Season") for context.

### 4. Toggle UI Design

Replace:
```text
[Switch] TOU
```

With:
```text
[Switch] High Demand / Low Demand
```

The label will read the active season name. When toggled, the TOU background colours on the chart will update to reflect the selected season's TOU period map (different peak/standard/off-peak hour boundaries).

## Files Modified

1. **`src/components/projects/SimulationPanel.tsx`** -- Replace `showTOU` with `showHighSeason`, update all chart prop passing, update toggle UI (5 tab sections)
2. **`src/components/projects/load-profile/charts/LoadChart.tsx`** -- Add `isHighSeason` prop, always render TOU backgrounds, pass month to `getTOUPeriod`
3. **`src/components/projects/load-profile/charts/GridFlowChart.tsx`** -- Same as above
4. **`src/components/projects/load-profile/charts/BuildingProfileChart.tsx`** -- Same as above
5. **`src/components/projects/load-profile/charts/SolarChart.tsx`** -- Same as above
6. **`src/components/projects/load-profile/components/TOULegend.tsx`** -- Optionally show active season label

## Backward Compatibility

- No data model changes
- No financial engine changes
- Only visual/UI behaviour changes
