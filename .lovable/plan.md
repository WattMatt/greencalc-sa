

# Plan: Always create new meters on bulk CSV upload

## Summary
Remove the fuzzy matching logic from `BulkCsvDropzone.tsx` so every uploaded CSV always creates a new meter in the meter library. No more matched/unmatched distinction.

## Changes to `src/components/loadprofiles/BulkCsvDropzone.tsx`

### 1. Remove matching infrastructure
- Remove the `meters` query (lines 233-249) — no longer needed
- Remove `matchFilesToMeters` import and the `matchFilesToMeters` call in `handleFiles` (line 296)
- Remove the `createNewForUnmatched` state variable
- Remove the `MatchResult` / `MeterInfo` types from imports
- Simplify `FileMatchInfo` — drop the `match` field

### 2. Simplify `handleFiles` (lines 270-310)
- Read file contents as before
- Set every file's status to `'pending'` with no match object
- Remove the matched/unmatched toast — just say `"X files loaded"`

### 3. Simplify `processFile` (lines 330-516)
- Remove lines 435-466 (the `match?.meterId` check, the `createNewForUnmatched` guard, and the "skipped" return)
- **Always** create a new meter via `supabase.from("scada_imports").insert(...)` using the auto-detected `config.meterName` or sanitised filename
- Then update the new meter with the processed profile data and upload CSV to storage (same as current flow)

### 4. Simplify UI
- **Drop zone text**: Change from "Files will be automatically matched to existing meters" to "Each file will create a new meter"
- **Stats bar**: Remove matched/unmatched counts — just show total files and results
- **Remove** the "Create new meters for unmatched files" checkbox (lines 655-664)
- **File list rows**: Remove the match/confidence badge display — just show filename and status
- Remove `getConfidenceBadge` helper function

### 5. Clean up imports
- Remove unused imports: `matchFilesToMeters`, `MatchResult`, `MeterInfo`, `normalizeName`, `Link2`, `Link2Off`, `Checkbox`

### No other files change
- `fuzzyMatcher.ts` stays (used elsewhere)
- No database changes

