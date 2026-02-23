

## Ingest Tenant CSV with Rating Column and Semicolon Delimiter

### Problem

Two issues prevent your `MINI_SUB_5.csv` from importing correctly:

1. **Semicolon delimiter**: The file uses `;` as a separator, but the CSV parser only splits on commas. All four columns get merged into one.
2. **Missing RATING column**: The column mapper only supports Shop Number, Shop Name, and Area. The RATING column (e.g. "80A TP") is ignored, and the database has no field to store it.

### Solution

**1. Auto-detect CSV delimiter**

Update `handleCsvFileSelected` in `TenantManager.tsx` to detect whether the first line uses `;`, `\t`, or `,` as a delimiter, and split all rows accordingly.

**2. Add `cb_rating` column to `project_tenants` table**

```sql
ALTER TABLE project_tenants ADD COLUMN cb_rating text;
```

This stores values like "80A TP", "150A TP", etc.

**3. Add "Rating" role to TenantColumnMapper**

- Add `"rating"` to the `TenantColumnRole` type
- Add a `cb_rating` field to `TenantMappedData`
- Add auto-detection for headers containing "rating", "breaker", "cb", or "amps"
- Add a menu item with a `Zap` icon for the Rating role
- Parse and pass through the rating string during import

**4. Update `handleMappedImport` to save `cb_rating`**

Include `cb_rating: t.cb_rating` in the insert payload.

**5. Display Rating in the Tenants table**

Add a "Rating" column to the tenant table rows showing the stored value (e.g. "80A TP").

### Files to Change

| File | Change |
|------|--------|
| Database migration | Add `cb_rating text` column to `project_tenants` |
| `src/components/projects/TenantManager.tsx` | Auto-detect delimiter; save `cb_rating` on import; display rating column |
| `src/components/projects/TenantColumnMapper.tsx` | Add `rating` role with auto-detection, icon, and badge |
| `src/components/projects/load-profile/types.ts` | Add `cb_rating` to `Tenant` interface |

