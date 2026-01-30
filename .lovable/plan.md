
# Split Tenant "name" into "Shop Number" and "Shop Name" Columns

## Overview
This change will update the `project_tenants` table to separate the single `name` field into two distinct fields: `shop_number` and `shop_name`. This provides better data organization and allows for sorting/filtering by either field independently.

---

## Summary of Changes

1. **Database Migration** - Add two new columns (`shop_number`, `shop_name`) and migrate existing data
2. **Update TenantManager Component** - Display two separate columns with sorting support
3. **Update Related Components** - Ensure compatibility across all components that reference tenant names

---

## Database Changes

### New Columns for `project_tenants` table:

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `shop_number` | text | YES | NULL |
| `shop_name` | text | YES | NULL |

### Migration Strategy:
- Add the two new columns
- Migrate existing `name` data to `shop_name` 
- Keep `name` column temporarily for backwards compatibility (can be removed later)

```text
┌─────────────────────────────────────────────────────────────┐
│                    project_tenants                          │
├─────────────────────────────────────────────────────────────┤
│ id                  (uuid)        - existing                │
│ project_id          (uuid)        - existing                │
│ name                (text)        - existing (deprecate)    │
│ shop_number         (text)        - NEW                     │
│ shop_name           (text)        - NEW                     │
│ area_sqm            (numeric)     - existing                │
│ shop_type_id        (uuid)        - existing                │
│ scada_import_id     (uuid)        - existing                │
│ monthly_kwh_override (numeric)    - existing                │
└─────────────────────────────────────────────────────────────┘
```

---

## UI Changes

### Current Table Layout:
```text
┌──────────────┬──────────┬──────────────┬───────┬──────────────┬────────┬───┐
│ Tenant Name  │ Area(m²) │ Load Profile │ Scale │ Est.kWh/mon  │ Source │   │
└──────────────┴──────────┴──────────────┴───────┴──────────────┴────────┴───┘
```

### New Table Layout:
```text
┌─────────────┬─────────────┬──────────┬──────────────┬───────┬──────────────┬────────┬───┐
│ Shop Number │ Shop Name   │ Area(m²) │ Load Profile │ Scale │ Est.kWh/mon  │ Source │   │
└─────────────┴─────────────┴──────────┴──────────────┴───────┴──────────────┴────────┴───┘
```

- Both "Shop Number" and "Shop Name" columns will be sortable
- Edit dialog will show two separate input fields
- Add dialog will have two separate input fields
- CSV import will look for both `shop_number` and `shop_name` columns (with fallback to existing `name` column)

---

## Files to Modify

| File | Changes |
|------|---------|
| Database migration | Add `shop_number` and `shop_name` columns, migrate data |
| `src/components/projects/TenantManager.tsx` | Update interface, table columns, add/edit dialogs, sorting, CSV import |
| `src/components/projects/TenantProfileMatcher.tsx` | Update Tenant interface to include `shop_number` |
| `src/components/projects/MultiMeterSelector.tsx` | Update query to use `shop_name` instead of `name` |
| `src/components/projects/ScaledMeterPreview.tsx` | Update to handle new field structure |

---

## Technical Implementation Details

### 1. Database Migration SQL

```sql
-- Add new columns
ALTER TABLE project_tenants 
ADD COLUMN shop_number text,
ADD COLUMN shop_name text;

-- Migrate existing name data to shop_name
UPDATE project_tenants 
SET shop_name = name 
WHERE shop_name IS NULL;
```

### 2. TypeScript Interface Changes

**Current:**
```typescript
interface Tenant {
  id: string;
  name: string;
  area_sqm: number;
  // ...
}
```

**New:**
```typescript
interface Tenant {
  id: string;
  name: string;        // Keep for backwards compatibility
  shop_number: string | null;
  shop_name: string | null;
  area_sqm: number;
  // ...
}
```

### 3. TenantManager.tsx Changes

**State Updates:**
- Update `newTenant` state to include `shop_number` and `shop_name`
- Update `editTenant` state to include `shop_number` and `shop_name`
- Add sorting for `shop_number` column

**Add Tenant Dialog:**
```typescript
// Two input fields instead of one
<Input placeholder="e.g., G12" ... /> // Shop Number
<Input placeholder="e.g., Woolworths" ... /> // Shop Name
```

**Edit Tenant Dialog:**
```typescript
// Two input fields
<Input placeholder="Shop Number" ... />
<Input placeholder="Shop Name" ... />
```

**Table Display:**
```typescript
<TableCell>{tenant.shop_number || '-'}</TableCell>
<TableCell className="font-medium">{tenant.shop_name || tenant.name}</TableCell>
```

**Sorting Options:**
- Add `shop_number` as a new sortable column
- Rename `name` sort to use `shop_name`

### 4. CSV Import Logic Update

Update `processWizardData` to detect both columns:
```typescript
const shopNumberIdx = headers.findIndex(h => 
  h.includes("shop_number") || h.includes("shop number") || h.includes("unit") || h.includes("number")
);
const shopNameIdx = headers.findIndex(h => 
  h.includes("shop_name") || h.includes("shop name") || h.includes("tenant") || h.includes("name")
);
```

### 5. Profile Matching Update

Update `TenantProfileMatcher.tsx` to match on `shop_name`:
```typescript
const exactNameMatch = meters.find(m =>
  (m.shop_name && m.shop_name.toLowerCase() === tenant.shop_name?.toLowerCase()) ||
  (m.meter_label && m.meter_label.toLowerCase() === tenant.shop_name?.toLowerCase())
);
```

---

## Backwards Compatibility

- The `name` column will be preserved initially to ensure existing queries continue to work
- Display logic will fallback to `name` if `shop_name` is empty: `tenant.shop_name || tenant.name`
- The `name` column can be deprecated and removed in a future migration once all data is migrated

---

## Implementation Order

1. Create database migration to add columns and migrate existing data
2. Update `TenantManager.tsx` - interface, state, table, dialogs, sorting, CSV import
3. Update `TenantProfileMatcher.tsx` - interface and matching logic  
4. Update `MultiMeterSelector.tsx` - query field reference
5. Test end-to-end: add, edit, import, sort, match functionality
