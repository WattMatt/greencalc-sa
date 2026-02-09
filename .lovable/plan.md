

# Two-Level Hierarchical Grouping (Category -> Zone -> Tasks)

## Overview

Add a new `category_owner` grouping mode that displays tasks in a two-level collapsible hierarchy matching the Excel structure. This will be set as the default grouping mode.

## Desired Result

```text
- Site Establishment
    - Task 1
- Inverter Room
    - Tie-in 1
        - Task 2
        - Task 3
- Roof Installation
    - Zone 1
        - Task 4
        - Task 5
    - Zone 2
        - Task 6
```

**Category** (Column A, stored in `task.description`) is the top level. **Zone** (Column B, stored in `task.owner`) is the sub-level. Tasks are nested under their zone.

## Technical Changes

### 1. `src/types/gantt.ts`
- Add `'category_owner'` to `GroupByMode`
- Change `DEFAULT_CHART_CONFIG.groupBy` to `'category_owner'`

### 2. `src/components/gantt/GanttChart.tsx`
- Add a new `hierarchicalGroups` memo that builds an ordered structure: `{ category: string, zones: { zone: string, tasks: GanttTask[] }[] }[]`
  - Groups tasks by `description` (category) first, then by `owner` (zone) within each category
  - Preserves original task sort order
- Add collapsed state handling for two levels:
  - Category key: `"cat::Site Establishment"`
  - Zone key: `"zone::Site Establishment::Zone 1"`
- When `groupBy === 'category_owner'`, render the left panel with:
  - Level-0 headers (category) -- bold, full-width
  - Level-1 headers (zone) -- indented, with zone color dot
  - Task rows -- indented further
- **Critical**: Build a flat `visibleRows` array that includes both headers and tasks in order, and use this same array to render both the left panel and the right timeline panel, ensuring perfect row alignment
- For timeline rows: category/zone header rows render as empty spacer rows (same height), task rows render their bars as usual

### 3. `src/components/gantt/TaskGroupHeader.tsx`
- Add optional `level` prop (0 = category, 1 = zone)
- Level 0: no indent, bold text, folder icon
- Level 1: left padding/indent, zone color dot, slightly lighter styling

### 4. `src/components/gantt/GanttToolbar.tsx`
- Add "By Category & Zone" option to the Group dropdown
- Wire it to `groupBy: 'category_owner'`

### 5. Row alignment strategy
The right-side timeline currently renders tasks in a flat loop. For the hierarchical mode, we will build a unified `visibleRows` array of type `{ type: 'category-header' | 'zone-header' | 'task', ... }[]` and iterate over it in both panels. Header rows in the timeline will be empty rows of the same `ROW_HEIGHT`, keeping left and right panels perfectly synchronized.

