

## Fix TenantColumnMapper -- Make Area Optional

### Problem
The CSV file has "-" (dashes) in the Area column, meaning no area data is available. The current validation requires both Shop Name AND Area with `area > 0`, causing all 49 rows to fail validation and showing "0 valid tenants".

### Solution
Make Area optional in the column mapper. When area is missing or invalid (like "-"), import the tenant with `area_sqm: 0` (or null) instead of rejecting the row entirely.

### Changes

**File: `src/components/projects/TenantColumnMapper.tsx`**

1. **Change `canImport` condition** -- only require `shop_name` to be mapped (remove area requirement):
   - `const canImport = roleColumns.shop_name !== null;` (was: `roleColumns.shop_name !== null && roleColumns.area !== null`)

2. **Update `handleImport`** -- handle missing/invalid area gracefully:
   - If no area column is mapped, set `area_sqm: 0`
   - If area column is mapped but value is "-" or invalid, set `area_sqm: 0`
   - Remove the `area > 0` check from the row validation -- only require a non-empty shop name

3. **Update `validCount` memo** -- same logic: count rows with a valid shop name regardless of area

4. **Update description text** -- change "Shop Name and Area are required" to "Shop Name is required. Area is optional."

5. **Update the footer hint** -- change "Assign Shop Name and Area to continue" to "Assign Shop Name to continue"

### Result
All 49 rows with valid shop names will import successfully. Tenants without area data will get `area_sqm: 0`, which can be edited later.

