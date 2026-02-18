

## Align Tariff Management Dashboard with NERSA Database Schema

### Problem

The database was migrated to a new NERSA-compliant schema (`tariff_plans` + `tariff_rates` with enums), but 4 out of 7 tariff UI components still reference old column names that no longer exist. Additionally, all 4 core tables are empty (0 provinces, 0 municipalities, 0 tariff_plans, 0 tariff_rates), so the dropdowns show nothing.

### Phase 1: Re-seed Provinces

Insert the 9 South African provinces + Eskom back into the `provinces` table so the province dropdown works immediately.

### Phase 2: Update TariffList.tsx (the main tariff display)

**Current problem:** The `Tariff` and `TariffRate` interfaces reference ~20 fields that no longer exist in the database.

- Replace the `Tariff` interface to match `tariff_plans` columns: `category` (enum), `structure` (enum), `voltage`, `phase`, `scale_code`, `min_amps`, `max_amps`, `min_kva`, `max_kva`, `is_redundant`, `is_recommended`
- Replace the `TariffRate` interface to match `tariff_rates` columns: `charge`, `season` (high/low/all), `tou` (peak/standard/off_peak/all), `amount`, `unit`, `block_number`, `block_min_kwh`, `block_max_kwh`
- Remove references to `total_tariffs` and `source_file_path` on municipalities (these columns do not exist)
- Update the query joins: `tariff_plans` -> `municipalities(name, province_id)` (no `category` relation -- category is now an enum field)
- Update display logic: replace `tariff.tariff_type` with `tariff.structure`, `rate.rate_per_kwh` with `rate.amount`, `rate.time_of_use` with `rate.tou`, `tariff.fixed_monthly_charge` with a derived lookup from rates where `charge='basic'`
- Update badges and labels to show the new enum values (e.g. `time_of_use` -> `TOU`, `flat` -> `Flat`)

### Phase 3: Update TariffEditDialog.tsx

- Same interface alignment as TariffList
- Update the save mutation to write `charge`, `season`, `tou`, `amount`, `unit` instead of old field names
- Remove fields that no longer exist (`effective_from`, `effective_to`, `tariff_family`, `voltage_level`, etc.)

### Phase 4: Update EskomTariffMatrix.tsx

- Align the `Tariff` and `TariffRate` interfaces to the new schema
- Replace field references: `tariff_family` -> group by `scale_code` or `name` prefix, `voltage_level` -> `voltage`, `transmission_zone` -> removed, `rate_per_kwh` -> `amount`

### Phase 5: Update ProvinceFilesManager.tsx

- Remove references to `municipalities.status`, `municipalities.confidence`, `municipalities.source_file_path`, `municipalities.total_tariffs` (none of these columns exist)
- Query municipality count per province from actual `municipalities` table
- Query tariff count from `tariff_plans` grouped by municipality

### Phase 6: Update MunicipalityManager.tsx (minor)

- The `increase_percentage` field in the insert mutation should map to `nersa_increase_pct` (already correct in display but the insert may not match)

### Files Changed

| File | Change |
|------|--------|
| Database migration | Re-seed 9 provinces + Eskom |
| `src/components/tariffs/TariffList.tsx` | Full interface + query + display alignment |
| `src/components/tariffs/TariffEditDialog.tsx` | Interface + save mutation alignment |
| `src/components/tariffs/EskomTariffMatrix.tsx` | Interface alignment |
| `src/components/tariffs/ProvinceFilesManager.tsx` | Remove non-existent column references |
| `src/components/tariffs/MunicipalityManager.tsx` | Minor insert field fix |

### What Stays Unchanged

- `TariffBuilder.tsx` -- already writes to the new schema correctly
- `TOUReference.tsx`, `NERSAGuidelines.tsx`, `LoadSheddingStages.tsx` -- these are reference/static content, no database queries
- `MunicipalityMap.tsx` -- uses basic municipality fields that still exist
- `src/lib/tariffCalculations.ts` -- calculation engine uses its own interfaces, not database types directly

### Technical Details

**Old field -> New field mapping:**

```text
tariff_plans:
  tariff_type        -> structure (enum: flat, time_of_use, inclining_block)
  tariff_family      -> scale_code (text)
  voltage_level      -> voltage (enum: LV, MV, HV)
  customer_category  -> category (enum: domestic, commercial, industrial, agriculture, street_lighting)
  phase_type         -> phase (text)
  amperage_limit     -> min_amps / max_amps (numeric)
  fixed_monthly_charge    -> (derived from tariff_rates where charge='basic')
  demand_charge_per_kva   -> (derived from tariff_rates where charge='demand')
  transmission_zone       -> REMOVED
  is_prepaid              -> REMOVED
  has_seasonal_rates      -> (derived: check if rates have season != 'all')

tariff_rates:
  season (text)           -> season (enum: high, low, all)
  time_of_use (text)      -> tou (enum: peak, standard, off_peak, all)
  rate_per_kwh (numeric)  -> amount (numeric) + unit (text)
  block_start_kwh         -> block_min_kwh
  block_end_kwh           -> block_max_kwh
  demand_charge_per_kva   -> REMOVED (now charge='demand')
  network_charge_per_kwh  -> REMOVED
  ancillary_charge_per_kwh -> REMOVED

municipalities:
  source_file_path   -> REMOVED
  total_tariffs      -> REMOVED (derive via COUNT on tariff_plans)
  status             -> REMOVED
  confidence         -> REMOVED
```
