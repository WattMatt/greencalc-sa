

# Plan: Normalise raw_data at Write Time, Simplify Read Path

## Summary

Standardise all `scada_imports.raw_data` to always contain `Array<{ date: string, time: string, value: number }>`. Parse once at import time, read directly without re-parsing.

## Step 1: Create normalisation utility

**New file: `src/components/loadprofiles/utils/normaliseRawData.ts`**

A single function that accepts any of the 3 current formats (`{date, time, value}`, `{timestamp, value}`, `{csvContent}`) and returns the canonical `{ date, time, value }[]` array. This is the existing `parseRawData` logic extracted for write-time use.

## Step 2: Update all write paths to normalise before DB insert/update

Six files write `raw_data` to `scada_imports`. Each will call `normaliseRawData()` before the `.insert()` or `.update()` call:

| File | Write location |
|------|---------------|
| `ScadaImport.tsx` | Line ~307 — insert after auto-process |
| `SitesTab.tsx` | Line ~1128 — update from CSV wizard |
| `MeterLibrary.tsx` | Lines ~525, ~998 — wizard and reimport |
| `BulkCsvDropzone.tsx` | Line ~440 — insert from bulk drop |
| `MeterReimportDialog.tsx` | Line ~98 — update on reimport |
| `OneClickBatchProcessor.tsx` | Line ~392 — update from batch |
| `ExcelAuditReimport.tsx` | Lines ~528, ~548 — update and insert |

## Step 3: Update edge function output

**`supabase/functions/process-scada-profile/index.ts`** (line ~598–606): Strip `timestamp`, `kva`, `meterId`, `originalLine` from raw data output. Only keep `{ date, time, value }`.

## Step 4: Simplify all read-side consumers

Remove inline `parseRawData` functions and the shared utility's heavy parsing logic. Replace with direct typecast:

| File | Change |
|------|--------|
| `useValidatedSiteData.ts` | Replace `parseRawData(entry.raw_data)` with direct cast |
| `useMonthlyData.ts` | Remove 60-line inline `parseRawData`, cast directly |
| `useSpecificDateData.ts` | Remove 60-line inline `parseRawData`, cast directly |
| `useDailyConsumption.ts` | Remove `parseDateTime` format-sniffing, cast directly |
| `parseRawData.ts` | Simplify to thin cast with backward-compat fallback |

## Step 5: One-time migration edge function

**New file: `supabase/functions/normalise-raw-data/index.ts`**

An edge function that:
1. Reads all `scada_imports` rows where `raw_data IS NOT NULL`
2. Runs each through the normalisation logic
3. Updates rows in-place with the standardised `{ date, time, value }[]` format
4. Returns a summary of how many rows were converted

This handles all existing legacy data. Can be triggered once manually via the backend function invocation.

## Files affected

| File | Action |
|------|--------|
| `src/components/loadprofiles/utils/normaliseRawData.ts` | **Create** |
| `supabase/functions/normalise-raw-data/index.ts` | **Create** |
| `src/components/loadprofiles/ScadaImport.tsx` | Edit |
| `src/components/loadprofiles/SitesTab.tsx` | Edit |
| `src/components/loadprofiles/MeterLibrary.tsx` | Edit |
| `src/components/loadprofiles/BulkCsvDropzone.tsx` | Edit |
| `src/components/loadprofiles/MeterReimportDialog.tsx` | Edit |
| `src/components/loadprofiles/OneClickBatchProcessor.tsx` | Edit |
| `src/components/loadprofiles/ExcelAuditReimport.tsx` | Edit |
| `supabase/functions/process-scada-profile/index.ts` | Edit |
| `src/components/projects/load-profile/utils/parseRawData.ts` | Simplify |
| `src/components/projects/load-profile/hooks/useValidatedSiteData.ts` | Simplify |
| `src/components/projects/load-profile/hooks/useMonthlyData.ts` | Simplify |
| `src/components/projects/load-profile/hooks/useSpecificDateData.ts` | Simplify |
| `src/components/loadprofiles/hooks/useDailyConsumption.ts` | Simplify |

