

## Make Meter Search Case-Insensitive with Sequential Matching

### Problem

The "Search profiles..." popover in the Tenant Profile Matcher component uses the default `cmdk` filter, which performs fuzzy matching (characters can appear out of order). You need it to:

1. Be case-insensitive (typing "acker" matches "ACKERMANS")
2. Require characters to appear in the correct order (substring match, not fuzzy)

The `TenantManager.tsx` already has this fix applied to its two profile popovers, but `TenantProfileMatcher.tsx` does not.

### Changes

**File: `src/components/projects/TenantProfileMatcher.tsx`**

Add a custom `filter` prop to the `Command` component (same pattern already used in `TenantManager.tsx`):

```tsx
// Before
<Command>

// After
<Command filter={(value, search) => {
  return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
}}>
```

This is a one-line change in a single file.
