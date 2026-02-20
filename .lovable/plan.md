

## Fix: Honour User's Column Selections When Saving and Viewing Meter Data

### Problem

When you select specific columns in the CSV import wizard, two things go wrong:

1. **Saving ignores your selections**: The re-import dialog (`MeterReimportDialog`) discards the wizard configuration and re-detects columns using hardcoded header patterns (looking for "date", "kwh", etc.). If your CSV has non-standard headers, it picks the wrong columns.

2. **Viewing ignores your selections**: The daily and monthly consumption hooks (`useDailyConsumption`, `useMonthlyConsumption`) re-parse embedded CSV content from scratch using their own hardcoded header detection (including the incorrectly added "from" and "periods" patterns), completely bypassing your wizard selections.

### Solution

#### 1. Fix `MeterReimportDialog.tsx` - Use wizard config for raw_data construction

Replace the hardcoded column detection (lines 76-84) with the explicit indices from the wizard config:

```typescript
// BEFORE (broken - ignores user selections):
const dateIdx = headers.findIndex(h => h.includes('date') || h === 'rdate');
const valueIdx = headers.findIndex(h => h.includes('kwh') || ...);

// AFTER (uses wizard config):
const dateIdx = config.dateColumnIndex ?? headers.findIndex(h => h.includes('date'));
const timeIdx = config.timeColumnIndex ?? headers.findIndex(h => h.includes('time'));
const valueIdx = config.valueColumnIndex ?? headers.findIndex(h => h.includes('kwh'));
```

#### 2. Fix `BulkCsvDropzone.tsx` - Store pre-processed data points, not raw CSV

When the bulk import wizard processes files, instead of storing `[{ csvContent: rawCsv }]`, store the already-parsed data points as `[{ timestamp, value }]` arrays. This means the user's column selections are baked into the stored data and never need to be re-detected.

#### 3. Clean up `useDailyConsumption.ts` and `useMonthlyConsumption.ts`

- Remove the `"from"` and `"periods"` patterns from header detection (these were incorrectly added).
- Keep the `parseEmbeddedCSV` function as a fallback for legacy data, but ensure new imports store pre-processed data that bypasses re-detection entirely.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/loadprofiles/MeterReimportDialog.tsx` | Use `config.dateColumnIndex` / `config.valueColumnIndex` / `config.timeColumnIndex` for raw_data construction |
| `src/components/loadprofiles/BulkCsvDropzone.tsx` | Store processed `[{timestamp, value}]` instead of `[{csvContent}]` after wizard column selection |
| `src/components/loadprofiles/hooks/useDailyConsumption.ts` | Remove "from" and "periods" from header detection patterns |
| `src/components/loadprofiles/hooks/useMonthlyConsumption.ts` | Remove "from" and "periods" from header detection patterns (if present) |

### Impact

- Existing meters with `csvContent` in `raw_data` will continue to work via the legacy `parseEmbeddedCSV` fallback.
- New imports and re-imports will store clean `{timestamp, value}` arrays that reflect your exact column choices.
- The "from" column will no longer hijack the date detection.

