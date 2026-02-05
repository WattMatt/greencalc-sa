

## Summary

This plan adds a "Project Summary" collapsible dropdown to the right-hand SummaryPanel. When expanded, all current content (stat cards + layer sections) is visible. When collapsed, the content is hidden but the panel itself remains open/expanded on screen. This provides a cleaner interface when users want to keep the panel open but minimize visual clutter.

---

## Current State

The SummaryPanel has:
1. A fixed header with "Project Summary" title + collapse chevron (to collapse the entire panel)
2. A simulation selector dropdown ("Tendered REV001")
3. A 2x2 grid of stat cards (Modules, Inverters, Walkways, Cable Trays)
4. Multiple collapsible sections (Roof Areas, Main Boards, Modules, Inverters, Walkways, Cable Trays, Cabling)

---

## Proposed Changes

```text
+--------------------------------------------+
|  Project Summary        [collapse panel >] |
|  [v] Summary Contents   <-- NEW DROPDOWN   |
+--------------------------------------------+
|  [ Simulation Selector Dropdown ]          |
|                                            |
|  +------------------+  +----------------+  |
|  | Modules    1195  |  | Inverters   4  |  |
|  +------------------+  +----------------+  |
|  +------------------+  +----------------+  |
|  | Walkways  411 m  |  | Cable Trays    |  |
|  +------------------+  +----------------+  |
|                                            |
|  [v] Roof Areas          9659 m^2          |
|  [v] Main Boards         1                 |
|  [v] Modules             1195              |
|  ... etc                                   |
+--------------------------------------------+
```

When the "Summary Contents" dropdown is collapsed:

```text
+--------------------------------------------+
|  Project Summary        [collapse panel >] |
|  [>] Summary Contents   <-- COLLAPSED      |
+--------------------------------------------+
                          ^-- Empty content area
```

---

## Implementation Details

**File: `src/components/floor-plan/components/SummaryPanel.tsx`**

1. Add a new state variable to control the "Summary Contents" collapsible:
   - `const [summaryContentOpen, setSummaryContentOpen] = useState(true);`

2. Restructure the panel content:
   - Keep the header ("Project Summary" + panel collapse button) as-is
   - Add a new `Collapsible` wrapper around the simulation selector, stat grid, and all layer sections
   - The trigger will be a button labeled "Summary Contents" with a chevron indicator

3. The Collapsible structure:
   ```tsx
   <Collapsible open={summaryContentOpen} onOpenChange={setSummaryContentOpen}>
     <CollapsibleTrigger asChild>
       <button className="flex items-center gap-2 w-full p-2 hover:bg-accent/50 rounded">
         <ChevronDown className={cn("h-4 w-4 transition-transform", 
           summaryContentOpen && "rotate-180")} />
         <span className="text-sm font-medium">Summary Contents</span>
       </button>
     </CollapsibleTrigger>
     <CollapsibleContent>
       {/* All existing content: simulationSelector, stat cards, sections */}
     </CollapsibleContent>
   </Collapsible>
   ```

4. Move the following content inside the `CollapsibleContent`:
   - Simulation selector (`simulationSelector` prop render)
   - 2x2 stat cards grid
   - All `CollapsibleSection` components (Roof Areas, Main Boards, Modules, Inverters, Walkways, Cable Trays, Cabling)

---

## Technical Notes

- Uses the existing `Collapsible`, `CollapsibleTrigger`, and `CollapsibleContent` components from `@/components/ui/collapsible`
- The panel collapse functionality (ChevronRight button in header) remains unchanged and independent
- The new dropdown state is internal to the component and not persisted across navigation
- ChevronDown icon rotates 180 degrees when expanded (consistent with existing section behavior)

