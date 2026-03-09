

# Plan: Fix Import from Library not showing meters

## Root causes

1. **Supabase 1000-row default limit**: There are 1,848 eligible meters but only the first 1,000 are returned by default. However, the real issue is likely a timeout or the `useMemo` reactivity bug.

2. **Heavy payload**: The query fetches `load_profile_weekday` and `load_profile_weekend` (24-element arrays) for all 1,848 rows — unnecessary for the import dialog's display purposes.

3. **`useMemo` with side effects**: Using `useMemo` to call `setRows` is an anti-pattern. React may skip or re-run memos unpredictably, causing the rows to never populate.

## Changes

### `src/components/projects/MeterLibraryImportDialog.tsx`

1. **Slim the query** — only select columns needed for display: `id, site_name, shop_name, shop_number, meter_label, meter_color, data_points, area_sqm, date_range_start, date_range_end, file_name, value_unit, detected_interval_minutes, weekday_days, weekend_days, csv_file_path`. Drop `load_profile_weekday` and `load_profile_weekend` from the listing query (they're copied from the full row fetch during creation anyway).

2. **Remove the 1,000-row cap** — add `.limit(5000)` or paginate. Given 1,848 rows with a slim payload, a single fetch with a higher limit is fine.

3. **Replace `useMemo` with `useEffect`** — properly trigger row parsing when `globalMeters` data arrives, fixing the reactivity bug that silently prevents rows from being set.

4. **Update `MeterRow` interface** — remove `load_profile_weekday` and `load_profile_weekend` since they're no longer fetched in the listing query. The creation mutation already fetches full meter data individually.

No database changes needed.

