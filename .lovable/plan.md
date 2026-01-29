
# Fix Summary Panel Layout: Separate Cards from Dropdowns

## Problem
The current implementation incorrectly makes the 4 summary cards (Modules, Inverters, Walkways, Cable Trays) themselves into collapsible dropdown triggers. This mixes the summary display with the detailed list functionality.

## Solution
Restructure the Summary Panel to have:
1. **Static 2x2 Summary Cards Grid** - Display metrics only, no dropdown functionality on the cards themselves
2. **Separate Collapsible Sections Below** - Four dropdown sections in order: Modules (PV Arrays), Inverters (Equipment), Walkways, Cable Trays

## Visual Structure

```text
+---------------------------+
| Project Summary         > |
+---------------------------+
| Roof Areas      9659 m² v |  <- Collapsible section
+---------------------------+
| [Modules]    [Inverters]  |  <- Static cards (2x2 grid)
|   1302           0        |
| [Walkways]  [Cable Trays] |
|    6 m           9 m      |
+---------------------------+
| # Modules           52  v |  <- Collapsible: PV Arrays list
| z Inverters          0  v |  <- Collapsible: Equipment list
| F Walkways         6 m  v |  <- Collapsible: Walkways list
| B Cable Trays      9 m  v |  <- Collapsible: Cable Trays list
+---------------------------+
| Cabling            0 m  v |  <- Existing DC/AC cabling section
+---------------------------+
```

## Changes Required

### File: `src/components/floor-plan/components/SummaryPanel.tsx`

1. **Extract the 2x2 grid cards from Collapsible wrappers**
   - Remove `<Collapsible>`, `<CollapsibleTrigger>`, and `<CollapsibleContent>` from around each card
   - Keep the cards as static display-only components
   - Remove the chevron icons from the cards
   - Keep the simulation comparison indicators (amber border, checkmark/count)

2. **Add four new `CollapsibleSection` components after the grid**
   - **Modules section**: Uses `Hash` icon, shows PV arrays list with selection and delete
   - **Inverters section**: Uses `Zap` icon, shows equipment grouped by type
   - **Walkways section**: Uses `Footprints` icon, shows walkway dimensions list
   - **Cable Trays section**: Uses `Box` icon, shows cable tray dimensions list

3. **All four new sections default to closed** (`defaultOpen={false}`)

4. **Keep the existing Cabling section** (DC/AC cables) at the bottom

## Technical Details

The reusable `CollapsibleSection` component already exists and will be used for the new dropdown sections. Each section will receive:
- `icon`: Matching icon from the corresponding card
- `title`: "Modules", "Inverters", "Walkways", "Cable Trays"
- `summary`: Count or length summary (e.g., "52", "0", "6 m", "9 m")
- `defaultOpen`: `false`
- `children`: The list content currently inside each card's `CollapsibleContent`
