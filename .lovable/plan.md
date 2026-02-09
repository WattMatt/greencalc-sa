

# Fix: Parser Ignores Year from Excel Headers

## Problem
The parser extracts dates as 2026 instead of 2025 because it's using the "Project Year" UI field (2026) as the year, instead of extracting it from the Excel headers like "August-25" (meaning August 2025).

The root cause is likely that when the xlsx library reads "August-25", it converts it to an Excel serial date number. The serial-date-to-Date conversion in `parseMonthHeader` may be producing the wrong result, OR the `referenceYear` fallback (2026) is overriding before the parser encounters a valid header.

## Fix

### 1. `src/lib/ganttImport.ts` - Fix `buildDateHeaders`

The key change: **initialize `year` from the first successfully parsed header, not from `referenceYear`**. The `referenceYear` should only be a last-resort fallback if no header contains year info.

- Change the initialization so `year` starts as `referenceYear` but gets overwritten by the FIRST header that contains a year
- Make sure the serial date parsing in `parseMonthHeader` is correct (the Excel epoch calculation)
- Remove `cellDates: false` from `XLSX.read` and try `cellDates: true` instead -- this will make xlsx return actual Date objects for date-formatted cells, which are much easier to parse correctly than serial numbers

### 2. `src/lib/ganttImport.ts` - Switch to `cellDates: true`

Change line 159:
```typescript
// Before
const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });

// After  
const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
```

This makes xlsx return JS Date objects instead of serial numbers, so `parseMonthHeader` will hit the `instanceof Date` branch and extract the correct month and year directly.

### 3. `src/lib/ganttImport.ts` - Ensure parsed year takes priority

In `buildDateHeaders`, the logic already has `if (parsed.year !== null) { year = parsed.year; }` which should work. The problem is almost certainly that `cellDates: false` causes the header values to be serial numbers, and the serial-to-date math may have off-by-one issues.

With `cellDates: true`, the Date objects will have the correct year baked in.

### 4. Remove debug logging

Clean up the `console.log` statement added in the previous edit.

## Technical Summary

| Change | File | What |
|--------|------|------|
| Switch to cellDates: true | ganttImport.ts line 159 | Makes xlsx return Date objects instead of serial numbers |
| Remove debug console.log | ganttImport.ts line 108 | Clean up |
| Keep existing parseMonthHeader | ganttImport.ts | The Date instance branch will now work correctly |

This is a one-line fix (cellDates) plus cleanup. The year will be correctly extracted as 2025 from the Excel headers.
