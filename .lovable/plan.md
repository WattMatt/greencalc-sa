

# Fix: `useMonthlyConsumption` to support normalised data format

## Problem
The `useMonthlyConsumption` hook (line 167) only recognises `{ timestamp, value }` objects. The system's canonical normalised format is `{ date, time, value }` — used by **all** import paths (new uploads included). This means no meter preview will ever render correctly until this hook is updated.

## Change

### `src/components/loadprofiles/hooks/useMonthlyConsumption.ts` (~lines 162-179)

Add a branch for the normalised `{ date, time, value }` format **before** the legacy `timestamp` check:

```typescript
if (Array.isArray(rawDataAny)) {
  const firstItem = rawDataAny[0] as Record<string, unknown> | undefined;

  // Embedded CSV
  if (rawDataAny.length === 1 && firstItem?.csvContent && typeof firstItem.csvContent === 'string') {
    points = parseEmbeddedCSV(firstItem.csvContent);
  }
  // Normalised format: { date, time, value }
  else if (rawDataAny.length > 0 && firstItem?.date && firstItem?.time && 'value' in firstItem) {
    points = rawDataAny.map((item: unknown) => {
      const r = item as Record<string, unknown>;
      return {
        date: String(r.date),
        time: String(r.time),
        value: typeof r.value === 'number' ? r.value : 0,
      };
    });
  }
  // Legacy: { timestamp, value }
  else if (rawDataAny.length > 0 && firstItem?.timestamp) {
    points = rawDataAny.map((item: unknown) => {
      const r = item as Record<string, unknown>;
      return {
        timestamp: r.timestamp as string | undefined,
        date: r.date as string | undefined,
        time: r.time as string | undefined,
        value: typeof r.value === 'number' ? r.value : 0,
      };
    });
  }
}
```

No other files need changes. The downstream `parseDateTime` function already handles `date` + `time` fields correctly.

### After deploying
- **New uploads**: Will render previews immediately.
- **Existing broken meters** (`PDB_36506619_KFCDT_22m2`, `PDB_36506609_TigerWheel&Tyre_464m2`): Click **Re-process (⚙)** in the Meter Library to repopulate `raw_data`, then previews will work.

