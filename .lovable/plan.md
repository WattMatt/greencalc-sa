

# Why Data Inspector Shows No Data for Kingswalk

## Root Cause

The Kingswalk SCADA data is stored in **legacy `csvContent` format** — `raw_data` is `[{ "csvContent": "sep=,\ndate,p14\n31/12/2024 23:30:00,3.64\n..." }]`.

The normaliser (`normaliseRawData.ts`) handles this format (Format 4), but its date parser on line 123 only accepts `YYYY-MM-DD`:

```typescript
if (date && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
```

Kingswalk's CSV has a **single `date` column with combined datetime** in `DD/MM/YYYY HH:MM:SS` format (e.g. `31/12/2024 23:30:00`). Since there's no separate `time` column and the date format doesn't match `YYYY-MM-DD`, **every row is silently skipped**, producing an empty array.

## Fix

Update the `csvContent` parser in `src/components/loadprofiles/utils/normaliseRawData.ts` (Format 4, lines 114-128) to handle:

1. **Combined datetime in a single column** — when there's no separate `time` column, split the cell value on space to extract date and time parts.
2. **DD/MM/YYYY format** — convert to `YYYY-MM-DD` before storing.
3. **Other SA date formats** — reuse the same SA-format regex already used in Format 3.

### Changes to `normaliseRawData.ts` (lines 114-128)

Replace the simple date matching with a parser that:
- Attempts ISO format first (`YYYY-MM-DD`)
- Falls back to SA format (`DD/MM/YYYY`)  
- Splits combined datetime strings (e.g. `31/12/2024 23:30:00`) into date + time components
- Uses the existing `timeCol` fallback logic but also extracts time from combined cells when `timeCol === -1`

No other files need changes — once the normaliser correctly parses the legacy csvContent, the `useValidatedSiteData` hook will produce valid `siteDataByDate` maps and the Data Inspector will display data.

