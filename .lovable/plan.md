

# Add Split/Cascade Toggle for Gantt Chart

## Overview

Add a toggle button in the Gantt toolbar that switches between two display modes:

- **Split View** (current default): Tasks with multiple segments show as multiple bars on a single row.
- **Cascade View**: Each segment of a split task becomes its own separate row, all sharing the same task name. This "explodes" multi-segment tasks into individual rows for a traditional cascading Gantt look.

## What Changes

### 1. New Config Property (`src/types/gantt.ts`)

Add a `splitView` boolean to `GanttChartConfig`. When `true` (default), segments render as multiple bars on one row. When `false`, segments are expanded into separate visual rows.

### 2. Toolbar Toggle (`src/components/gantt/GanttToolbar.tsx`)

Add a new toggle button in the toolbar area (near Dependencies/Milestones toggles) with a label like "Split Bars". It will use the existing button pattern -- `variant="secondary"` when active, `variant="ghost"` when inactive. Clicking it flips `config.splitView`.

### 3. Chart Rendering Logic (`src/components/gantt/GanttChart.tsx`)

When `splitView` is OFF (cascade mode):
- In the hierarchical rows memo and the grouped tasks rendering, tasks with multiple segments will be expanded into multiple "virtual" rows.
- Each virtual row represents one segment and displays the same task name, color, progress, and owner.
- Each virtual row renders a single bar positioned according to that segment's start/end dates.

When `splitView` is ON (current behavior):
- No change -- multiple bars render on the same row as they do now.

### 4. Toolbar Props Update

Pass the new `splitView` config through the existing `config`/`onConfigChange` pattern already used by the toolbar. No new props needed.

## Technical Details

### Config change
- Add `splitView: boolean` to `GanttChartConfig` interface
- Set default to `true` in `DEFAULT_CHART_CONFIG`

### Cascade row expansion
In `GanttChart.tsx`, create an intermediate step before rendering rows. When `splitView` is `false`:
- For each task, check `segmentsByTaskId` for segments
- If a task has N segments (N > 1), produce N "virtual task entries" in the row list, each carrying a single segment's date range
- The task list panel shows the same task name for each expanded row
- The timeline panel renders a single bar per row using the segment's dates

### Toolbar button
A simple toggle button with a relevant icon (e.g., `SplitSquareHorizontal` or `Rows3` from lucide) placed after the Milestones toggle.

### Files to modify
- `src/types/gantt.ts` -- add `splitView` to config and default
- `src/components/gantt/GanttToolbar.tsx` -- add toggle button
- `src/components/gantt/GanttChart.tsx` -- cascade expansion logic when `splitView` is false

