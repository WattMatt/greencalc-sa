
# Plan: Left-Align Eye Icons & Add Show/Hide to All Objects

## Summary
This plan will standardize the eye icon alignment across all sections of the Project Summary panel and add per-item visibility controls for every object type. This allows users to show/hide individual items (inverters, main boards, arrays, cables) in addition to the existing category-level visibility controls.

## Current Issues Identified

1. **Inconsistent Eye Icon Placement**: Some eye icons are not left-aligned or have inconsistent margins
2. **Missing Per-Item Visibility**: Individual objects (Main Board 1, Inverter 1, Array 1, DC Cable 1, etc.) cannot be individually hidden

## Implementation Approach

### Step 1: Extend Types for Per-Item Visibility

Add new state types to track individual item visibility:

**File: `src/components/floor-plan/types.ts`**
- Add `itemVisibility` to track which individual items are hidden
- Structure: `Record<string, boolean>` mapping item IDs to visibility state

### Step 2: Update FloorPlanMarkup to Manage Per-Item Visibility State

**File: `src/components/floor-plan/FloorPlanMarkup.tsx`**
- Add new state: `itemVisibility: Record<string, boolean>`
- Add handler: `onToggleItemVisibility(itemId: string)`
- Pass these down to SummaryPanel and Canvas

### Step 3: Redesign SummaryPanel Layout for Consistent Eye Icons

**File: `src/components/floor-plan/components/SummaryPanel.tsx`**

For every row in every section, apply this consistent structure:
```
[Eye Icon (left-aligned)] [Content] [Actions (right-aligned)] [Chevron if expandable]
```

Changes per section:

#### A. Roof Areas - Add per-item eye icons
- Each "Roof 1", "Roof 2" etc. gets its own eye icon

#### B. Main Boards - Add per-item eye icons  
- Each "Main Board 1" gets its own eye icon on the left

#### C. Modules (PV Arrays) - Add per-item eye icons
- Each "Array 1", "Array 2" gets its own eye icon

#### D. Inverters - Add per-item eye icons
- Each "Inverter 1", "Inverter 2" gets its own eye icon

#### E. Walkways - Already has subgroup visibility, add per-item
- Keep the template-level eye icons (e.g., "Onvlee")
- Add eye icon to each individual walkway segment

#### F. Cable Trays - Same as walkways
- Keep thickness-level visibility
- Add per-item eye icons

#### G. Cabling (DC/AC) - Already has thickness visibility, add per-cable
- Keep thickness-level toggles
- Add eye icon to each individual cable

### Step 4: Update Canvas Rendering to Respect Per-Item Visibility

**File: `src/components/floor-plan/components/Canvas.tsx`**
- Filter out hidden items based on `itemVisibility` state
- Apply in: PV array rendering, equipment rendering, walkway rendering, cable tray rendering, cable rendering

**File: `src/components/floor-plan/utils/drawing.ts`**  
- Pass `itemVisibility` to all draw functions
- Skip rendering items where `itemVisibility[id] === false`

## UI Layout Specification

Each expandable section header:
```
|[Eye]| [Icon] Title    Summary |[Chevron]|
```

Each item row:
```
|[Eye]| Item Label      Details |[Delete]|
```

Eye icons will have consistent sizing (`h-5 w-5` or `h-6 w-6`) and left margin (`ml-0` or `-ml-1`).

---

## Technical Details

### New Props for SummaryPanel
```typescript
interface SummaryPanelProps {
  // ... existing props
  itemVisibility?: Record<string, boolean>;
  onToggleItemVisibility?: (itemId: string) => void;
}
```

### State Management in FloorPlanMarkup
```typescript
const [itemVisibility, setItemVisibility] = useState<Record<string, boolean>>({});

const handleToggleItemVisibility = (itemId: string) => {
  setItemVisibility(prev => ({
    ...prev,
    [itemId]: prev[itemId] === false ? true : false
  }));
};
```

### Canvas Filtering Logic
```typescript
// Before rendering each item type:
if (itemVisibility[item.id] === false) return null;
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/types.ts` | Add itemVisibility type definitions |
| `src/components/floor-plan/FloorPlanMarkup.tsx` | Add state + handlers for per-item visibility |
| `src/components/floor-plan/components/SummaryPanel.tsx` | Add eye icons to all individual items, ensure left-alignment |
| `src/components/floor-plan/components/Canvas.tsx` | Filter out hidden individual items from selection/rendering |
| `src/components/floor-plan/utils/drawing.ts` | Skip drawing items marked as hidden |

## Expected Behavior After Implementation

1. **Every row has an eye icon** on the left - categories, sub-categories, and individual items
2. **Toggling a category** hides all items in that category (existing behavior preserved)
3. **Toggling an individual item** hides just that one item on the canvas
4. **Hidden items** are skipped during:
   - Canvas rendering
   - Hit-testing (click selection)
   - Marquee (box) selection
5. **Selecting a hidden item** in the panel auto-shows it (existing pattern)
