
# Add Simulation Requirements to Summary Panel and Reorder Sections

## Summary
This plan addresses two requests:
1. Display the simulation's required module count and inverter count in the Modules and Inverters cards
2. Move the "Roof Areas" dropdown from the top to between the 2x2 summary grid and the "Modules" dropdown

## Current Behavior
- The Summary Panel cards show `panelCount` (from placed PV arrays on canvas) and `layoutInverterCount` (placed equipment)
- The cards can show `/X` comparison when `simModuleCount` and `simInverterCount` exist in `latestSimulation.results_json`
- However, **these values are not currently saved** to `results_json` in the simulation auto-save
- The "Roof Areas" collapsible is currently at the very top, before the 2x2 card grid

## Changes Required

### 1. Save Module and Inverter Counts to Simulation Results
**File:** `src/components/projects/SimulationPanel.tsx`

Add two new fields to the `results_json` object in the auto-save mutation:
- `moduleCount`: From `moduleMetrics.moduleCount` (calculated based on DC capacity and module specs)
- `inverterCount`: From `inverterConfig.inverterCount`

This will enable the Summary Panel to read these values and display them as the simulation requirement.

### 2. Reorder Summary Panel Sections
**File:** `src/components/floor-plan/components/SummaryPanel.tsx`

Move the "Roof Areas" `CollapsibleSection` from its current position (before the 2x2 grid) to after the grid and before the "Modules" dropdown section.

**New order will be:**
1. 2x2 Summary Grid (Modules, Inverters, Walkways, Cable Trays)
2. Roof Areas (collapsible)
3. Modules detail dropdown
4. Inverters detail dropdown
5. Walkways detail dropdown
6. Cable Trays detail dropdown
7. Cabling detail dropdown

## Visual Result

```text
+---------------------------+
| Project Summary         > |
+---------------------------+
| [Modules]    [Inverters]  |  <- Cards now show "52 /55" format
|   52/55          0/3      |     (layout count / simulation requirement)
| [Walkways]  [Cable Trays] |
|    0 m           0 m      |
+---------------------------+
| Roof Areas      9659 m² v |  <- MOVED HERE (was at top)
+---------------------------+
| # Modules           52  v |  <- Collapsible dropdown
| z Inverters          0  v |
| F Walkways         0 m  v |
| B Cable Trays      0 m  v |
+---------------------------+
| Cabling            0 m  v |
+---------------------------+
```

## Technical Changes

### File 1: `src/components/projects/SimulationPanel.tsx`
- Line ~898: Add `moduleCount` and `inverterCount` to `results_json` object

```typescript
results_json: JSON.parse(JSON.stringify({
  // ... existing fields
  advancedConfig,
  // NEW: Save module and inverter counts for layout comparison
  moduleCount: moduleMetrics.moduleCount,
  inverterCount: inverterConfig.inverterCount,
})),
```

### File 2: `src/components/floor-plan/components/SummaryPanel.tsx`
- Remove the "Roof Areas" `CollapsibleSection` from lines 165-226 (before the grid)
- Insert it after the grid (after line 327) and before the "Modules" dropdown (line 330)

## Testing
After implementation:
1. Go to Simulation tab and configure/save a simulation
2. Navigate to PV Layout tab
3. Verify the Modules and Inverters cards show the simulation requirement (e.g., "0/55" meaning 0 placed, 55 required)
4. Verify Roof Areas dropdown appears between the cards and the Modules dropdown
