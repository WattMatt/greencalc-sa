

# Fix: Parser Using UI Year Instead of Excel Header Year

## Problem
The parser still shows 2026 dates because Excel interprets "August-25" as "August 25th" (a date with day=25), NOT as "August 2025". With `cellDates: true`, the xlsx library converts this to a JS Date object where the "25" becomes the day, and the year defaults to the current year or some Excel default -- not 2025 as intended.

The regex branch in `parseMonthHeader` that correctly handles "Month-YY" format never gets reached because the value arrives as a Date object, not a string.

## Solution
Read the **formatted cell strings** directly from the worksheet object for Row 0 (the month header row), bypassing the date interpretation entirely. Each cell in an xlsx worksheet has a `.w` property containing the original formatted text (e.g., "August-25").

## Technical Changes

### File: `src/lib/ganttImport.ts`

**1. Add a helper to extract formatted strings from Row 0**

Create a function that reads the `.w` (formatted text) property directly from worksheet cells for Row 0. This gives us the original string "August-25" instead of a misinterpreted Date object.

```
function getRow0FormattedValues(sheet, startCol, maxCol):
  For each column from startCol to maxCol:
    Read cell at row 0 (e.g., "G1", "H1", ...)
    Return cell.w (formatted string) or cell.v (raw value) as fallback
```

**2. Update `buildDateHeaders` to accept formatted Row 0 values**

Pass the formatted strings for Row 0 instead of using `rawData[0]`, so `parseMonthHeader` receives "August-25" as a string and the regex correctly extracts month=August, year=2025.

**3. Keep `cellDates: true`** for the rest of the data (daily columns, etc.) -- only Row 0 month headers need special handling.

This ensures the year is always extracted from the Excel headers, and the "Project Year" field only serves as a true fallback when headers contain no year info (e.g., just "August" without "-25").
