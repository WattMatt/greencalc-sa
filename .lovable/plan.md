

## Fix: Envelope Chart Not Respecting Tenant Inclusion Filter

### Problem
The Envelope Chart (Min/Max/Average) includes data from **all** tenants, ignoring the `include_in_load_profile` flag. This was fixed for the main Load Profile chart but never applied to the envelope hook. The result is a massively inflated band because:
- Excluded tenants contribute data on some dates but not others
- Dates with partial tenant coverage produce artificially low sums (the near-zero min line)
- Dates with full coverage show the real total (the ~1.9k max line)

### Solution
Apply the same `include_in_load_profile` filter to `useEnvelopeData` that was added to `useLoadProfileData`.

### Technical Details

**File: `src/components/projects/load-profile/hooks/useEnvelopeData.ts`**

Add a single filter at the top of the hook, then use the filtered list everywhere:

```typescript
const includedTenants = tenants.filter(t => t.include_in_load_profile !== false);
```

Replace all references to `tenants` in the two `useMemo` blocks (lines 26-40 for `availableYears` and lines 48-133 for `envelopeData`) with `includedTenants`.

This ensures the envelope chart only shows the min/max/avg spread for the same set of tenants that appear in the main load profile, producing a meaningful and consistent envelope.

### Result
- The envelope band will tighten significantly, showing realistic variation across included tenants only
- Min, max, and average lines will be consistent with the main load profile chart
- Excluded tenants (e.g., virtual check meters) will no longer distort the statistics
