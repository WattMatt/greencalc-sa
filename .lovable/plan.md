
# Fix Excel Parser for Actual Schedule Layout

## Problem

The current parser assumes a generic layout with a single header row and auto-detected column positions. The actual Excel file has a specific 3-row date header and 3-column hierarchy structure that doesn't match.

## Actual Excel Layout (from screenshots)

**Header rows (rows 1-3):**
- Row 1: Month names spanning columns (e.g., "August", "SEPTEMBER")
- Row 2: Week labels (e.g., "Week 0", "Week 1", "Week 2")
- Row 3: Day numbers (25, 26, 27, ..., 1, 2, 3, ...)

**Data columns:**
- Column A: Category (vertically merged, e.g., "Site Establishment", "Inverter Room")
- Column B: Zone (vertically merged, e.g., "Zone 1")
- Column C: Task name (e.g., "Site Hand over/Accomodation", "PV Panel Install")
- Column D: Days Scheduled
- Column E: On Track
- Column F: Progress %
- Columns G+: Daily progress cells (filled = work scheduled on that day)

**Data rows start at row 4.**

## Changes

### File: `src/lib/ganttImport.ts` (rewrite core logic)

1. **Date construction from 3 rows**: Scan row 1 for month names (forward-fill across columns), read day numbers from row 3, combine month + day + inferred year to build a date for each column G onward.

2. **3-column hierarchy**: Instead of detecting categories/zones from single-column patterns:
   - Column A (index 0): Read category; forward-fill down (merged cells appear as null in subsequent rows)
   - Column B (index 1): Read zone; forward-fill down similarly
   - Column C (index 2): Task name -- if empty, skip row

3. **Fixed column indices**: Hardcode D=3 (Days Scheduled), E=4 (On Track), F=5 (Progress), G+=6 onward (daily data). No need for header detection since the layout is known.

4. **Start date detection**: For each task row, scan columns G+ to find the first column with data, then look up that column's constructed date.

5. **Year inference**: Since the Excel only has month + day, infer the year from context. Accept an optional `referenceYear` parameter (default to current year). Handle Dec-to-Jan rollover if months go backward.

### File: `src/components/gantt/ImportScheduleDialog.tsx` (minor)

- Add an optional year input field so the user can specify the project year if needed (since the Excel doesn't include years in date headers).

## Technical Details

### Date Construction Logic (rows 1-3)

```text
For each column from G (index 6) onward:
  1. Read row 1 cell -> if non-empty, update currentMonth (parse "August" -> 8, "SEPTEMBER" -> 9)
  2. Read row 3 cell -> dayNumber
  3. If dayNumber < previous dayNumber and month hasn't changed -> month rolled over, increment month
  4. Construct Date(year, month-1, dayNumber)
```

### Row Parsing Logic (rows 4+)

```text
For each row starting at index 3 (row 4 in Excel):
  - colA = row[0] -> if non-empty, update currentCategory
  - colB = row[1] -> if non-empty, update currentZone  
  - colC = row[2] -> taskName; if empty, skip (it's a header-only row)
  - colD = row[3] -> daysScheduled
  - colF = row[5] -> progress %
  - Scan cols 6+ for first non-empty cell -> map to date -> startDate
  - endDate = startDate + daysScheduled - 1
```

### Edge Cases

- Merged cells: xlsx unmerges them, so only the first cell of a merge has a value; subsequent cells are null -- handled by forward-filling currentCategory and currentZone
- Month rollover (e.g., Aug 30, 31 then Sep 1, 2): detect when day number resets
- Year rollover (Dec to Jan): increment year when month goes from 12 to 1
- Missing progress or days: default to 0% and 1 day respectively
