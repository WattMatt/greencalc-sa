
# Fix: Council Demand Upload Creating Duplicate Timestamp Rows

## Problem
When uploading council demand CSV data after solar data, the timestamps end up duplicated in the database. Each solar reading gets its own row (with `actual_kwh` set, `building_load_kwh` null), and each council reading creates a **separate** row (with `building_load_kwh` set, `actual_kwh` null) at the same timestamp. This causes the chart to render double the expected data points, visually shifting everything.

## Root Cause
In both `ActualGenerationCard.tsx` and `BuildingLoadCard.tsx`, the `normalizeTs` function uses `new Date(ts).toISOString()` to create lookup keys for existing readings. This converts timestamps to UTC, but the stored timestamps may have been interpreted differently by the database (which uses `timestamp with time zone`). The mismatch means the lookup fails to find existing rows, so the upsert creates new ones instead of merging.

## Solution
Replace the `normalizeTs` function in both upload cards with a consistent normalization that strips timezone info and matches on the raw date/time string, ensuring lookups always find existing rows regardless of timezone interpretation differences.

## Changes

**File: `src/components/projects/generation/ActualGenerationCard.tsx`**
- Replace `normalizeTs` (line ~125) to normalize timestamps by stripping timezone suffixes and trailing milliseconds, producing a consistent `YYYY-MM-DDTHH:MM:SS` key
- This ensures the lookup map keys match what the database returns

**File: `src/components/projects/generation/BuildingLoadCard.tsx`**  
- Same change to `normalizeTs` (line ~119)

### Updated normalizeTs logic:
```text
const normalizeTs = (ts: string): string => {
  // Strip timezone suffix (+00, Z, +HH:MM) and milliseconds
  // to get a consistent YYYY-MM-DDTHH:MM:SS key
  return ts
    .replace(/\.\d+/, '')           // remove milliseconds
    .replace(/Z$/, '')              // remove Z
    .replace(/[+-]\d{2}(:\d{2})?$/, '') // remove offset
    .replace(' ', 'T');             // normalize space to T
};
```

This ensures that whether the timestamp comes from the CSV (`2026-01-01T00:30:00`) or from the database (`2026-01-01 00:30:00+00`), the normalized key will be the same: `2026-01-01T00:30:00`.

## Impact
- Fixes the duplicate-row issue so solar and council data properly merge into the same row
- Existing data with duplicates would need a re-upload (reset + re-import) to fix
- No chart code changes needed -- once the data is stored correctly, the chart renders correctly
