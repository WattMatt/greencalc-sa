

## Summary

This plan adds a new "System Details" collapsible dropdown to the right-hand SummaryPanel, positioned below the existing "Summary Contents" dropdown. When expanded, this section will display all placed inverters individually in a list format.

---

## Current State

The SummaryPanel currently has:
1. A fixed header with "Project Summary" title + collapse chevron (to collapse the entire panel)
2. A "Summary Contents" collapsible dropdown containing:
   - Simulation selector dropdown
   - 2x2 grid of stat cards (Modules, Inverters, Walkways, Cable Trays)
   - Multiple collapsible sections (Roof Areas, Main Boards, Modules, Inverters, Walkways, Cable Trays, Cabling)

---

## Proposed Changes

```text
+--------------------------------------------+
|  Project Summary        [collapse panel >] |
+--------------------------------------------+
|  [v] Summary Contents   <-- EXISTING       |
+--------------------------------------------+
|  [>] System Details     <-- NEW DROPDOWN   |
+--------------------------------------------+
   (empty space when both are collapsed)
```

When "System Details" is expanded:

```text
+--------------------------------------------+
|  Project Summary        [collapse panel >] |
+--------------------------------------------+
|  [>] Summary Contents                      |
+--------------------------------------------+
|  [v] System Details                        |
|  +--------------------------------------+  |
|  |  [Eye] Inverter 1  Sungrow 125kW    |  |
|  |  [Eye] Inverter 2  Sungrow 125kW    |  |
|  |  [Eye] Inverter 3  Sungrow 125kW    |  |
|  |  [Eye] Inverter 4  Sungrow 125kW    |  |
|  +--------------------------------------+  |
+--------------------------------------------+
```

---

## Implementation Details

**File: `src/components/floor-plan/components/SummaryPanel.tsx`**

1. Add a new state variable to control the "System Details" collapsible:
   - `const [systemDetailsOpen, setSystemDetailsOpen] = useState(true);`

2. Add a new Collapsible section AFTER the "Summary Contents" collapsible but within the main panel layout. This section will be independent of the Summary Contents collapse state:

3. The System Details Collapsible structure:
   ```tsx
   <Collapsible open={systemDetailsOpen} onOpenChange={setSystemDetailsOpen}>
     <div className="px-3 py-2 border-b">
       <CollapsibleTrigger asChild>
         <button className="flex items-center gap-2 w-full p-2 hover:bg-accent/50 rounded transition-colors">
           <ChevronDown className={cn(
             "h-4 w-4 text-muted-foreground transition-transform",
             !systemDetailsOpen && "-rotate-90"
           )} />
           <Settings className="h-4 w-4 text-muted-foreground" />
           <span className="text-sm font-medium">System Details</span>
         </button>
       </CollapsibleTrigger>
     </div>
     
     <CollapsibleContent>
       <ScrollArea style={{ maxHeight: 'calc(100vh - 200px)' }}>
         <div className="p-3 space-y-1">
           {/* List all inverters individually */}
           {equipment.filter(e => e.type === EquipmentType.INVERTER).length === 0 ? (
             <p className="text-xs text-muted-foreground">No inverters placed</p>
           ) : (
             equipment
               .filter(e => e.type === EquipmentType.INVERTER)
               .map((inv, i) => (
                 <div key={inv.id} className="flex items-center gap-1 p-2 rounded text-xs ...">
                   {/* Visibility toggle */}
                   <button>Inverter {i + 1}</button>
                   {inv.name && <span>{inv.name}</span>}
                   {/* Delete button */}
                 </div>
               ))
           )}
         </div>
       </ScrollArea>
     </CollapsibleContent>
   </Collapsible>
   ```

4. Import the `Settings` icon from lucide-react (or use `Zap` to match the inverter theme)

5. Each inverter item will include:
   - Eye icon for visibility toggle (using existing `onToggleItemVisibility`)
   - Inverter label with index number
   - Inverter name (if set)
   - Selection highlighting when clicked (using existing `onSelectItem`)
   - Delete button (using existing `onDeleteItem`)

---

## Technical Notes

- Uses the same component patterns already established for item lists in the Summary Contents section
- The System Details dropdown is independent from Summary Contents - they can both be open, both closed, or one of each
- Both collapsibles share the same styling for visual consistency
- Clicking an inverter in System Details will select it on the canvas (same behavior as clicking in the existing Inverters section)
- Per-item visibility toggles work the same way as in Summary Contents
- The new section appears between the panel header area and before the summary content area
- Does not affect the panel collapse (ChevronRight) functionality - that still collapses the entire panel

