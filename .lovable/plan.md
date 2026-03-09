

# Plan: Filter Import from Library to PDB files only

## Problem
The current query fetches all unassigned meters (up to 5,000), which may be timing out or returning too many irrelevant rows. The user wants to focus only on PDB-prefixed meters.

## Change

### `src/components/projects/MeterLibraryImportDialog.tsx` (line 59-63)

Add a `.like("shop_name", "PDB_%")` filter to the query so only meters whose `shop_name` (which stores the original filename) starts with "PDB" are fetched:

```typescript
const { data, error } = await supabase
  .from("scada_imports")
  .select("id, site_name, shop_name, shop_number, meter_label, meter_color, data_points, area_sqm, date_range_start, date_range_end, file_name, value_unit, detected_interval_minutes, weekday_days, weekend_days, csv_file_path")
  .is("project_id", null)
  .gt("data_points", 0)
  .or("shop_name.ilike.PDB_%,meter_label.ilike.PDB_%,file_name.ilike.PDB_%")
  .order("site_name", { ascending: true })
  .limit(5000);
```

This checks `shop_name`, `meter_label`, and `file_name` for the PDB prefix (case-insensitive), ensuring we capture PDB meters regardless of which field stores the original filename.

No other files or database changes needed.

