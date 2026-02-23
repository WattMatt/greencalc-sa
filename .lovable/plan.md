

## Validated-Date Load Profile (No Fallbacks)

### What Changes
Refactor the `baseChartData` computation in `useLoadProfileData.ts` to use a cross-tenant validated-date approach, matching how the envelope chart works. Remove all fallback logic (pre-computed profiles, shop-type estimates).

### File: `src/components/projects/load-profile/hooks/useLoadProfileData.ts`

**Replace the `baseChartData` useMemo (lines 387-496) with a two-pass approach:**

**Pass 1 -- Collect per-tenant, per-date hourly data:**
- For each included tenant, call `parseRawData(getRawData(tenant))` to get raw points
- Group into a structure: `Map<tenantId, Map<dateKey, number[24]>>` where each entry is the hourly kW for that tenant on that date
- Apply area scaling (`tenantArea / scadaArea`) during grouping
- Average sub-hourly readings (e.g. 30-min intervals) into hourly values
- Apply the existing outage threshold (75 kW daily total) to discard outage days per tenant
- Track which tenants produced valid raw data in a `tenantsWithRawData` set

**Pass 2 -- Filter to full-coverage dates and aggregate:**
- Build a set of "validated dates" -- dates where every tenant in `tenantsWithRawData` has a valid (non-outage) entry
- Also filter by `selectedDays` (day-of-week filter) and optionally `selectedMonthsFilter`
- For each validated date, sum all tenants' hourly values to get 24 hourly site totals
- Average across all validated dates to produce the final 24-hour composite profile
- No day multipliers needed since we're averaging real data from specific days

**Remove fallback logic:**
- Remove Priority 2 (multi-meter averaged profiles)
- Remove Priority 3 (single SCADA pre-computed profiles)
- Remove Priority 4 (shop-type estimates)
- Tenants without raw SCADA data simply contribute 0 (they are excluded from `tenantsWithRawData` and don't affect the validated-date filter)

**Additional hook return:**
- Add `validatedDateCount: number` so the UI can display how many dates underpin the profile

**Update `weekdayDailyKwh` / `weekendDailyKwh` (lines 293-384):**
- Apply the same validated-date logic for consistency
- Remove fallback paths (multi-meter, single SCADA, shop-type)

**Update `tenantsWithScada` / `tenantsEstimated` (lines 278-290):**
- Simplify: a tenant "has SCADA" if `parseRawData(getRawData(tenant)).length > 0`
- Everything else is "estimated" (and contributes nothing to the profile)

### File: `src/components/projects/load-profile/index.tsx`

- Consume the new `validatedDateCount` from `useLoadProfileData`
- Display it in the `ChartStats` component or header area (e.g. "Based on 127 validated days")

### File: `src/components/projects/load-profile/components/ChartStats.tsx`

- Add an optional `validatedDateCount` prop
- Display it as a small badge or stat card alongside existing stats

### What Stays the Same
- The envelope chart is untouched
- PV, battery, grid flow calculations downstream are unchanged
- Export functions, annotations, TOU colouring remain
- The outage threshold (75 kW) stays
- `parseRawData` utility is reused as-is

### Performance
This approach is comparable to the current per-tenant cache since it still collapses to 24 values. The cross-tenant date validation adds one extra sweep but is negligible compared to the envelope's min/max tracking.

