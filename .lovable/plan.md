
# Split Tenant "name" into "Shop Number" and "Shop Name" Columns

## ✅ COMPLETED

### Summary of Changes Made

1. **Database Migration** ✅ - Added `shop_number` and `shop_name` columns to `project_tenants` table, migrated existing data
2. **Update TenantManager Component** ✅ - Two separate columns with sorting, updated add/edit dialogs
3. **Update TenantProfileMatcher** ✅ - Updated interface and matching logic
4. **CSV Import** ✅ - Now recognizes shop_number, shop_name columns with fallback

---

## Implementation Details

### Database Schema
- Added `shop_number` (text, nullable) 
- Added `shop_name` (text, nullable)
- Migrated existing `name` data to `shop_name`
- `name` column preserved for backwards compatibility

### UI Changes
- Table now shows "Shop #" and "Shop Name" as separate sortable columns
- Add Tenant dialog has two input fields (Shop Number + Shop Name)
- Edit Tenant dialog has two input fields
- CSV template updated to include `shop_number,shop_name,area_sqm`

### Files Modified
- `src/components/projects/TenantManager.tsx`
- `src/components/projects/TenantProfileMatcher.tsx`
