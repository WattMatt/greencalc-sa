

# Restructure Templates: Group-Based Checklist Templates

## Overview

Instead of one flat list of checklist items, the Templates tab will show **template groups** (e.g., "Solar PV Handover", "Battery Installation Checklist"). Clicking on a group opens its items. This allows creating different types of checklists beyond just handover documentation.

## Database Changes

### New table: `checklist_template_groups`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| name | text | e.g. "Solar PV Handover" |
| description | text, nullable | Optional description |
| created_at | timestamp | |

### Modify `checklist_templates`

Add a `group_id` column (UUID, FK to `checklist_template_groups`) to associate each item with a group.

### Migration steps

1. Create `checklist_template_groups` table with RLS policies.
2. Insert one default group: "Solar PV Handover".
3. Add `group_id` column to `checklist_templates`.
4. Set all existing template items' `group_id` to the new "Solar PV Handover" group.
5. Make `group_id` NOT NULL after backfill.

## UI Changes

### Templates tab -- two-level view

**Level 1 -- Group list (default view):**
- Title: "Checklist Templates"
- Description: "Manage reusable checklist templates. Each template contains a set of requirements that sync to projects."
- Cards/rows for each template group showing name, item count, and actions (edit, delete).
- "Create Template" button to add a new group.

**Level 2 -- Items within a group (when a group is clicked):**
- Back button to return to the group list.
- Title shows the group name (e.g., "Solar PV Handover").
- The existing table of checklist items, filtered to that group.
- Add item input scoped to this group.

This is all handled with local state (a `selectedGroupId`) -- no routing needed.

## Files to Create/Modify

| File | Change |
|------|--------|
| SQL Migration | Create `checklist_template_groups`, add `group_id` to `checklist_templates`, backfill |
| `src/components/settings/ChecklistTemplatesCard.tsx` | Rewrite to two-level view: group list + item list |
| `src/components/projects/HandoverChecklist.tsx` | Update template sync to filter by group (use the "Solar PV Handover" group for handover folders) |

## Technical Details

### ChecklistTemplatesCard state machine

```text
selectedGroupId = null  -->  Show group list (cards with name, count, delete)
selectedGroupId = "abc" -->  Show items for that group (existing table UI + back button)
```

### Template sync update

The sync logic in `HandoverChecklist.tsx` currently fetches all `checklist_templates`. It will be updated to filter by the group associated with handover documentation (by name or a known convention), so only the relevant template items sync to handover checklists.

