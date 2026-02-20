
## Fix: Virtual Meter Not Appearing in Tenants Tab

### Root Cause

The "Create Virtual Meter" flow in the schematic editor only creates a record in `scada_imports` (the meter/channel data) and `project_schematic_meter_positions` (the canvas position). It does **not** create a corresponding `project_tenants` record. The Tenants tab exclusively reads from `project_tenants`, so the virtual meter is invisible there.

### Solution

After inserting the `scada_imports` record, also insert a `project_tenants` row linked to it via `scada_import_id`. This mirrors what happens when a user manually adds a tenant and assigns a meter to it.

### Technical Details

**File: `src/components/schematic/QuickMeterDialog.tsx`**

In the `handleCreateVirtualMeter` function, after the `scada_imports` insert succeeds and before the `project_schematic_meter_positions` insert, add:

```typescript
// Create a matching tenant record so the meter appears in the Tenants tab
await supabase
  .from("project_tenants")
  .insert({
    project_id: projectId,
    name: virtualShopName.trim() || virtualLabel.trim(),
    shop_name: virtualShopName.trim() || null,
    shop_number: virtualShopNumber.trim() || null,
    area_sqm: 0,
    scada_import_id: newMeter.id,
  });
```

The `project_tenants` table requires `name`, `project_id`, and `area_sqm`. The `scada_import_id` foreign key links it back to the SCADA record. Area defaults to 0 (the user can update it later in the Tenants tab).

### What stays the same
- The `scada_imports` record creation (unchanged)
- The `project_schematic_meter_positions` placement (unchanged)
- All existing tenant/meter rendering in the Tenants tab
- Meter card rendering on the schematic canvas

### Expected outcome
After creating a virtual meter in the schematic, it immediately appears in the Tenants tab with its label, shop name, and shop number -- just like any other tenant with an assigned meter. The total tenant count increments accordingly (e.g. 49 becomes 50).
