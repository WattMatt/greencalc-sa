

# Fix: Load Profile plot fails when PDB_35775423_SolarDB3.1 is included

## Root Cause

`useValidatedSiteData.ts` line 102 casts `raw_data` directly as `{date, time, value}[]`. The `PDB_35775423_SolarDB3.1` meter has legacy `{timestamp, value}` format, so every point fails the `!point.date || !point.time` check at line 107 and is skipped. Result: zero validated dates, no chart.

## Fix (single file, two changes)

**File:** `src/components/projects/load-profile/hooks/useValidatedSiteData.ts`

**Change 1 — Add import (line 3):**
```typescript
import { normaliseRawData } from "@/components/loadprofiles/utils/normaliseRawData";
```

**Change 2 — Replace line 102 with normalisation fallback:**

Replace:
```typescript
const points = Array.isArray(entry.raw_data) ? entry.raw_data as { date?: string; time?: string; value?: number }[] : [];
```

With:
```typescript
let points: { date?: string; time?: string; value?: number }[] = [];
if (Array.isArray(entry.raw_data) && entry.raw_data.length > 0) {
  const first = (entry.raw_data as Record<string, unknown>[])[0];
  if (first.date && first.time) {
    points = entry.raw_data as { date?: string; time?: string; value?: number }[];
  } else {
    points = normaliseRawData(entry.raw_data);
  }
}
```

This is the identical fallback pattern already used in `useDailyConsumption` and `useMonthlyData`. No other files need changes.

