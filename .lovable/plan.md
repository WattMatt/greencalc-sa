

## Improve Tenant Profile Assignment UX

Three changes to the tenant profile assignment dropdown in `TenantManager.tsx`:

### 1. Auto-clear previous tenant when reassigning a meter

Currently, if Meter A is assigned to Tenant 1 and you then assign Meter A to Tenant 2, Tenant 1 still keeps Meter A in its `scada_import_id`. The `updateTenantProfile` mutation will be updated to first clear any other tenant that currently has the same `scadaImportId` before assigning it to the new tenant.

### 2. Hide already-assigned meters from the dropdown

Meters that are already assigned to other tenants should not appear in the profile dropdown. The `getSortedProfilesWithSuggestions` call will be wrapped with a filter that excludes profiles whose ID matches any other tenant's `scada_import_id` (but still shows the currently assigned profile for that specific tenant row).

### 3. Add a small X button to clear a specific assignment

To the left of the "Sort by" label (or next to the profile name in the trigger button), add a small X icon button that clears the assignment for that tenant. This calls `updateTenantProfile.mutate({ tenantId, scadaImportId: null })`.

---

### Technical Details

**File: `src/components/projects/TenantManager.tsx`**

**Change 1 -- Auto-clear on reassignment (lines 367-379):**

Update the `updateTenantProfile` mutation to first nullify `scada_import_id` on any other tenant that currently holds the same profile, then assign it to the new tenant:

```typescript
const updateTenantProfile = useMutation({
  mutationFn: async ({ tenantId, scadaImportId }: { tenantId: string; scadaImportId: string | null }) => {
    // If assigning a profile, first clear it from any other tenant
    if (scadaImportId) {
      await supabase
        .from("project_tenants")
        .update({ scada_import_id: null })
        .eq("project_id", projectId)
        .eq("scada_import_id", scadaImportId)
        .neq("id", tenantId);
    }
    const { error } = await supabase
      .from("project_tenants")
      .update({ scada_import_id: scadaImportId })
      .eq("id", tenantId);
    if (error) throw error;
  },
  // ...existing callbacks
});
```

**Change 2 -- Filter assigned profiles from dropdown (around line 1126-1133):**

Compute a set of already-assigned profile IDs from all tenants, then filter `sortedSuggestions` to exclude profiles assigned to *other* tenants:

```typescript
// Compute once above the map loop (around line 1104)
const assignedProfileIds = new Set(
  sortedTenants
    .filter(t => t.scada_import_id)
    .map(t => t.scada_import_id!)
);

// Inside the loop, filter suggestions for this tenant's dropdown
const filteredSuggestions = sortedSuggestions.filter(
  ({ profile }) => profile.id === tenant.scada_import_id || !assignedProfileIds.has(profile.id)
);
```

**Change 3 -- Add X clear button next to the profile trigger (around line 1141-1224):**

Add a small X button next to the combobox trigger that appears only when a profile is assigned:

```typescript
<div className="flex items-center gap-1">
  {assignedProfile && (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      onClick={(e) => {
        e.stopPropagation();
        updateTenantProfile.mutate({ tenantId: tenant.id, scadaImportId: null });
      }}
    >
      <X className="h-3 w-3" />
    </Button>
  )}
  <Popover>
    {/* ...existing combobox */}
  </Popover>
</div>
```

### Files Modified
- `src/components/projects/TenantManager.tsx` -- three targeted changes as described above.

