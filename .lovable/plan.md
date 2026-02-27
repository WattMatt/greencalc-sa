
# Replace "Loaded" Banner with Collapsible Saved Configurations Dropdown

## What Changes

1. **Remove the "Loaded: Auto-saved Feb 27, 08:01" banner** from the top of the Simulation panel (lines 1481-1506 of `SimulationPanel.tsx`). This blue card with the CheckCircle2 icon is not useful as a persistent banner.

2. **Replace it with a collapsible dropdown** that shows the saved configurations list inline. The collapsible header will display the currently loaded simulation name (e.g. "Auto-saved Feb 27, 08:01") and expand to show the full list of saved configs when clicked.

3. **Auto-select the most recent saved configuration** when entering the tab. The existing `hasInitializedFromSaved` logic already loads the last saved simulation on mount -- this behaviour stays. The collapsible header just reflects which config is active.

## Technical Details

### SimulationPanel.tsx
- **Remove** the "Loaded Simulation Indicator" Card block (lines 1481-1506)
- **Replace** it with a `Collapsible` component that:
  - Has a trigger showing the loaded simulation name + date (or "No configuration loaded" if none)
  - Contains the `SavedSimulations` component inside `CollapsibleContent`
  - Starts collapsed by default
- Move the `SavedSimulations` rendering from its current position (line 2138) into this collapsible
- Keep `loadedSimulationName` and `loadedSimulationDate` state for the header display

### SavedSimulations.tsx
- No structural changes needed -- it already handles loading, comparing, saving, and deleting
- The component will simply be rendered inside the collapsible content instead of at the bottom of the panel

### UI Layout
```
[Collapsible Trigger: "Auto-saved Feb 27, 08:01 . 27 Feb 2026 08:01" ChevronDown]
  |-- (expanded) --|
  | Actions bar (compare button, save count, Save button)        |
  | Comparison table (if comparing)                               |
  | Saved config cards (clickable to load, with checkboxes, etc.) |
  |--------------------------------------------------------------|
```

### Files Changed

| File | Change |
|------|--------|
| `SimulationPanel.tsx` | Remove loaded-banner card; wrap SavedSimulations in a Collapsible at the banner's former position; remove the old SavedSimulations render location |
| `SavedSimulations.tsx` | No changes |
