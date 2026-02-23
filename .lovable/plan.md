

## Fix Inline Loading and Envelope Day-of-Week Filter

### Problem 1: Full-Page Loading Blocker
The `isLoadingRawData` check on line 211 of `index.tsx` returns a full-page skeleton, preventing the user from seeing any controls or layout while data loads.

**Fix (index.tsx):**
- Remove the early-return skeleton block (lines 211-223)
- Pass `isLoadingRawData` down to `LoadChart` and `EnvelopeChart` as a prop
- Each chart renders a small spinning loader (Lucide `Loader2` with `animate-spin`) centred in its chart area when loading, instead of blocking the whole page
- The header, settings, and other controls remain visible and interactive

### Problem 2: Envelope Average Does Not Match Load Profile
The Load Profile filters `siteDataByDate` by `selectedDays` (day-of-week filter, e.g. only Wednesdays). The Envelope uses ALL dates from `siteDataByDate` without any day-of-week filter. This means the envelope "avg" line represents the average across all 7 days, while the load profile shows Wednesday only -- they will never match.

**Fix (useEnvelopeData.ts):**
- Accept `selectedDays: Set<number>` as a new prop
- When filtering entries from `siteDataByDate`, also check the JS day-of-week matches the selected days (same logic as `useLoadProfileData`)
- This ensures the envelope min/max/avg is computed from the same subset of dates as the load profile

**Fix (index.tsx):**
- Pass `selectedDays` to the `useEnvelopeData` hook

### Technical Details

**File: `src/components/projects/load-profile/index.tsx`**
- Remove early return block for `isLoadingRawData` (lines 211-223)
- Pass `isLoadingRawData` to `LoadChart` and the envelope section
- Pass `selectedDays` to `useEnvelopeData`
- Wrap each chart in a conditional: if loading, show a centred `Loader2` spinner; otherwise show the chart

**File: `src/components/projects/load-profile/hooks/useEnvelopeData.ts`**
- Add `selectedDays: Set<number>` to the props interface
- In the `useMemo`, after the year filter, also filter by day-of-week:
```
const jsDate = new Date(year, month - 1, day);
if (!selectedDays.has(jsDate.getDay())) return;
```

**File: `src/components/projects/load-profile/charts/LoadChart.tsx`**
- Add optional `isLoading?: boolean` prop
- When `isLoading` is true, render a `Loader2` spinner centred in the 200px chart area instead of the Recharts chart

**File: `src/components/projects/load-profile/charts/EnvelopeChart.tsx`**
- Add optional `isLoading?: boolean` prop
- Same spinner treatment when loading

### What Stays the Same
- All calculation logic in `useLoadProfileData` remains untouched
- The envelope computation logic (min/max/avg sweep) stays the same, just with a tighter date filter
- Export handlers, PV, battery, grid flow charts are unaffected
- Year range selectors on the envelope still work as before

