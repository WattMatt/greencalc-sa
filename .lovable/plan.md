

# Import Excel Schedule into Gantt Chart

## Overview

Build a dedicated parser for your solar PV project schedule Excel format. The parser will read the hierarchical structure (Category / Zone / Task Name), extract task durations and progress, calculate start/end dates from the daily progress columns, and import everything into the Gantt chart. Zones (1-20 per site) will be mapped to the task `owner` field so you can group by Zone.

## How It Will Work

1. Click **Import** button in the Gantt toolbar (next to Export)
2. Select your Excel file (.xlsx)
3. A preview dialog shows the parsed tasks organized by Zone
4. Review, optionally adjust the project start date, then confirm
5. Tasks are created in the Gantt chart, grouped by Zone

## Excel Format Assumptions

Based on your uploaded schedule:

- **Row structure**: Category (e.g., "Structural", "Electrical") as section headers, then Zone (e.g., "Zone 1", "Zone 2") as sub-headers, then individual task rows underneath
- **Key columns**: Task Name, Days Scheduled, Progress (%)
- **Date columns**: Daily columns (dates as headers) with cell values indicating progress on each day
- **Start date**: Inferred from the first non-empty daily cell for each task
- **End date**: Start date + Days Scheduled
- **Zones**: 1-20 per site, mapped to the `owner` field for grouping

## What Gets Imported

| Excel Field | Gantt Task Field | Notes |
|---|---|---|
| Task Name | `name` | Direct mapping |
| Category | `description` | Stored as context (e.g., "Structural") |
| Zone | `owner` | Enables "Group by Owner" = Group by Zone |
| Days Scheduled | Used to calculate `end_date` | start + days |
| Progress % | `progress` | Direct mapping |
| First date column with data | `start_date` | Auto-detected |
| Zone number | `color` | Each zone gets a distinct color (up to 20) |

## Technical Details

### New Files

1. **`src/lib/ganttImport.ts`** - Core parser
   - `parseScheduleExcel(file: File)` - reads the XLSX file using the existing `xlsx` library
   - Walks rows to detect category headers, zone headers, and task rows
   - Scans date columns to find each task's actual start date
   - Returns a structured array of `{ zone, category, taskName, daysScheduled, progress, startDate, endDate }`
   - Zone detection: looks for rows matching "Zone N" pattern (N = 1-20)
   - Category detection: rows where only the first column has a value (bold/section header rows)

2. **`src/components/gantt/ImportScheduleDialog.tsx`** - Preview and confirm UI
   - File upload dropzone
   - Shows parsed tasks in a table grouped by Zone
   - Lets user adjust the base start date if date columns can't be parsed
   - "Import" button to create all tasks
   - Warning if tasks already exist (option to append or replace)

### Modified Files

3. **`src/components/gantt/GanttToolbar.tsx`**
   - Add "Import" button/menu item next to the Export dropdown
   - Add Upload icon import from lucide-react

4. **`src/components/gantt/ProjectGantt.tsx`**
   - Add state for import dialog open/close
   - Add `onImportTasks` handler that calls `createTask` in a loop for each parsed task
   - Pass import handler and dialog state to toolbar

5. **`src/components/gantt/GettingStartedGuide.tsx`**
   - Add "Import from Excel" as an alternative getting-started option

### Zone-to-Color Mapping

Each zone (up to 20) will be assigned a distinct color from an extended palette so they're visually distinguishable on the Gantt chart:

```text
Zone 1  -> #3b82f6 (Blue)
Zone 2  -> #22c55e (Green)
Zone 3  -> #eab308 (Yellow)
Zone 4  -> #f97316 (Orange)
Zone 5  -> #ef4444 (Red)
Zone 6  -> #a855f7 (Purple)
Zone 7  -> #ec4899 (Pink)
Zone 8  -> #14b8a6 (Teal)
Zone 9  -> #6366f1 (Indigo)
Zone 10 -> #84cc16 (Lime)
... up to Zone 20
```

### Parser Logic (Pseudocode)

```text
1. Read workbook, get first sheet
2. Find the header row (scan for "Task Name" or "Days Scheduled")
3. Identify date columns (columns after the fixed columns with date-parseable headers)
4. Walk each row below the header:
   a. If row has value only in column A -> Category header
   b. If row matches "Zone N" pattern -> Zone header
   c. Otherwise -> Task row: extract name, days, progress
   d. For task rows, scan date columns to find first non-empty cell -> start date
   e. end_date = start_date + days_scheduled
5. Return parsed tasks with zone and category metadata
```

### Import Flow

```text
User clicks "Import" -> File picker -> Parse Excel ->
  Show preview dialog with tasks grouped by zone ->
    User confirms -> Batch create tasks via existing createTask mutation ->
      Tasks appear in Gantt chart, grouped by Zone (owner)
```

### Edge Cases Handled

- No date columns found: user manually sets a project start date, tasks are stacked sequentially
- Merged cells in Excel: xlsx library unmerges automatically
- Empty/blank rows: skipped
- Duplicate task names across zones: allowed (different owner distinguishes them)
- Existing tasks: dialog offers "Append" or "Replace all" options

