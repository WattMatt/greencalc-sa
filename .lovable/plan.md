

# Remove Fallback Chain -- Require Dates from Excel

## Problem
The parser currently has a fallback chain (reference year, fallback start date, filename, current year) that silently fills in missing date information. This causes incorrect dates without the user knowing why.

## Solution
Remove all fallback logic. If the parser cannot determine the year, month, or day from the Excel headers, it should report a clear error and produce no tasks.

## Technical Changes

### File: `src/lib/ganttImport.ts`

**1. Remove `extractYearFromFilename` helper** (if present)

**2. Remove `fallbackStartDate` and `referenceYear` parameters from `parseScheduleExcel`**

The function signature becomes:
```text
parseScheduleExcel(file: File): Promise<ParsedScheduleResult>
```

**3. Update `buildDateHeaders` -- error on missing year**

- Remove the `referenceYear` parameter
- Initialize `year` as `null`
- When a month header is parsed with `year: null` and no year has been set yet, push an error: `"Month header '[value]' has no year. Expected format like 'August-25'."`
- Return empty headers if year is never determined

**4. Update date assignment for tasks -- error on missing start date**

Currently if no start date is found in daily columns, it falls back to `fallbackStartDate` or `new Date()`. Change this to:
- If no start date found for a task, push an error: `"Task '[name]' has no start date in the schedule columns."`
- Skip the task (don't add it to the results)

**5. Remove the `fallbackStartDate` usage for task end date calculation**

End date is calculated from start date + days scheduled. If start date is missing, the task is skipped (per above).

### File: `src/components/gantt/ImportScheduleDialog.tsx`

**6. Remove the "Override year" toggle, year input, "Override start date" toggle, and date picker**

These UI elements are no longer needed since there are no fallbacks.

**7. Simplify the `parseScheduleExcel` call**

```text
Before: parseScheduleExcel(file, fallbackDate, referenceYear, file.name)
After:  parseScheduleExcel(file)
```

**8. Display parsing errors prominently**

The `errors` array from the result should be shown to the user so they know exactly what's missing in their Excel file.

## Summary

| Change | File | What |
|--------|------|------|
| Remove fallback params | ganttImport.ts | Remove `fallbackStartDate`, `referenceYear`, `fileName` params |
| Error on missing year | ganttImport.ts | Push error if month header has no year info |
| Error on missing task date | ganttImport.ts | Push error and skip task if no start date found |
| Remove override UI | ImportScheduleDialog.tsx | Remove year/date toggle controls |
| Simplify call | ImportScheduleDialog.tsx | Call with just `file` argument |

