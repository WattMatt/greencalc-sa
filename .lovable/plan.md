

# Fix: Raw Data Time Preservation in Bulk CSV Import

## Problem

After the `timeCol` detection fix, the `raw_data` stored for `PDB_36506616_SolarDB2.12` still shows `time: "00:00:00"` for all 1344 rows. Investigation reveals **two independent bugs**:

1. **The time detection fix may not have been active at re-import time** — the file was processed at `2026-03-09 08:36:23`, potentially before the latest deployment.

2. **`normaliseRawData` cannot parse `YYYY/MM/DD HH:MM:SS` timestamps** — Even with the `timeCol` fix, line 394 constructs a `{ timestamp, value }` object like `"2026/02/01 00:30:00"`. The normaliser's Format 3 tries these regexes in order:
   - ISO: `YYYY-MM-DD` (requires dashes) → FAILS for slash dates
   - SA: `DD/MM/YYYY HH:MM:SS` (first capture `\d{1,2}`) → FAILS when year comes first (4 digits)
   - Legacy split: requires 4+ space-separated parts → FAILS (only 2 parts)
   - All fallbacks also fail → returns `null` → filtered out

   If data IS present (1344 rows), it means the timestamp format just happens to match another path but loses the time component.

## Root Cause Summary

The `BulkCsvDropzone` constructs an intermediate `{ timestamp, value }` format and passes it through `normaliseRawData`. This is fragile because the timestamp string format depends on the CSV's date column format, and `normaliseRawData` doesn't support all variants (particularly `YYYY/MM/DD`).

## Solution

**Bypass the intermediate `{ timestamp, value }` format entirely.** Since `BulkCsvDropzone` already knows `dateCol` and `timeCol` separately, construct `{ date, time, value }` objects directly — the canonical normalised format — without needing `normaliseRawData` to parse a combined timestamp string.

### File: `src/components/loadprofiles/BulkCsvDropzone.tsx` (~line 393-396)

Replace:
```typescript
raw_data: normaliseRawData(rows.map(row => ({
  timestamp: `${row[dateCol] || ''} ${timeCol >= 0 ? (row[timeCol] || '') : ''}`.trim(),
  value: parseFloat(row[valueCol]?.replace(/[^\d.-]/g, '') || '0') || 0
})).filter(d => d.value !== 0 || d.timestamp)),
```

With logic that:
1. Extracts `dateStr = row[dateCol]` and `timeStr = row[timeCol]` separately
2. Normalises the date string to `YYYY-MM-DD` (handling `YYYY/MM/DD`, `DD/MM/YYYY`, already-ISO)
3. Normalises the time string to `HH:MM:SS` (padding if needed)
4. If no separate time column, splits combined datetime from the date cell
5. Constructs `{ date, time, value }` directly — already in canonical format, no `normaliseRawData` needed

This reuses the same date-parsing awareness that `processCSVToLoadProfile` → `parseDateTime` already has, ensuring the `raw_data` matches the profile data.

### Secondary fix: `src/components/loadprofiles/utils/normaliseRawData.ts`

Add a `YYYY/MM/DD HH:MM:SS` regex to Format 3 (between ISO and SA checks) as a safety net for any other code paths that construct `{ timestamp, value }` with slash-formatted dates:

```typescript
// YYYY/MM/DD format
const slashIso = ts.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})[T\s](\d{2}:\d{2}(?::\d{2})?)/);
if (slashIso) {
  const date = `${slashIso[1]}-${slashIso[2].padStart(2,"0")}-${slashIso[3].padStart(2,"0")}`;
  return { date, time: normaliseTime(slashIso[4]), value: val };
}
```

Also add a matching date-only variant near the existing date-only patterns.

## Files affected
- `src/components/loadprofiles/BulkCsvDropzone.tsx` (raw_data construction)
- `src/components/loadprofiles/utils/normaliseRawData.ts` (safety net for YYYY/MM/DD)

## Note
The existing meter `PDB_36506616_SolarDB2.12` will need to be **re-imported** after this fix to get correct interval data. In the meantime, the summary profile fallback chart will display from `load_profile_weekday`/`load_profile_weekend`.
