
## Update AI Tariff Parsing Engine to NERSA Schema

### Problem

The `process-tariff-file` edge function (1,900+ lines) is the AI-powered engine that extracts tariff data from uploaded Excel/PDF files. It currently writes to **tables and columns that no longer exist** after the NERSA schema migration:

| What it writes to | Status |
|---|---|
| `tariffs` table | Does not exist (now `tariff_plans`) |
| `tariff_categories` table | Does not exist (category is now an enum on `tariff_plans`) |
| `extraction_runs` table | Does not exist |
| `eskom_batch_status` table | Does not exist |
| `municipalities.source_file_path` | Column removed |
| `municipalities.extraction_status` | Column removed |
| `municipalities.ai_confidence` | Column removed |
| `municipalities.total_tariffs` | Column removed |
| `municipalities.reprise_count` | Column removed |
| `tariff_rates.tariff_id` | Now `tariff_plan_id` |
| `tariff_rates.rate_per_kwh` | Now `amount` |
| `tariff_rates.season` (free text) | Now enum: `high`, `low`, `all` |
| `tariff_rates.time_of_use` (free text) | Now enum: `peak`, `standard`, `off_peak`, `all` |
| `tariff_rates.block_start_kwh` | Now `block_min_kwh` |
| `tariff_rates.block_end_kwh` | Now `block_max_kwh` |

The `FileUploadImport.tsx` UI component also uses old interfaces/field names in its preview and edit flows.

### Current NERSA Schema (target)

```text
tariff_plans:
  id, municipality_id, name, category (enum), structure (enum),
  voltage (enum), phase, scale_code, min_amps, max_amps,
  min_kva, max_kva, is_redundant, is_recommended, description

tariff_rates:
  id, tariff_plan_id, charge (enum: energy/basic/demand/reactive/...),
  season (enum: high/low/all), tou (enum: peak/standard/off_peak/all),
  block_number, block_min_kwh, block_max_kwh,
  consumption_threshold_kwh, is_above_threshold,
  amount, unit, notes

municipalities:
  id, province_id, name, nersa_increase_pct, financial_year
```

### Phase 1: Create Supporting Tables

Create two lightweight tables that were removed but are needed for extraction tracking:

**`extraction_runs`** - Tracks each AI extraction pass (useful for auditing and debugging):
- `id`, `municipality_id`, `run_type` (extraction/reprise), `tariffs_found`, `tariffs_inserted`, `tariffs_updated`, `tariffs_skipped`, `ai_confidence`, `ai_analysis`, `status`, `completed_at`, `created_at`

**`eskom_batch_status`** - Tracks Eskom's 15-batch extraction progress:
- `id`, `municipality_id`, `batch_index`, `batch_name`, `status`, `tariffs_extracted`, `created_at`, `updated_at`

### Phase 2: Update Edge Function - Database Writes

Rewrite the database interaction layer in `process-tariff-file/index.ts`:

1. **Remove all `tariff_categories` references** -- category is now a string enum on `tariff_plans` directly
2. **Replace `tariffs` table writes with `tariff_plans`**:
   - `tariff_type` -> `structure` (map: Fixed->flat, IBT->inclining_block, TOU->time_of_use)
   - `customer_category`/`category` -> `category` enum (map: Domestic->domestic, Commercial->commercial, etc.)
   - `voltage_level` -> `voltage` enum
   - `tariff_family` -> `scale_code`
   - `fixed_monthly_charge` -> stored as a `tariff_rates` row with `charge='basic'`
   - `demand_charge_per_kva` -> stored as a `tariff_rates` row with `charge='demand'`
   - Remove unbundled Eskom-specific flat columns (they become individual rate rows with appropriate `charge` types)
3. **Replace `tariff_rates` writes**:
   - `tariff_id` -> `tariff_plan_id`
   - `rate_per_kwh` -> `amount`
   - `season`: "All Year" -> `all`, "High/Winter" -> `high`, "Low/Summer" -> `low`
   - `time_of_use`: "Any" -> `all`, "Peak" -> `peak`, "Standard" -> `standard`, "Off-Peak" -> `off_peak`
   - `block_start_kwh` -> `block_min_kwh`
   - `block_end_kwh` -> `block_max_kwh`
   - Add `charge` field (default `energy`)
   - Add `unit` field (e.g. `c/kWh` or `R/kWh`)
4. **Remove municipality column writes** for columns that no longer exist (`source_file_path`, `extraction_status`, `ai_confidence`, `total_tariffs`, `reprise_count`, etc.)
5. **Update existing tariff queries** from `tariffs` to `tariff_plans` with correct column names
6. **Update reprise phase** (Phase 4) with same table/column mappings

### Phase 3: Update AI Tool Schema

Update the `save_tariffs` and `report_corrections` tool definitions sent to the AI model:
- Change `tariff_type` enum descriptions to map to structure values
- Update rate field names to match new schema
- Keep the AI extraction prompt logic intact (it's well-tuned for SA tariff documents)
- The AI still extracts in its natural format; the edge function maps to the NERSA schema before writing

### Phase 4: Update FileUploadImport.tsx

1. **Update `TariffRate` interface**: `rate_per_kwh` -> `amount`, `time_of_use` -> `tou`, `block_start_kwh` -> `block_min_kwh`, `block_end_kwh` -> `block_max_kwh`
2. **Update `ExtractedTariffPreview` interface**: `tariff_type` -> `structure`, remove `category: { name }` (now a string enum), remove `is_prepaid`, `fixed_monthly_charge`, `demand_charge_per_kva` (now derived from rates)
3. **Update preview query** (line ~383): Already partially updated but verify field names match
4. **Update `saveEditedTariff`** (line ~449): Write to `tariff_plans` with correct columns, write rates with `charge`, `amount`, `unit` fields
5. **Remove `municipalities.source_file_path`** references in extract-municipalities phase

### Phase 5: Deploy and Test

- Deploy the updated edge function
- Test with a sample Excel file upload to verify extraction writes to correct tables

### Files Changed

| File | Change |
|---|---|
| Database migration | Create `extraction_runs` and `eskom_batch_status` tables |
| `supabase/functions/process-tariff-file/index.ts` | Full rewrite of DB interaction layer (~400 lines) |
| `src/components/tariffs/FileUploadImport.tsx` | Update interfaces, preview query, and save mutation |
