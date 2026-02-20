

## Fix: Excel Date Parsing Failure ("No meter files could be processed")

### Root Cause

When `.xlsx` files are read, the XLSX library converts them to CSV. However, the `XLSX.read()` call is missing the `cellDates: true` option. This means Excel stores dates internally as serial numbers (e.g., `45658.5` instead of `2024-12-31 12:00:00`). The downstream CSV parser (`parseDateTime`) only understands human-readable date formats like `DD/MM/YYYY` or `YYYY-MM-DD`, so every single row fails to parse -- resulting in the "No meter files could be processed" error.

### Fix

**File: `src/components/projects/ScadaImportWizard.tsx` -- `readFileAsText` function (line 200)**

Change the XLSX read call to include `cellDates: true`, which tells the library to convert Excel serial date numbers into JavaScript Date objects, and then `sheet_to_csv` will output them as proper date strings.

```text
Before:
  const wb = XLSX.read(data, { type: "array" });

After:
  const wb = XLSX.read(data, { type: "array", cellDates: true });
```

This is a one-line fix. No other files need to change.

### Files Modified
- `src/components/projects/ScadaImportWizard.tsx` -- add `cellDates: true` to `XLSX.read()` options

