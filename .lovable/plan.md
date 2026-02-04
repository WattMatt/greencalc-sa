
# Plan: Vertically Align All Eye Icons Across All Hierarchy Levels

## Problem Summary

Looking at the screenshot, the eye icons are not vertically aligned:
- **Category level** (Walkways): Eye icon is at position X
- **Sub-group level** (Onvlee): Eye icon is indented by `pl-2`, pushing it right
- **Individual item level** (Walkway 1, 2, 3...): Eye icon is further indented by `pl-6`, pushing it even more right

This creates a staggered appearance where eye icons don't line up in a single vertical column.

## Solution Approach

Use a **fixed-width left column** for all eye icons by:
1. Removing the indentation from where eye icons are placed
2. Using a consistent left padding/margin structure
3. Applying indentation only to the **content** after the eye icon, not the eye icon itself

### Layout Structure (Before)
```
|pl-0 [Eye] [Icon] Category...
|pl-2    [Eye] Sub-group...
|pl-6       [Eye] Item...
```

### Layout Structure (After)
```
|[Eye] pl-0 [Icon] Category...
|[Eye] pl-2    Sub-group...
|[Eye] pl-4       Item...
```

All eye icons will be in the same column (left-aligned), with progressive indentation applied to the content only.

## Implementation Details

### 1. Update `CollapsibleSection` Component (Category Headers)

**File:** `src/components/floor-plan/components/SummaryPanel.tsx` (lines 94-144)

Change the structure so the eye icon has no left margin offset, and content starts at a consistent position:
```typescript
<div className="flex items-center w-full">
  {/* Eye icon - fixed column, no offset */}
  {onToggleVisibility !== undefined && (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"  // Remove -ml-1
      ...
    />
  )}
  {/* Content with icon, title, summary, chevron */}
  <CollapsibleTrigger className="flex items-center gap-2 flex-1 ...">
```

### 2. Update `GroupedMaterialSection` Component (Category Headers for Walkways/Cable Trays)

**File:** `src/components/floor-plan/components/SummaryPanel.tsx` (lines 218-263)

Same pattern - remove `-ml-1` from eye button, keep content as-is.

### 3. Update Sub-group Level (Within GroupedMaterialSection)

**File:** `src/components/floor-plan/components/SummaryPanel.tsx` (lines 268-317)

Currently the sub-group is wrapped in `pl-2`. Change structure:
```typescript
<div className="space-y-1"> {/* Remove pl-2 from here */}
  {groupKeys.map((key) => {
    return (
      <Collapsible key={key}>
        <div className="flex items-center gap-1 w-full">
          {/* Eye icon at fixed position (same as parent) */}
          <Button className="h-5 w-5 shrink-0" ... />
          {/* Content wrapper with indentation */}
          <CollapsibleTrigger className="flex items-center gap-2 flex-1 pl-2 ...">
```

### 4. Update Individual Item Level (Walkways, Cable Trays)

**File:** `src/components/floor-plan/components/SummaryPanel.tsx` (lines 318-386)

Currently items are wrapped in `CollapsibleContent className="pt-1 pl-6"`. Move indentation inside:
```typescript
<CollapsibleContent className="pt-1 space-y-1"> {/* Remove pl-6 */}
  {group.items.map((item, itemIndex) => (
    <div className="flex items-center gap-1 ...">
      {/* Eye icon - same column position */}
      <Button className="h-5 w-5 shrink-0" ... />
      {/* Content with indentation */}
      <button className="flex-1 text-left pl-4 ...">
```

### 5. Update Other Sections to Match

Apply the same pattern to:
- **Roof Areas** section (lines 646-733)
- **Main Boards** section (lines 746-824)
- **Modules (PV Arrays)** section (lines 839-911)
- **Inverters** section (lines 925-998)
- **Cabling DC/AC** section (lines 1050-1400+)

### CSS Approach Summary

| Level | Eye Icon Class | Content Padding |
|-------|----------------|-----------------|
| Category Header | `h-6 w-6 shrink-0` (no ml offset) | `pl-0` |
| Sub-group | `h-5 w-5 shrink-0` | `pl-2` (on content, not wrapper) |
| Individual Item | `h-5 w-5 shrink-0` | `pl-4` (on content, not wrapper) |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/floor-plan/components/SummaryPanel.tsx` | Restructure all collapsible sections to place eye icons in a fixed left column, with indentation applied only to content |

## Expected Result

After implementation:
1. All eye icons (category, sub-group, item level) will be vertically aligned in a single left column
2. Progressive indentation will still show hierarchy, but applied to the content text/icons only
3. The overall visual structure remains familiar, just with cleaner alignment
