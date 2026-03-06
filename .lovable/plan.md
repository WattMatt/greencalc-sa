

# Fix: Legacy raw_data format not handled in Tenant tab hooks

## Root Cause

The meter `PDB_35775423_SolarDB3.1` has `raw_data` in legacy `{timestamp, value}` format. The normalisation migration edge function was created but never executed, so existing data hasn't been converted.

During the normalisation refactor, two hooks were simplified to use a `castRawData()` function that only accepts the new `{date, time, value}` format — if the data doesn't match, it returns an empty array. This causes "No monthly data available" and "No daily data available" in the Tenants tab.

**Affected hooks with broken `castRawData`:**
- `src/components/loadprofiles/hooks/useDailyConsumption.ts` (line 36-41)
- `src/components/projects/load-profile/hooks/useMonthlyData.ts` (line 28-33)

**Working utility with backward-compat fallback:**
- `src/components/projects/load-profile/utils/parseRawData.ts` — already handles both formats correctly via `normaliseRawData()` fallback

## Fix

### Step 1: Update `castRawData` in both hooks to fall back to `normaliseRawData`

Replace the simple cast with the same fallback pattern used in `parseRawData.ts`:

```typescript
import { normaliseRawData } from "@/components/loadprofiles/utils/normaliseRawData";

function castRawData(rawData: unknown): NormalisedPoint[] {
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return [];
  const first = rawData[0];
  if (first.date && first.time && "value" in first) return rawData as NormalisedPoint[];
  // Fallback: normalise legacy formats
  return normaliseRawData(rawData);
}
```

### Step 2 (optional): Run the normalise-raw-data edge function

This converts all existing legacy data in-place so the fallback path is no longer needed. Can be triggered after the code fix.

## Files changed

| File | Change |
|------|--------|
| `src/components/loadprofiles/hooks/useDailyConsumption.ts` | Add `normaliseRawData` import, update `castRawData` with fallback |
| `src/components/projects/load-profile/hooks/useMonthlyData.ts` | Add `normaliseRawData` import, update `castRawData` with fallback |

