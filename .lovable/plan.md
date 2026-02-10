

# Fix Duplicate Checklist Items + Move Template Manager to Settings

## Problem

1. **Duplicate requirements**: The old seeding logic (before templates existed) created checklist items without a `template_id`. The new sync logic then added the same items again with a `template_id`. Every requirement appears twice.

2. **Template management UX**: The current "Manage Template" popup dialog is too small and cramped for managing a global list. It needs a proper full-page view.

## Changes

### 1. Database cleanup migration

Run a SQL migration to remove the orphaned rows (items with no `template_id` that have a matching label with a `template_id` version in the same project). This cleans up all affected projects in one shot.

```sql
DELETE FROM handover_checklist_items a
WHERE a.template_id IS NULL
AND EXISTS (
  SELECT 1 FROM handover_checklist_items b
  WHERE b.project_id = a.project_id
  AND b.label = a.label
  AND b.template_id IS NOT NULL
);
```

### 2. New Settings tab: "Templates"

Add a 9th tab to the Settings page called "Templates" (with a FileText icon). This tab will contain a full-width card for managing the global checklist template -- the same functionality currently in the dialog but with proper spacing, a table layout, and room to grow.

The card will include:
- A list of all template items with delete buttons
- An input field to add new items
- A note explaining that changes sync to all projects

### 3. Update HandoverChecklist.tsx

- Remove the Dialog-based template manager entirely
- Change the "Manage Template" button to navigate to Settings (Templates tab) instead
- Update `EXPECTED_TAB_COUNT` in Settings.tsx from 8 to 9

## Files to modify

| File | Change |
|------|--------|
| SQL Migration | Delete duplicate checklist items |
| `src/pages/Settings.tsx` | Add "Templates" tab, update tab count to 9 |
| `src/components/settings/ChecklistTemplatesCard.tsx` | New component -- full template management UI |
| `src/components/projects/HandoverChecklist.tsx` | Remove dialog, change button to navigate to Settings |
| `src/components/settings/SettingsLoadingSkeleton.tsx` | Add one more skeleton tab |

