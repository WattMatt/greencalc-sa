

# Fix CSV Upload Summation and Data Persistence

## Problem Analysis

After investigating the database and code, I found two critical bugs:

### Bug 1: Timestamp Format Mismatch Prevents Summation

When a second CSV is uploaded, the code fetches existing readings to add new values on top. However, the database returns timestamps in the format `2026-01-01 10:00:00+00`, while the CSV produces timestamps like `2026-01-01T10:00:00`. The Map lookup `existingMap.get(r.timestamp)` always returns `undefined` because the formats don't match, so instead of summing, every upsert replaces the previous value with just the new CSV's value.

**Evidence**: The database has 1,488 rows but only 1 row has a non-null `actual_kwh` value. The rest were nullified by the overwrite.

### Bug 2: Cross-Column Overwrite

When `ActualGenerationCard` upserts a reading, it only includes `actual_kwh` in the payload -- it does NOT include `building_load_kwh`. Supabase upsert treats missing columns as null, so uploading solar data wipes out any existing building load data at the same timestamp, and vice versa.

### Bug 3 (Confirmed Fixed): Row Filter

The "Rows 1 to 1488" controls in the CSV dialog already only affect the preview display. The `handleParse` function correctly iterates ALL data rows (`csvLines.slice(dataStartRow)`). No change needed here.

---

## Implementation Plan

### Step 1: Fix Timestamp Normalization in Both Cards

In `ActualGenerationCard.tsx` and `BuildingLoadCard.tsx`, normalize the timestamp keys when building the `existingMap` so that database format (`2026-01-01 10:00:00+00`) and CSV format (`2026-01-01T10:00:00`) resolve to the same key.

The approach: Convert both timestamps to a canonical ISO string using `new Date(ts).toISOString()` before using them as Map keys.

### Step 2: Fix Cross-Column Overwrite

When upserting readings from ActualGenerationCard, also fetch and preserve the existing `building_load_kwh` value (and vice versa for BuildingLoadCard). This ensures one upload channel does not erase data from the other.

The upsert payload will be changed from:
```
{ project_id, timestamp, actual_kwh: summedValue, source }
```
to:
```
{ project_id, timestamp, actual_kwh: summedValue, building_load_kwh: existingBuildingLoad, source }
```

### Step 3: Verify Query Invalidation

Confirm that `onDataChanged()` properly invalidates the `generation-readings` query key so the chart refreshes after upload.

---

## Files to Modify

1. **`src/components/projects/generation/ActualGenerationCard.tsx`** -- Fix timestamp normalization in existingMap lookup; preserve `building_load_kwh` during upsert.
2. **`src/components/projects/generation/BuildingLoadCard.tsx`** -- Fix timestamp normalization in existingMap lookup; preserve `actual_kwh` during upsert.

## Technical Details

The key fix in both files (within the `saveCSVTotals` function, raw readings section):

```typescript
// Normalize timestamps for consistent Map keys
const normalizeTs = (ts: string) => new Date(ts).toISOString();

// Fetch existing readings - now also fetch the OTHER column to preserve it
const { data: existingReadings } = await supabase
  .from("generation_readings")
  .select("timestamp, actual_kwh, building_load_kwh")  // fetch both columns
  .eq("project_id", projectId)
  .in("timestamp", timestamps);

const existingMap = new Map(
  (existingReadings ?? []).map((r) => [normalizeTs(r.timestamp), r])
);

const upsertBatch = batch.map((r) => {
  const existing = existingMap.get(normalizeTs(r.timestamp));
  return {
    project_id: projectId,
    timestamp: r.timestamp,
    actual_kwh: (existing?.actual_kwh ?? 0) + r.kwh,        // sum new + existing
    building_load_kwh: existing?.building_load_kwh ?? null,  // preserve other column
    source: "csv",
  };
});
```

The same pattern applies in reverse for BuildingLoadCard (sum `building_load_kwh`, preserve `actual_kwh`).

