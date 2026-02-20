

## Fix: Make Schematic Checkboxes Read-Only (Driven by Tenants Tab Only)

### Problem
The schematic view and tenants view each independently toggle `include_in_load_profile`, causing confusion and sync issues. They need to show the same state, controlled from one place.

### Solution
Remove the click handler on the schematic canvas checkboxes so they become **display-only**. The green/grey indicators will still render correctly based on the tenant data, but clicking them will do nothing. Users toggle the "Include" status exclusively from the Tenants table.

### Technical Details

**File: `src/components/schematic/SchematicEditor.tsx`**

1. **Remove the `mouse:down` handler** (lines 760-796) that currently intercepts clicks on profile checkbox overlays and updates the database. This entire `useEffect` block will be deleted.

2. **Remove the `useQueryClient` import and usage** (no longer needed since nothing is being mutated from the schematic).

3. **Keep everything else unchanged**:
   - The `fetchTenantProfileMap()` function still fetches tenant inclusion status
   - The `isActive` refetch still refreshes data when switching to the Schematics tab
   - The visual rendering of green ticks / grey circles on meter cards remains intact (read-only display)

### Result
- Schematic view: checkboxes are visual indicators only (read-only)
- Tenants table: the sole place to toggle "Include in Load Profile"
- Switching to the Schematics tab refetches the latest state, so the indicators always reflect what was set in the Tenants table
