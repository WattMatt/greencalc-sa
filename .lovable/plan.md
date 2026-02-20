

## Add "Include in Load Profile" and "Meter Type" Columns to Tenants Table

### Overview
Three changes are needed:
1. Add an `include_in_load_profile` boolean column to `project_tenants` (default `true`) -- a checkbox between "Est. kWh/month" and "Source" columns.
2. Add an `is_virtual` boolean column to `project_tenants` (default `false`) -- displayed as a badge/label indicating "Actual" or "Virtual" in a new column.
3. Add a checkbox overlay on meter cards in the schematic editor so you can toggle `include_in_load_profile` directly from the schematic view.

Additionally, the "Council Check" virtual meter that was created before the tenant-insert fix needs to be verified and, if missing, a tenant record manually created for it.

---

### Database Migration

Add two new columns to `project_tenants`:

```sql
ALTER TABLE project_tenants
  ADD COLUMN include_in_load_profile boolean NOT NULL DEFAULT true,
  ADD COLUMN is_virtual boolean NOT NULL DEFAULT false;
```

No RLS changes needed -- existing policies cover all operations.

---

### Technical Changes

**1. `src/components/projects/TenantManager.tsx`**

- Update the `Tenant` interface to include `include_in_load_profile: boolean` and `is_virtual: boolean`.
- Add a new mutation `updateTenantIncludeInProfile` that updates `include_in_load_profile` on `project_tenants`.
- Add two new table columns in the `<TableHeader>`:
  - **"Include"** column: between "Est. kWh/month" and "Source", rendered as a `<Checkbox>`.
  - **"Type"** column: after "Source" (or between "Source" and the actions column), showing a `<Badge>` reading "Virtual" or "Actual".
- In each `<TableRow>`, render:
  - A `<Checkbox>` bound to `tenant.include_in_load_profile`, toggling via the mutation on change.
  - A `<Badge>` showing `tenant.is_virtual ? "Virtual" : "Actual"` with distinct styling (e.g., outline for Virtual, green for Actual).

**2. `src/pages/ProjectDetail.tsx`**

- The tenant query already uses `select(*, ...)` so the new columns will be included automatically once the migration runs and types regenerate.

**3. `src/components/schematic/QuickMeterDialog.tsx`**

- When creating a virtual meter, set `is_virtual: true` in the `project_tenants` insert.

**4. `src/components/schematic/SchematicEditor.tsx`**

- After rendering each meter card on the canvas, add a small checkbox indicator (a coloured circle or tick icon) on the card that reflects the `include_in_load_profile` status.
- To get this data, fetch `project_tenants` for the project (filtered by `scada_import_id` matching placed meters) and build a lookup map of `scada_import_id -> include_in_load_profile`.
- Add a click handler on the checkbox overlay that toggles `include_in_load_profile` in the database and updates the visual state.
- The checkbox will appear as a small green tick (included) or grey empty circle (excluded) in the top-right corner of each meter card.

**5. Existing Virtual Meter Fix**

- The "Council Check" meter was created before the tenant-insert fix. We will check the database for any `scada_imports` records with `project_id` matching this project that have no corresponding `project_tenants` row, and if found, insert the missing tenant record. This will be handled as part of the implementation.

---

### What stays the same
- All existing tenant CRUD operations
- Load profile assignment logic
- Meter card rendering (just adding an overlay)
- Connection drawing and hierarchy logic
- All existing schematic editor features

### Expected outcome
- The tenants table shows a checkbox column ("Include") to toggle whether each meter contributes to the load profile calculation.
- The tenants table shows a "Type" column with "Actual" or "Virtual" badges.
- Meter cards on the schematic show a small checkbox indicator for load profile inclusion, clickable in edit mode.
- Virtual meters created from the schematic are automatically marked as `is_virtual: true`.
- The "Council Check" meter appears in the tenants table (50 total).

