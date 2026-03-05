

## Correction: The Wizard Path *Does* Have Date/Time Data — But in a Combined Format

I need to correct my earlier statement. Looking at the actual code, here is exactly what happens:

### What the Wizard Path Stores (TenantManager.tsx, lines 771-775)

```typescript
const rawData = result.rows.map(row => ({
    timestamp: `${row[dateColIdx]} ${row[timeColIdx]}`.trim(),
    value: parseFloat(row[valueColIdx]) || 0
}));
```

This produces objects like:
```json
{ "timestamp": "01/02/2026 00:30:00", "value": 12.5 }
```

The date and time values **are present** — they are just concatenated into a single `timestamp` string. The wizard does **not** store separate `date` and `time` fields. It only stores `{ timestamp, value }`.

### What the Auto-Process Path Stores (ScadaImport.tsx, line 313)

It saves the edge function's `rawData` output directly, which has **4 fields per object**:
```json
{ "timestamp": "2026-02-01T00:30:00.000Z", "date": "2026-02-01", "time": "00:30:00", "value": 12.5 }
```

### Why parseRawData.ts Fails

The parser has three branches:

1. **`{ date, time, value }`** — checks `firstItem.date`. Wizard data lacks `date` field. **Skipped.**
2. **`{ timestamp, value }`** — checks `firstItem.timestamp`. **Matches.** But then splits by space expecting 4+ parts (`DD Mon YYYY HH:MM`). The wizard's timestamp `"01/02/2026 00:30:00"` only has 2 parts. **Returns empty.**
3. **`{ csvContent }`** — not applicable. **Skipped.**

Result: zero parsed points, blank chart.

### The Fix

**Single file: `src/components/projects/load-profile/utils/parseRawData.ts`**

Add two new timestamp format handlers inside the `{ timestamp, value }` branch (line 28-41), **before** the existing `parts.length >= 4` check:

1. **ISO-like**: `YYYY-MM-DD HH:MM:SS` → split on space, first part is date, second is time
2. **SA date format**: `DD/MM/YYYY HH:MM:SS` → swap day/month/year to `YYYY-MM-DD`, extract time

```typescript
// Try "YYYY-MM-DD HH:MM:SS" format
const isoMatch = ts.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)$/);
if (isoMatch) {
  return { date: isoMatch[1], time: normaliseTime(isoMatch[2]), ... };
}

// Try "DD/MM/YYYY HH:MM:SS" format
const saMatch = ts.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)$/);
if (saMatch) {
  const date = `${saMatch[3]}-${saMatch[2].padStart(2,'0')}-${saMatch[1].padStart(2,'0')}`;
  return { date, time: normaliseTime(saMatch[4]), ... };
}
```

No other files need changing. This fixes both existing stored data and future wizard uploads.

