

# Fix: Council Meter Still Showing in Down Time and Performance Tabs

## Root Cause

The guarantee source labels (`Tie-In 1`, `Tie-In 2`, `Tie-In 3`) don't match the reading source labels (`31198 - Parkdene Solar DB2.1`, `31193 - Parkdene Solar DB3.1`, `31190 - Parkdene Solar Checkers`). This triggers the fallback distribution logic which assigns a non-zero guarantee equally to ALL reading sources -- including the council meter. The post-filter then fails to remove it because it now has a positive guarantee.

Meanwhile, the guarantee table itself clearly marks the council meter with `guaranteed_kwh: 0`.

## Solution

Before the fallback distribution, pre-filter `distinctReadingSources` using the guarantee records that have `guaranteed_kwh > 0`. Sources that exist in the guarantee table with `guaranteed_kwh = 0` are explicitly non-solar and should be excluded.

## Technical Details

**File: `src/components/projects/generation/PerformanceSummaryTable.tsx`**

**Change the filtering logic (lines 168-200):**

1. Before attempting match/fallback, first remove any sources that are explicitly listed in the guarantee table with `guaranteed_kwh <= 0` (like the council meter).
2. Then proceed with the existing match and fallback logic on the remaining (solar-only) sources.

```typescript
// Step 1: Remove sources explicitly marked with zero guarantee
if (sourceGuarantees && sourceGuarantees.length > 0) {
  const zeroGuaranteeSources = new Set(
    sourceGuarantees
      .filter(sg => sg.guaranteed_kwh <= 0)
      .map(sg => sg.source_label)
  );
  for (const src of distinctReadingSources) {
    if (zeroGuaranteeSources.has(src)) {
      distinctReadingSources.delete(src);
    }
  }
}

// Step 2: Build guarantee map (existing logic, now operating on filtered sources)
// ... existing hasMatch / fallback logic ...

// Step 3: Post-filter (existing) removes any remaining unmatched sources
```

This way the council meter is removed early because it is explicitly listed with `guaranteed_kwh: 0`, and the fallback distribution only applies to actual solar sources.

