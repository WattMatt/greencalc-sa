

## Remove Unnecessary Deferred Computation from Envelope

### Problem
The Envelope chart uses a `useState` + `useEffect` + `setTimeout(0)` pattern that causes a visible loading delay, even though it now consumes the same pre-computed `siteDataByDate` as the Load Profile. The heavy parsing already happened in `useValidatedSiteData`.

### Fix
**File: `src/components/projects/load-profile/hooks/useEnvelopeData.ts`**

Replace the deferred `useState`/`useEffect`/`setTimeout` pattern with a simple `useMemo`, matching what `useLoadProfileData` does:

- Remove `useState` for `envelopeData` and `isComputing`
- Remove `useCallback` for `computeEnvelope`
- Remove the `useEffect` with `setTimeout`
- Wrap the computation in `useMemo` instead
- Return `isComputing: false` (or remove it entirely if the UI can handle it)

The min/max/avg sweep across ~365 pre-summed arrays of 24 values is trivial -- no deferral needed.

### What stays the same
- The computation logic itself (year filtering, min/max/avg sweep, unit conversion)
- The year selector state (`yearFrom`, `yearTo`)
- All props and return shape (except `isComputing` becomes always `false`)

