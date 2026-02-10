

# Multi-CSV Upload with Summation for Actual Generation and Building Load

## Overview

Update the CSV upload on both the Actual Generation and Building Load cards to support **multiple file selection**. When multiple files are uploaded, their kWh values are **summed per month** before saving. Each upload **adds to** the existing stored value (additive mode), with a "Reset" button to clear accumulated data.

No combined CSV detection is needed -- each card only ever receives its own data type.

## Changes

### New File: `src/components/projects/generation/csvUtils.ts`

A shared utility for parsing one or more CSV files and summing values per month:

- Accepts a `FileList` and a regex pattern for identifying the kWh column
- Reads all files, identifies `month` and value columns in each
- Returns a `Map<number, number>` of month-to-total-kWh across all files

### Modify: `ActualGenerationCard.tsx`

- Change file input to accept `multiple` files
- Replace inline CSV parsing with the shared `csvUtils` helper
- Make uploads **additive**: fetch the existing `actual_kwh` for each month, then upsert with `existingValue + newSum`
- Update `source` field to indicate CSV count (e.g., `"csv:3"`)
- Add a "Reset" button that sets `actual_kwh` to `null` for the selected month
- Toast message: "Added X kWh from Y file(s)"

### Modify: `BuildingLoadCard.tsx`

- Same changes as above, but targeting `building_load_kwh`
- File input accepts `multiple`
- Additive upsert logic
- Reset button to clear building load for the selected month

### No changes to `GenerationTab.tsx`

The combined CSV concept is removed. Each card handles its own uploads independently.

## Technical Details

### Shared CSV Parser (`csvUtils.ts`)

```
async function parseCSVFiles(
  files: FileList,
  valueColumnPattern: RegExp
): Promise<Map<number, number>>
```

- Iterates each file, splits into lines, finds header columns
- Month column: matches `/month/i`
- Value column: matches the provided pattern (e.g., `/kwh|energy|generation|actual/i` for generation, `/kwh|energy|load|consumption|building/i` for load)
- For each valid row, accumulates into a running sum per month across all files
- Returns the summed map

### Additive Upsert Flow

For each month in the parsed results:

1. Fetch the current record for that `(project_id, month, year)`
2. Calculate `newTotal = (existing?.actual_kwh ?? 0) + parsedSum`
3. Upsert with the new total

### Reset Button

Each card gets a small "Reset" link that:
- Upserts the field to `null` for the current month/year
- Clears local state
- Triggers `onDataChanged` to refresh

### Source Tracking

The `source` field on `generation_records` will be updated to reflect the number of CSV files contributing to the total (e.g., `"csv:2"` or `"manual"` for hand-entered values).

