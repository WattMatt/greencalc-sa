
# Plan: Summary Panel Grouping and Material Selection for Placement

## Overview

The user has requested two related improvements to the PV Layout editor:

1. **Summary Panel Grouping**: In the Project Summary, instead of listing all placed cable trays (or walkways) flat under one dropdown, group them by their configuration type (e.g., "Onlee 76x76", "Onlee 152x76"). Each sub-group would show the count and total length for that specific type.

2. **Material Selection Before Placement**: When clicking "Cable Tray" or "Walkway" in the Materials section of the Toolbar, the user needs the ability to choose WHICH cable tray/walkway template to place (from the Plant Setup configuration), rather than defaulting to the first one. The user suggests adding a small "configure" button next to the material buttons in the toolbar.

---

## Solution Design

### Part 1: Summary Panel Grouping

**Current Behavior:**
- Cable Trays section shows all placed cable trays as a flat list
- Each item shows: `{name} | {width}m x {length}m`

**Proposed Behavior:**
- Cable Trays section shows a nested structure:
  - Main dropdown: "Cable Trays" with total length summary
  - Sub-groups by `configId` (template type): 
    - "Onlee 76x76" (3 items, 9m total)
    - "Onlee 152x76" (2 items, 6m total)
  - Each sub-group expands to show individual items

**Implementation:**
- Create a helper function to group `placedCableTrays` by their `configId` (which references the template)
- For each group, calculate the count and total length
- Use a nested `Collapsible` component structure

### Part 2: Material Type Selection in Toolbar

**Current Behavior:**
- Clicking "Cable Tray" or "Walkway" opens the `PlacementOptionsModal` (for orientation/spacing)
- The modal uses the first available template from `plantSetupConfig.cableTrays[0]`
- No way to select a specific template before placing

**Proposed Behavior:**
- Add a small "configure" icon button next to the "Cable Tray" and "Walkway" buttons in the Materials section
- Clicking the configure button opens a quick selector dropdown/popover showing all available templates
- The selected template is remembered (via `selectedCableTrayId` / `selectedWalkwayId` state)
- The PlacementOptionsModal displays which template is being placed
- When placing, the selected template is used instead of the first one

**Implementation Approach:**
- Add a small Settings/Cog icon button next to "Walkway" and "Cable Tray" tool buttons
- This opens a Popover with a list of available templates from `plantSetupConfig`
- Clicking a template sets `selectedWalkwayId` or `selectedCableTrayId` in the parent state
- Update `PlacementOptionsModal` to receive and display the selected template
- The placement workflow then uses the selected template

---

## Technical Implementation

### File: `src/components/floor-plan/components/SummaryPanel.tsx`

**Changes:**
1. Add a new `NestedCollapsibleSection` component for grouped items
2. Create a helper function to group placed items by their `configId`:
   ```typescript
   const groupedCableTrays = useMemo(() => {
     const groups: Record<string, { name: string; items: PlacedCableTray[]; totalLength: number }> = {};
     placedCableTrays.forEach(tray => {
       const key = tray.configId || 'default';
       if (!groups[key]) {
         groups[key] = { name: tray.name, items: [], totalLength: 0 };
       }
       groups[key].items.push(tray);
       groups[key].totalLength += tray.length;
     });
     return groups;
   }, [placedCableTrays]);
   ```
3. Update the Cable Trays and Walkways sections to use nested collapsibles:
   - Top level: "Cable Trays" - total length
   - Second level: "Onlee 76x76" - count and subtotal
   - Third level: Individual items with delete buttons

### File: `src/components/floor-plan/components/Toolbar.tsx`

**Changes:**
1. Add new props to receive and update the selected template IDs:
   - `selectedWalkwayId`, `setSelectedWalkwayId`
   - `selectedCableTrayId`, `setSelectedCableTrayId`
2. Modify the "Walkway" and "Cable Tray" tool buttons to include a small configure button:
   ```tsx
   <div className="flex items-center gap-1">
     <ToolButton 
       icon={...} 
       label="Cable Tray" 
       isActive={...} 
       onClick={...} 
     />
     <Popover>
       <PopoverTrigger asChild>
         <Button variant="ghost" size="icon" className="h-6 w-6">
           <Settings className="h-3 w-3" />
         </Button>
       </PopoverTrigger>
       <PopoverContent>
         {/* List of cable tray templates */}
       </PopoverContent>
     </Popover>
   </div>
   ```
3. Add a `MaterialSelector` sub-component or inline Popover that lists all templates for the material type

### File: `src/components/floor-plan/FloorPlanMarkup.tsx`

**Changes:**
1. Pass `selectedWalkwayId` and `selectedCableTrayId` to the Toolbar
2. Pass setters for these state values to allow the Toolbar to update them
3. Update `getPlacementItemName` and `getPlacementDimensions` to use the selected template ID instead of always using `[0]`

### File: `src/components/floor-plan/components/PlacementOptionsModal.tsx`

**Changes (Optional Enhancement):**
1. Display the selected template name prominently in the modal
2. Could add a dropdown to switch templates within the modal (future enhancement)

---

## UI Mockups

### Summary Panel - Nested Cable Trays

```
Cable Trays                                414 m  v
  ├─ Onlee 76×76                           9m (3) v
  │   ├─ Onlee 76×76    0.076m × 3m        [🗑]
  │   ├─ Onlee 76×76    0.076m × 3m        [🗑]
  │   └─ Onlee 76×76    0.076m × 3m        [🗑]
  └─ Onlee 152×76                          6m (2) v
      ├─ Onlee 152×76   0.152m × 3m        [🗑]
      └─ Onlee 152×76   0.152m × 3m        [🗑]
```

### Toolbar - Material Selection

```
Materials                                      v
  ├─ DC Cable
  ├─ AC Cable
  ├─ DC Combiner
  ├─ AC Disconnect
  ├─ Walkway                              [⚙]
  │   Currently: 600mm Walkway
  └─ Cable Tray                           [⚙]
      Currently: Onlee 76×76
```

Clicking [⚙] opens a popover:
```
┌─────────────────────────┐
│ Select Cable Tray       │
├─────────────────────────┤
│ ○ Onlee 76×76    0.076m │
│ ● Onlee 152×76   0.152m │  ← currently selected
│ ○ Onlee 304×76   0.304m │
│ ○ Cabstrut 300×76 0.3m  │
└─────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/components/SummaryPanel.tsx` | Add grouping logic and nested collapsibles for Cable Trays and Walkways |
| `src/components/floor-plan/components/Toolbar.tsx` | Add material type selector popover next to Walkway and Cable Tray buttons |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | Pass selected template IDs and setters to Toolbar |

---

## Testing Checklist

1. **Summary Panel Grouping:**
   - Place multiple cable trays of different types
   - Verify they appear grouped by type in the summary
   - Verify counts and totals are correct for each group
   - Verify individual items can be deleted from within groups
   - Repeat for walkways

2. **Material Selection:**
   - Click the config button next to Cable Tray
   - Verify all configured cable tray templates appear
   - Select a specific template
   - Click Cable Tray tool and verify the PlacementOptionsModal shows the selected template
   - Place the item and verify it uses the correct template dimensions
   - Repeat for walkways
