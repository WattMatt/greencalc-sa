

## Fix: Restore Bidirectional Checkbox Toggle with Proper Sync

### Problem
The previous edit removed the schematic checkbox click handler but left the checkboxes looking interactive. The user wants to toggle from **both** the Tenants table and the Schematic view, with changes propagating instantly between them.

### Solution
Re-add the `mouse:down` click handler in `SchematicEditor.tsx` that toggles `include_in_load_profile` in the database, and add proper cache invalidation so the Tenants table picks up the change. Also add an optimistic update to the Tenants table mutation so it feels instant.

### Technical Details

**File 1: `src/components/schematic/SchematicEditor.tsx`**

1. **Re-import `useQueryClient`** from `@tanstack/react-query` (was removed in previous edit).

2. **Re-add `useQueryClient()` hook call** inside the component.

3. **Re-add `mouse:down` event handler** after the checkbox rendering `useEffect` (around line 758). This handler will:
   - Detect clicks on objects marked `isProfileCheckbox`
   - Look up the linked meter ID in `tenantProfileMap`
   - Optimistically toggle the local state
   - Update the database via Supabase
   - On success: invalidate the `["project-tenants", projectId]` query so the Tenants tab refreshes
   - On error: roll back the optimistic local state and show a toast

4. **Keep checkbox overlays as `evented: true, hoverCursor: 'pointer'`** (they already are -- no change needed).

**File 2: `src/components/projects/TenantManager.tsx`**

5. **Add optimistic update** to the existing `updateTenantIncludeInProfile` mutation (around line 449):
   - `onMutate`: Cancel outgoing queries, snapshot current cache, immediately set new value in TanStack Query cache
   - `onError`: Roll back to snapshot
   - `onSettled`: Invalidate to ensure consistency

   This makes the Tenants table checkbox toggle feel instant instead of waiting for the network round-trip.

### Changes Summary

| File | Change |
|------|--------|
| `SchematicEditor.tsx` | Re-add `useQueryClient` import and hook; re-add `mouse:down` handler with optimistic local state + DB update + query invalidation |
| `TenantManager.tsx` | Add optimistic update pattern to `updateTenantIncludeInProfile` mutation for instant UI feedback |

### Result
- Schematic view: clicking a checkbox toggles it instantly (optimistic local state), writes to the database, and invalidates the Tenants query
- Tenants table: clicking a checkbox toggles it instantly (optimistic cache update), writes to the database
- Switching tabs: the `isActive` effect already refetches `tenantProfileMap` when the Schematic tab becomes active, so it picks up any changes made in the Tenants tab
