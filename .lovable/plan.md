
## Fix: Delete Button in Bulk Upload Should Fully Clean Up

### Problem
The delete button (trash icon) next to "Previously Imported Files" in the SCADA Bulk Upload wizard currently only deletes the `scada_imports` database record. It does **not**:
1. Remove the actual file from the `scada-csvs` storage bucket
2. Clear the `scada_import_id` reference on any tenant that was linked to this import

### Fix

**File: `src/components/projects/ScadaImportWizard.tsx` -- `deleteImportMutation` (around line 285)**

Update the mutation to perform three cleanup steps before deleting the DB record:

1. **Null out tenant references**: Update any `project_tenants` rows where `scada_import_id` matches the import being deleted, setting it to `null`.

2. **Remove storage file**: List files in `scada-csvs` bucket under the project prefix (`{projectId}/`), find any file whose name ends with `_{file_name}`, and delete it.

3. **Delete the DB record**: Same as current -- delete from `scada_imports`.

The updated mutation:

```typescript
const deleteImportMutation = useMutation({
  mutationFn: async (importId: string) => {
    // Get the import record first (need file_name for storage cleanup)
    const { data: imp } = await supabase
      .from("scada_imports")
      .select("file_name")
      .eq("id", importId)
      .single();

    // 1. Clear tenant references
    await supabase
      .from("project_tenants")
      .update({ scada_import_id: null })
      .eq("scada_import_id", importId);

    // 2. Remove file from storage
    if (imp?.file_name) {
      const { data: files } = await supabase.storage
        .from("scada-csvs")
        .list(projectId);
      const matches = (files || []).filter(f =>
        f.name.endsWith(`_${imp.file_name}`)
      );
      if (matches.length > 0) {
        await supabase.storage
          .from("scada-csvs")
          .remove(matches.map(f => `${projectId}/${f.name}`));
      }
    }

    // 3. Delete the DB record
    const { error } = await supabase
      .from("scada_imports")
      .delete()
      .eq("id", importId);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["existing-scada-imports", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project-tenants"] });
    toast.success("Import and associated data deleted");
  },
  onError: (err: Error) => {
    toast.error(`Failed to delete: ${err.message}`);
  },
});
```

### Add Confirmation Dialog
Currently the wizard delete button has no confirmation. Add a `confirm()` prompt before mutating (the `ScadaImportsList` version already does this).

### Files Modified
- `src/components/projects/ScadaImportWizard.tsx` -- enhanced `deleteImportMutation` with full cleanup
