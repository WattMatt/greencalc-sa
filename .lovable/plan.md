

# Fix Cascade View to Sort by Date (True Gantt Chart)

## Problem

When "Split Bars" is toggled off (cascade mode), each segment becomes its own row, but they remain grouped by task. This means segments from the same task appear together rather than being interleaved chronologically with segments from other tasks. A true Gantt cascade should sort ALL rows within a zone by their start date, so the bars staircase down the chart in chronological order.

## Solution

In `src/components/gantt/GanttChart.tsx`, after expanding all tasks into cascade rows within a zone, sort those rows by their effective start date before pushing them into the final row list.

### Change Details

**File: `src/components/gantt/GanttChart.tsx`**

In the `hierarchicalRows` memo, after collecting all expanded task rows for a zone (both in the `!collapsedGroups.has(zoneKey)` branch and the `skipZoneHeader` branch), sort the collected task rows by start date before appending to the main `rows` array.

- Collect zone task rows into a temporary array
- Sort that array by effective start date (`segmentOverride?.start_date` or `task.start_date`)
- Then push sorted rows into the final list

This ensures that in cascade mode, all segments across all tasks within a zone are ordered chronologically, creating the classic staircase Gantt pattern shown in the reference image.

When `splitView` is ON (split mode), the sort has no negative effect since each task produces only one row.

