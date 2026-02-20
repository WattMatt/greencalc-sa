
## Add Virtual Meter to Place Meter Dialog

### Problem
The "Place Meter" dialog only shows existing SCADA imports. If no meters have been imported yet (or you need a placeholder/label-only meter on the schematic), there is no way to place one.

### Solution
Add a "Create Virtual Meter" section at the top of the QuickMeterDialog. This creates a lightweight record in the database (no file upload or raw data needed) and immediately places it on the schematic.

### How it works for the user
1. Click "Place Meter" and click on the canvas -- the dialog opens as usual.
2. At the top of the dialog, a new collapsible section titled "Create Virtual Meter" appears with fields for: Meter Label, Shop Name, and Shop Number.
3. Fill in at least the Meter Label, click "Create and Place".
4. The virtual meter is saved to the database and placed on the schematic in one step.
5. The existing SCADA meter list remains below, unchanged.

### Technical Details

**File: `src/components/schematic/QuickMeterDialog.tsx`**

1. Add a collapsible "Create Virtual Meter" section (using Collapsible from Radix) above the search/list area.
2. The section contains three input fields: Meter Label (required), Shop Name (optional), Shop Number (optional).
3. On "Create and Place" click:
   - Insert a new row into `scada_imports` with `site_name` set to the meter label, `project_id` set to the current project, and the optional fields. No `file_name`, `raw_data`, or profile arrays -- just a label-only record.
   - Use the returned `id` to insert into `project_schematic_meter_positions` at the clicked position (same logic as `handleSelectMeter`).
   - Call `onMeterPlaced()` and close the dialog.
4. Virtual meters will render on the canvas using the same meter card logic -- the label shows the meter label, shop/number show as provided or "N/A", file shows "N/A".

**No database migration needed** -- `scada_imports` already accepts all these fields as nullable (only `site_name` is required), and there is no foreign key constraint from `project_schematic_meter_positions.meter_id` to `scada_imports` (the types show no such relationship).

### What stays the same
- Existing SCADA meter list and search functionality
- Meter card rendering on canvas
- Connection drawing and hierarchy logic
- All other schematic editor features
