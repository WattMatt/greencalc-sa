

## Add Building Profile and Grid Profile Tabs to Simulation Results

### What Changes

Reorganise the chart tabs from the current 4-tab layout to a 6-tab layout:

```text
Current:  Load Profile | PV Profile | Battery Profile | Load Shedding

New:      Building Profile | Load Profile | Grid Profile | PV Profile | Battery Profile | Load Shedding
```

### Tab Definitions

1. **Building Profile** (new) -- Shows the raw building consumption (the `total` data series) without any solar/battery overlay. This is the pure demand profile of the building before any renewable intervention. Uses the existing `LoadChart` component with the same day navigation and TOU toggle.

2. **Load Profile** -- Keeps the existing net-load chart showing how consumption looks after solar generation is applied. Removes the embedded Grid Flow chart (which moves to its own tab).

3. **Grid Profile** (new) -- The `GridFlowChart` component (import/export) gets its own dedicated tab with its own card wrapper, day navigation header, and TOU toggle. Currently this chart is embedded inside the Load Profile tab.

4. **PV Profile** -- No change.

5. **Battery Profile** -- No change (still conditional on battery being enabled).

6. **Load Shedding** -- No change.

### Technical Details

**File:** `src/components/projects/SimulationPanel.tsx`

1. **Add two new `TabsTrigger` entries** -- `building` before `load`, and `grid` between `load` and `pv`. Use `Building2` and `ArrowDownToLine` icons from lucide-react (already imported or available).

2. **Add `TabsContent value="building"`** -- Render a Card with the same day-navigation header (prev/next day, TOU toggle) and the `LoadChart` component. The chart label inside can read "Building Consumption" instead of "Load Profile".

3. **Move `GridFlowChart` out of the Load Profile tab** -- Remove `<GridFlowChart>` from inside `TabsContent value="load"`. Create a new `TabsContent value="grid"` with its own Card, day-navigation header, TOU toggle, and the `GridFlowChart` component.

4. **Update default tab** -- Change `defaultValue="load"` to `defaultValue="building"` so the first visible tab matches the first position.

5. **Ensure the `TabsList` wraps gracefully** -- Add `flex-wrap` class to `TabsList` so the 6 tabs don't overflow on smaller screens.

No new files, components, or dependencies needed. All charts and data already exist -- this is purely a tab reorganisation.
