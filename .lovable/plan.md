
# Fix Duplicate VAT-Inclusive Rate Extraction

## Problem
The AI extracts **both VAT-exclusive and VAT-inclusive** values from the Eskom PDF tables, producing 12 energy rates per tariff instead of 6. For example, "Miniflex > 900km >= 66kV" shows:
- peak (high): 637.48 c/kWh (excl.) AND 733.10 c/kWh (incl. = 637.48 x 1.15)

This happens because the Eskom PDF tables present two columns per rate (excl. VAT / incl. VAT) and the AI extracts both.

## Solution: Two-Layer Fix

### 1. Strengthen the extraction prompt (primary fix)
**File:** `supabase/functions/process-tariff-file/index.ts` (~line 868)

Add explicit instruction to the Eskom extraction prompt:
```
CRITICAL: The PDF shows TWO values per cell — VAT-exclusive and VAT-inclusive (15% VAT).
ONLY extract the VAT-EXCLUSIVE value (the LOWER of the two numbers).
NEVER include VAT-inclusive values. Each tariff should have exactly 6 energy rates
(3 TOU periods x 2 seasons), NOT 12.
```

### 2. Add server-side deduplication (safety net)
**File:** `supabase/functions/process-tariff-file/index.ts` (~line 1134)

After building the energy rate rows from `tariff.rates`, add deduplication logic:
- Group energy rates by `season + tou` composite key
- If duplicates exist for the same season/tou combo, keep only the **lower** value (VAT-exclusive)
- Log when duplicates are removed so we can track extraction quality

```typescript
// Deduplicate energy rates: keep lowest per season+tou (removes VAT-inclusive duplicates)
const energyRates = rateRows.filter(r => r.charge === "energy");
const otherRates = rateRows.filter(r => r.charge !== "energy");
const seen = new Map();
for (const rate of energyRates) {
  const key = `${rate.season}|${rate.tou}|${rate.block_number ?? ""}`;
  const existing = seen.get(key);
  if (!existing || rate.amount < existing.amount) {
    seen.set(key, rate);
  }
}
const dedupedRates = [...otherRates, ...seen.values()];
// Use dedupedRates for insert
```

### 3. Clean up existing duplicates
Run a SQL cleanup to remove the VAT-inclusive duplicates from the 16 already-extracted Miniflex tariffs, keeping only the lower-valued rate per season/tou combination.

### Deployment
Redeploy the `process-tariff-file` edge function.

## Impact
- Existing 16 Miniflex tariffs will be cleaned (12 energy rates reduced to 6 each)
- Future Eskom extractions will produce correct 6-rate sets
- No schema or frontend changes needed
