

# Plan: Fix normaliser for bare-date timestamps

## Root Cause

When `timeCol` is -1 (no separate time column in the CSV), `BulkCsvDropzone` constructs timestamps like `"2024-01-15"` (date only, no time portion). The normaliser's Format 3 has three regex patterns, all of which **require a time component** after the date. A bare date string matches none of them and gets filtered out as `null` — resulting in `raw_data: []`.

The dates use dashes (`2024-01-15`), not slashes, so the existing ISO regex would work fine if the time were present. The fix is simply to add a fallback for date-only strings.

## Change

### File: `src/components/loadprofiles/utils/normaliseRawData.ts` (lines ~65-88)

After the existing three regex checks (ISO-like, SA format, Legacy), add a fallback before the `return null`:

```typescript
// Date-only: "YYYY-MM-DD" with no time component
const dateOnlyMatch = ts.match(/^(\d{4}-\d{2}-\d{2})$/);
if (dateOnlyMatch) {
  return { date: dateOnlyMatch[1], time: "00:00:00", value: val };
}

// Date-only SA: "DD/MM/YYYY" or "DD-MM-YYYY" with no time
const saDateOnly = ts.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
if (saDateOnly) {
  const date = `${saDateOnly[3]}-${saDateOnly[2].padStart(2, "0")}-${saDateOnly[1].padStart(2, "0")}`;
  return { date, time: "00:00:00", value: val };
}
```

### File: `supabase/functions/normalise-raw-data/index.ts`

Mirror the same two fallback patterns in the edge function's Format 3 handler for consistency.

### Recovery

After deploying, the user can re-process the existing `PDB_36506619_KFCDT_22m2` meter via the "Re-process" button in the Meter Library, which will re-read the stored CSV and correctly populate `raw_data`.

## No database changes required

