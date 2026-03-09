

# Fix: Time Column Detection Bug in Bulk CSV Import

## Root Cause

In `BulkCsvDropzone.tsx`, the `detectColumns` function has a logic bug on line 141:

```typescript
if (dateCol === -1 && timePatterns.some(p => lower === p || lower.startsWith(p))) {
```

The time column detection only runs when `dateCol === -1`. For PnP SCADA files with separate `rdate` and `rtime` columns, `rdate` is found first (setting `dateCol`), so when `rtime` is encountered, the condition `dateCol === -1` is false and the time column is **never detected**.

This causes the normaliser to receive timestamps like `"2026-02-01"` (date only, no time), which are parsed with `time: "00:00:00"` for every single row. The 1344 data points all end up with the same time, making the daily chart useless.

The tenant import path works because it stores the legacy `{ timestamp: "2026-02-01 00:30:00", value: 0 }` format where the combined datetime is preserved.

## Fix

### File: `src/components/loadprofiles/BulkCsvDropzone.tsx`

**Line 141**: Remove the `dateCol === -1` guard from the time column detection. The time check should always run independently of whether a date column was found. Change:

```typescript
if (dateCol === -1 && timePatterns.some(p => lower === p || lower.startsWith(p))) {
```

to:

```typescript
if (timeCol === -1 && timePatterns.some(p => lower === p || lower.startsWith(p))) {
```

This ensures that when `rtime` is encountered after `rdate`, it's properly detected as the time column. The existing inner logic (lines 142-155) already handles the case where a "time" header actually contains datetime values (promoting it to `dateCol` instead).

### Secondary fix — same file, line 395

The regex `/[^\\d.-]/g` has a double-escaped backslash, meaning it matches literal `\d` characters instead of digits. Change:

```typescript
value: parseFloat(row[valueCol]?.replace(/[^\\d.-]/g, '') || '0') || 0
```

to:

```typescript
value: parseFloat(row[valueCol]?.replace(/[^\d.-]/g, '') || '0') || 0
```

## Files affected
- `src/components/loadprofiles/BulkCsvDropzone.tsx` (2 line changes)

## Note
Existing meters imported with corrupted `raw_data` (all times `00:00:00`) will still show the summary profile fallback chart. Users can re-import the CSV to get correct interval data.

