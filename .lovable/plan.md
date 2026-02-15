
## Fix: Sort Source Columns Consistently in Down Time and Performance Tabs

### Problem

The source columns (e.g., Tie-In 1, Tie-In 2, Tie-In 3) appear in arbitrary insertion order because they come from a `Set` iterated in the order readings are encountered. The screenshot shows them as Tie-In 2, Tie-In 1, Tie-In 3 instead of the expected 1, 2, 3 order.

### Fix

**File: `src/components/projects/generation/PerformanceSummaryTable.tsx`**

**Line 340** -- Sort `distinctReadingSources` by their display name before returning:

Replace:
```typescript
distinctSources: Array.from(distinctReadingSources)
```

With:
```typescript
distinctSources: Array.from(distinctReadingSources).sort((a, b) => {
  const nameA = displayNameMap.get(a) || a;
  const nameB = displayNameMap.get(b) || b;
  return nameA.localeCompare(nameB, undefined, { numeric: true });
})
```

Using `{ numeric: true }` in `localeCompare` ensures "Tie-In 2" sorts before "Tie-In 10" (natural/numeric sorting). This single change fixes the column order for both the Down Time and Performance tabs since they both iterate `distinctSources`.
