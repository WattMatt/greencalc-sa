

## Fix: Tenant "Include in Load Profile" Toggle Not Syncing to Schematic View

### Problem

The toggle in the Tenants table **does save correctly** to the database (confirmed by network response showing `include_in_load_profile: false` for "Bulck Check"). However, when switching to the Schematics tab, the schematic editor shows all checkboxes as green/enabled because it only fetches the `tenantProfileMap` once on mount (keyed by `schematicId` and `projectId`, which don't change between tab switches).

### Root Cause

In `SchematicEditor.tsx`, the data-loading `useEffect` (line 215-222) depends on `[schematicId, projectId]`. Since these values remain constant across tab switches within the same project page, the effect never re-runs. The `tenantProfileMap` retains its original values from when the schematic was first opened.

### Solution

Re-fetch the `tenantProfileMap` whenever the schematic editor becomes visible (i.e., when the user switches back to the Schematics tab). Two changes:

### Technical Details

**1. `src/components/schematic/SchematicEditor.tsx`**

Add a visibility-based refetch using `document.visibilityState` or, more precisely, detect when the component re-enters the viewport. The simplest approach: add a `key` prop or a refresh trigger.

The cleanest fix is to use a `focus`/`visibility` listener or accept a `refreshKey` prop that changes whenever the Schematics tab is activated.

**Approach:** Add a `useEffect` that listens for the window `focus` event to refetch `tenantProfileMap`. This handles both tab switches within the app and returning from another browser tab:

```typescript
// Re-fetch tenant profile map when window regains focus
useEffect(() => {
  const handleFocus = () => { fetchTenantProfileMap(); };
  window.addEventListener('focus', handleFocus);
  return () => window.removeEventListener('focus', handleFocus);
}, [projectId]);
```

**2. `src/components/projects/SchematicsTab.tsx`**

Pass a `refreshKey` prop to `SchematicEditor` that increments whenever the schematics tab becomes active. Alternatively, since `TabsContent` in Radix UI unmounts content when not active by default (via `forceMount`), we can verify if the editor is being unmounted/remounted.

**Preferred approach:** Since the SchematicEditor is conditionally rendered (only when `activeSchematic` is set), the simplest fix is to make the data-fetch `useEffect` also depend on a visible/active signal. We will:

- In `SchematicsTab.tsx`, pass an `isVisible` boolean prop (or simply a counter that increments each time the tab activates).
- In `SchematicEditor.tsx`, add this prop to the data-fetch dependency array so `tenantProfileMap` refreshes on every tab activation.

Alternatively, the most minimal fix: just call `fetchTenantProfileMap()` inside the existing canvas render effect that already depends on `tenantProfileMap`, ensuring it refetches when the canvas becomes ready.

**Simplest correct fix:** Add a window `focus` listener in `SchematicEditor.tsx` to refetch `tenantProfileMap` and also refetch it when `isEditMode` changes (entering/leaving edit mode triggers a fresh pull).

### Changes Summary

| File | Change |
|------|--------|
| `src/components/schematic/SchematicEditor.tsx` | Add `useEffect` with `focus` event listener to refetch `tenantProfileMap` on window focus. Also refetch when `isEditMode` toggles. |

### What stays the same
- The Tenants tab toggle mutation (already saves correctly)
- The schematic canvas rendering logic
- The checkbox overlay click handler in the schematic
- All other data fetching in the editor

