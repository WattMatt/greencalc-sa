

## Problem

The NERSA schema migration dropped the old `tariffs` table and replaced it with `tariff_plans`, but:
- The `projects.tariff_id` column still exists with no foreign key constraint
- Multiple queries still try to join `projects` with the deleted `tariffs` table
- This causes a 400 error ("Could not find a relationship between 'projects' and 'tariffs'"), which means **no projects load at all**

## Fix

### 1. Database Migration
Add a foreign key from `projects.tariff_id` to `tariff_plans.id`:
```sql
ALTER TABLE projects
  ADD CONSTRAINT projects_tariff_id_fkey
  FOREIGN KEY (tariff_id) REFERENCES tariff_plans(id)
  ON DELETE SET NULL;
```

### 2. Update Queries (4 files)

**src/pages/Projects.tsx** (line ~58)
- Change `tariffs(name, municipality_id, municipalities(name))` to `tariff_plans(name, municipality_id, municipalities(name))`

**src/pages/ProjectDetail.tsx** (line ~795)
- Change `tariffs(*, municipality_id, municipalities(name, province_id, provinces(name)))` to `tariff_plans(*, municipality_id, municipalities(name, province_id, provinces(name)))`

**src/pages/ProposalWorkspace.tsx** (line ~108)
- Change `tariffs(id, name)` to `tariff_plans(id, name)`

**src/components/proposals/ProposalWorkspaceInline.tsx** (line ~110)
- Change `tariffs(id, name)` to `tariff_plans(id, name)`

### 3. Update Property References
Any code accessing `project.tariffs` (the joined result) will need to be updated to `project.tariff_plans` throughout these files. This includes things like:
- `project.tariffs?.name` becomes `project.tariff_plans?.name`
- `project.tariffs?.municipalities?.name` becomes `project.tariff_plans?.municipalities?.name`

This is a straightforward find-and-replace across the 4 affected files.
