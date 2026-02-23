

## Fix: Deferred Envelope Chart Loading

### Problem
The envelope calculation processes ~28,000+ raw data points per tenant synchronously in a `useMemo`, blocking the main thread. The load profile chart (which is much lighter) can't render until the envelope finishes, making the entire page freeze.

### Why the Load Profile Is Fast
The load profile hook calls `computeHourlyFromRawData()` once per tenant, producing 24 values. The envelope iterates every single raw data point, groups them into a Map of (date x hour), then sweeps all dates per hour for min/max/avg -- orders of magnitude more work, all synchronous.

### Solution: Deferred Async Computation

Move the envelope calculation off the main thread by deferring it with `useState` + `useEffect` + `setTimeout(0)` (or `requestIdleCallback`). This lets the load profile chart render immediately while the envelope computes in the background with a loading spinner.

### Technical Details

**File: `src/components/projects/load-profile/hooks/useEnvelopeData.ts`**

1. Replace the `useMemo` for `envelopeData` with a `useState` + `useEffect` pattern:
   - State: `envelopeData` (starts empty) + `isComputing` (loading flag)
   - Effect: When inputs change, set `isComputing = true`, then use `setTimeout(fn, 0)` to defer the heavy computation to the next event loop tick
   - The computation logic itself stays the same, just moves into the deferred callback
   - On completion, set the result into state and `isComputing = false`

2. Return `isComputing` from the hook so the UI can show a loading indicator.

**File: `src/components/projects/load-profile/index.tsx`**

3. Consume the new `isComputing` flag from `useEnvelopeData`.
4. When `isComputing` is true, show a small loading skeleton/spinner in place of the `EnvelopeChart`.
5. When false, render the chart as before.

**File: `src/components/projects/load-profile/charts/EnvelopeChart.tsx`**

No changes needed to the chart itself -- it already handles empty data gracefully.

### Result
- The Load Profile chart renders immediately when the tab opens
- The Envelope chart shows a "Computing..." indicator briefly, then appears once done
- The page remains fully interactive throughout
- No data or accuracy changes -- same calculation, just deferred

