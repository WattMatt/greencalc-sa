

# Reorder Carousel Tabs and Restructure Inverter Pane

## Changes

### 1. Reorder carousel panes (SimulationPanel.tsx, ~line 1500)

Change the order of the `panes` array from:
- Solar Modules, Inverters, Battery, Financial

To:
- **Inverters, Solar Modules, Battery, Financial**

### 2. Remove Inverter pane heading (SimulationPanel.tsx, ~lines 1628-1636)

Remove the `CardHeader` containing "Inverter-Based Sizing" title and "Size system based on inverter capacity and grouping" description.

### 3. Move Quick Select to the top (InverterSliderPanel.tsx)

Restructure the component layout from:
1. Number of Inverters slider
2. DC/AC Ratio slider
3. Calculated Metrics box
4. Quick Select buttons
5. Validation status

To:
1. **Quick Select buttons** (moved to top)
2. Number of Inverters slider
3. DC/AC Ratio slider
4. Calculated Metrics box
5. Validation status

---

### Files Modified
1. `src/components/projects/SimulationPanel.tsx` -- Reorder panes array; remove CardHeader from inverter pane
2. `src/components/projects/InverterSliderPanel.tsx` -- Move Quick Select section to top of component

