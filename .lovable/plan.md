
# Fix CSV Parser Bug + Add Manual Column Mapping Popup

## Root Cause

The `stripQuotes` function has a subtle bug. When splitting a CSV line like:

```text
"P1 (per kW)", "DATE", "TIME", "STATUS"
```

by comma, values after the first have a **leading space**: `' "DATE"'`. The current code does:

```text
s.replace(/^"|"$/g, "").trim()
```

Since the string starts with a space (not a quote), `^"` doesn't match, leaving a stray `"` character. So `"DATE"` becomes `'"date'` after processing, which fails the `/^date$/i` regex match.

**Fix**: Trim whitespace **before** stripping quotes:

```text
s.trim().replace(/^"|"$/g, "").trim()
```

## Changes

### 1. Fix `stripQuotes` in `csvUtils.ts` (one-line fix)

Change:
```
return s.replace(/^"|"$/g, "").trim();
```
To:
```
return s.trim().replace(/^"|"$/g, "").trim();
```

This fixes the core parsing issue for all SCADA CSV files.

### 2. Add CSV Preview Popup (fallback for unrecognized formats)

When auto-parsing returns zero results, instead of just showing an error toast, show a dialog that displays the first few rows of the CSV and lets the user manually select which column is the **date/month** column and which is the **value** column.

#### New file: `src/components/projects/generation/CSVPreviewDialog.tsx`

A dialog component that:
- Displays the first 10 rows of the CSV in a table
- Lets the user click on column headers to assign them as "Date" or "Value"
- Shows a "Parse" button that processes the data using the user-selected columns
- Handles both SCADA format (kW with interval conversion) and simple format (direct kWh)
- Returns the parsed `Map<number, number>` via a callback

#### UI Flow:
1. User uploads CSV
2. Auto-parser runs first (with the bug fix, this should now work for SCADA files)
3. If auto-parser returns 0 results, open the CSVPreviewDialog
4. User sees a table preview and clicks columns to assign roles
5. User clicks "Parse" and the data is processed with their column selections
6. Results are saved to the database as before

### 3. Update `ActualGenerationCard.tsx` and `BuildingLoadCard.tsx`

- Import and render `CSVPreviewDialog`
- Add state for dialog open/close and raw CSV lines
- On CSV upload failure (totals.size === 0), open the dialog instead of showing an error toast
- On successful manual parse from the dialog, proceed with the existing additive upsert logic

## Technical Details

### CSVPreviewDialog Props

```text
interface CSVPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  csvLines: string[];        // raw lines from the file
  onParsed: (totals: Map<number, number>) => void;
}
```

### Column Assignment UI

- Table showing first 10 data rows with clickable column headers
- Each header shows a dropdown or toggle: "Date", "Value", or unassigned
- When both Date and Value are assigned, enable the "Parse" button
- For SCADA files (detected by metadata row), auto-detect interval and convert kW to kWh
- For simple files, treat values as direct kWh

### No database changes required
