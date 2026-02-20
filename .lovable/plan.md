

## Fix: Prevent Duplicate Meter Imports (Upsert Instead of Insert)

### Problem
Every time you use the Bulk Upload wizard and re-import the same CSV files, new rows are created in the database. There is no check for whether a meter with the same file name already exists for this project. This causes duplicate entries to pile up.

### Solution
Before inserting each file's data, check if a `scada_imports` record already exists for this project with the same `file_name`. If it does, **update** the existing record instead of creating a new one.

### What Changes

**File: `src/components/projects/TenantManager.tsx` -- `handleWizardComplete` function**

1. For each file result, query `scada_imports` for an existing record matching `project_id` + `file_name`
2. If a match is found, use `.update()` on that record's ID instead of `.insert()`
3. If no match, proceed with `.insert()` as before
4. Update the success toast to distinguish between "imported" and "updated" counts

### Technical Detail

```text
For each result:
  1. SELECT id FROM scada_imports WHERE project_id = ? AND file_name = ?
  2. If found -> UPDATE scada_imports SET ... WHERE id = existing.id
  3. If not found -> INSERT INTO scada_imports (...)
```

This mirrors the storage-level `upsert: true` already used for the file uploads in the wizard, ensuring both the storage bucket and database stay in sync without duplicates.

### Files Modified
- `src/components/projects/TenantManager.tsx` -- replace blind `.insert()` with a check-then-upsert pattern in `handleWizardComplete`

