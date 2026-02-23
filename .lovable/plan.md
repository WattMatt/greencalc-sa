

## Fix: kWh vs kW Handling in Load Profile Charts

### The Problem

Your meter data is in **kWh** (energy per interval), but the load profile charts treat all values as if they are **kW** (instantaneous power). This causes incorrect readings:

- For 30-minute interval data: the chart shows roughly **half** the actual demand
- For 15-minute interval data: the chart shows roughly **one quarter** of the actual demand

The core issue is that when multiple readings fall within the same hour, the system **averages** them. For kW data, averaging is correct. For kWh data, you need to **sum** the values to get total kWh for the hour (which numerically equals the average kW for that hour).

### How It Will Be Fixed

**1. Store the unit type alongside raw data**

Add a `value_unit` column to the `scada_imports` table so the system knows whether stored values are kWh, kW, or another unit. This preserves the information that is already captured during import but currently discarded after processing.

Database migration:
```sql
ALTER TABLE scada_imports ADD COLUMN value_unit text DEFAULT 'kWh';
```

**2. Pass the unit through during import**

Update `SitesTab.tsx` to save the selected `valueUnit` to the new `value_unit` column when processing meter data.

**3. Fix `useValidatedSiteData.ts` — the main calculation engine**

Currently (line 97):
```
avgKw = entry.sum / entry.count
```

Updated logic:
- If `value_unit` is an energy unit (kWh, Wh, MWh, kVAh): **sum** readings in the hour (total kWh in 1 hour = average kW)
- If `value_unit` is a power unit (kW, W, MW, kVA): **average** readings in the hour (as currently done)

For existing data without a stored unit, **default to kWh** (since that is the most common format for SA SCADA exports).

**4. Fix `useStackedMeterData.ts` — the "By Meter" chart**

This hook also needs the same logic. Currently it takes the **max** of raw values per hour. For kWh data, it should first sum sub-hourly readings into hourly kW, then take the max across days.

### Files to Change

| File | Change |
|------|--------|
| `scada_imports` table | Add `value_unit` column (default `'kWh'`) |
| `src/components/loadprofiles/SitesTab.tsx` | Save `valueUnit` to DB during processing |
| `src/components/projects/load-profile/types.ts` | Add `value_unit` to the Tenant/scada_imports type |
| `src/components/projects/load-profile/hooks/useValidatedSiteData.ts` | Sum kWh readings instead of averaging; pass unit info through |
| `src/components/projects/load-profile/hooks/useStackedMeterData.ts` | Same correction for the stacked meter view |
| `src/components/projects/load-profile/hooks/useLoadProfileData.ts` | Align the `correctProfileForInterval` function with the new logic |

### Backwards Compatibility

- Existing meters without `value_unit` will default to `'kWh'`, which matches most SA SCADA exports
- The fix will immediately correct the chart values for all existing data
- No re-import of data is required

