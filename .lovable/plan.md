

## Update Load Profile Chart to Use Raw Time-Series Data

### Problem
The Load Profile chart currently derives its hourly values from pre-computed `load_profile_weekday` / `load_profile_weekend` arrays (averaged during import). The Envelope chart uses the actual raw time-series data (`raw_data`). This causes the two charts to show different values for what should be the same average.

### Solution
Modify `useLoadProfileData` so that, when raw SCADA data is available for a tenant, it computes the hourly average from the raw time-series (same source as the envelope), then applies the existing diversity factor, area scaling, day multipliers, and display unit conversion on top.

For tenants without raw data, the existing logic (shop type estimates, pre-computed profiles) remains as a fallback.

### Technical Details

**File: `src/components/projects/load-profile/hooks/useLoadProfileData.ts`**

1. Import/reuse the `parseRawData` function from `useEnvelopeData.ts` (extract it to a shared utility or duplicate it).

2. In the `baseChartData` useMemo, for each tenant with `scada_imports.raw_data`:
   - Parse raw data with `parseRawData()`
   - Filter by selected days of week (0=Sunday through 6=Saturday) using the date's actual day
   - Filter by selected months if the `selectedMonthsFilter` is passed through (future-proofing)
   - Group readings by hour, average sub-hourly intervals (same as envelope)
   - Apply area scaling (`tenant.area_sqm / scada_imports.area_sqm`)
   - Apply the day multiplier for the specific day of each reading
   - Average across all matching days to get a single hourly kW value per tenant
   - Skip the pre-computed profile path entirely for these tenants

3. Tenants without raw data continue to use the existing `load_profile_weekday`/`load_profile_weekend` + shop type estimate fallback path (no change).

4. The diversity factor, display unit conversion (kW to kVA), and PV/battery simulation layers remain completely unchanged -- they operate on the output of `baseChartData` as before.

5. Apply the same 75 kW minimum threshold used in the envelope chart, so outage days are excluded from the average consistently.

**File: `src/components/projects/load-profile/utils/parseRawData.ts`** (new shared utility)

Extract the `parseRawData` function and `MONTH_MAP` constant from `useEnvelopeData.ts` into a shared file so both hooks can import it without duplication.

**File: `src/components/projects/load-profile/hooks/useEnvelopeData.ts`**

Update to import `parseRawData` from the new shared utility instead of defining it locally.

### What stays the same
- Diversity factor application
- Area scaling (tenant area / SCADA area ratio)
- Multi-meter weighted averaging (for tenants using `tenant_meters`)
- Day multipliers for weekday variation
- Shop type estimate fallback (for tenants without SCADA data)
- PV generation, battery simulation, and all downstream calculations
- Display unit (kW/kVA) conversion

### Expected outcome
When both charts use the same raw data source, the Load Profile average line and the Envelope average line will show consistent values (with the Load Profile additionally reflecting diversity factor and day multipliers as configured).

