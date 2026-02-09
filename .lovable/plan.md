

# Split Gantt Chart: Non-Contiguous Activity Segments

## Overview

Your Excel schedule has tasks where activity days are not continuous -- a single task might be worked on during days 8-12, then again on days 29-31, with a gap in between. Currently, the parser collapses everything into one `start_date` to `end_date` range, drawing a single bar.

This plan adds support for **activity segments** so the Gantt chart can display multiple separate bars on the same row for one task, accurately reflecting the Excel data.

## What Changes

### 1. Parser: Detect Segments (`src/lib/ganttImport.ts`)

Instead of only tracking the first and last active day, the parser will scan each task's daily columns and group consecutive active days into **segments**. Each segment is a `{ start: string, end: string }` pair.

Example: A task with marks on days 8, 9, 10, 11, 12 and then 29, 30, 31 produces two segments:
- Segment 1: `2025-10-08` to `2025-10-12`
- Segment 2: `2025-10-29` to `2025-10-31`

The `ParsedScheduleTask` interface gains a `segments` array. The existing `startDate`/`endDate` fields are kept (first segment start, last segment end) for backward compatibility.

### 2. Database: Add Segments Table

Create a new `gantt_task_segments` table:

```text
gantt_task_segments
  id          uuid (PK)
  task_id     uuid (FK -> gantt_tasks.id, ON DELETE CASCADE)
  start_date  date
  end_date    date
  created_at  timestamptz
```

This stores the non-contiguous date ranges for each task. Tasks with a single continuous range will have one segment (or none -- falling back to the task's own `start_date`/`end_date`).

### 3. Import: Save Segments (`src/components/gantt/ProjectGantt.tsx`)

When importing from Excel, after creating each task, insert its segments into `gantt_task_segments`. If there is only one segment, no segment rows are needed (the task's own dates suffice).

### 4. Data Hook: Fetch Segments (`src/hooks/useGanttTasks.ts`)

Add a query for segments alongside tasks. Provide a `segmentsByTaskId` map so the chart knows which tasks have split bars.

### 5. Chart Rendering: Multiple Bars Per Row (`src/components/gantt/GanttChart.tsx`)

When rendering a task row in the timeline:
- If the task has segments in the map, draw one bar per segment (same color, same row, different positions)
- If no segments exist, draw the single bar as before (using `start_date`/`end_date`)
- Drag/resize/move remain on the overall task dates (not individual segments) to keep editing simple
- Tooltip shows all segment date ranges

### 6. Types Update (`src/types/gantt.ts`)

Add a `GanttTaskSegment` interface and update `ParsedScheduleTask` to include optional `segments`.

## Technical Details

### Parser segment detection logic

```text
// Scan daily columns left-to-right
// Track current "run" of consecutive active days
// When a gap is found (or row ends), close the current run as a segment
// Result: array of { startDate, endDate } pairs
```

### Rendering approach

Each segment renders as an independent bar div within the same row, using the same color and style. The task name label only appears on the first (or widest) segment to avoid clutter.

### Files to create/modify

- **New table**: `gantt_task_segments` (database migration)
- `src/types/gantt.ts` -- add `GanttTaskSegment` interface, update `ParsedScheduleTask`
- `src/lib/ganttImport.ts` -- detect segments during parsing
- `src/hooks/useGanttTasks.ts` -- fetch segments, expose `segmentsByTaskId`
- `src/components/gantt/GanttChart.tsx` -- render multiple bars per task
- `src/components/gantt/ProjectGantt.tsx` -- save segments on import
- `src/components/gantt/ImportScheduleDialog.tsx` -- show segment count in preview table

