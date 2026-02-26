

# Add All Missing Eskom Charge Types to Extraction and Display

## Problem
Each Eskom tariff (e.g. Miniflex <= 300km < 500V) has up to 14 distinct charge line items from the PDF schedule. Currently only 7 are captured. The remaining 7 are missing from the AI extraction schema entirely.

## Full Charge List Per Eskom Tariff

| # | Charge | Unit | Current Status |
|---|--------|------|---------------|
| 1 | Active energy (Peak/Std/Off-Peak x High/Low) | c/kWh | Captured |
| 2 | Basic charge | R/month | Captured (as `basic`) |
| 3 | Demand charge | R/kVA | Captured (as `demand`) |
| 4 | Generation capacity charge | R/kVA | Captured (as `demand` with notes) |
| 5 | Transmission network charge | R/kVA | Captured (as `network_demand`) |
| 6 | Legacy charge | c/kWh | Captured (as `ancillary` with notes) |
| 7 | Ancillary services charge | c/kWh | Schema exists, not yet re-extracted |
| 8 | Electrification & rural subsidy | c/kWh | Schema exists, not yet re-extracted |
| 9 | Service charge | R/account/day | **Missing** |
| 10 | Administration charge | c/kWh | **Missing** |
| 11 | Network demand charge | R/kVA | **Missing** |
| 12 | Urban low voltage subsidy | c/kWh | **Missing** |
| 13 | Affordability subsidy | c/kWh | **Missing** |
| 14 | Reactive energy charge | c/kVArh | **Missing** |

## Changes

### 1. Add 6 missing fields to AI extraction tool schema

**File:** `supabase/functions/process-tariff-file/index.ts` (tool parameters, ~line 926)

Add these fields to the tariff object schema:
- `service_charge_per_day` (number) -- Service charge in R/account/day
- `administration_charge_per_kwh` (number) -- Administration charge in c/kWh
- `network_demand_charge_per_kva` (number) -- Network demand charge in R/kVA/month
- `urban_low_voltage_subsidy_per_kwh` (number) -- Urban low voltage subsidy in c/kWh
- `affordability_subsidy_per_kwh` (number) -- Affordability subsidy in c/kWh
- `reactive_energy_charge_per_kvarh` (number) -- Reactive energy charge in c/kVArh

### 2. Save the 6 new charge types to tariff_rates

**File:** `supabase/functions/process-tariff-file/index.ts` (rate saving section, after existing ancillary/electrification saves)

Map each new field to a `tariff_rates` row:

| Extracted Field | charge | unit | notes |
|----------------|--------|------|-------|
| `service_charge_per_day` | `service` | `R/day` | "Service charge" |
| `administration_charge_per_kwh` | `admin` | `R/kWh` | "Administration charge" |
| `network_demand_charge_per_kva` | `network_demand` | `R/kVA` | "Network demand" |
| `urban_low_voltage_subsidy_per_kwh` | `subsidy` | `R/kWh` | "Urban low voltage subsidy" |
| `affordability_subsidy_per_kwh` | `subsidy` | `R/kWh` | "Affordability subsidy" |
| `reactive_energy_charge_per_kvarh` | `reactive` | `R/kVArh` | "Reactive energy" |

c/kWh values will be divided by 100 to store as R/kWh. c/kVArh divided by 100 to store as R/kVArh.

### 3. Update AI extraction prompt

**File:** `supabase/functions/process-tariff-file/index.ts` (Eskom prompt section)

Add all 6 new charges to the extraction instructions so the AI knows to look for them in the PDF tables.

### 4. UI already handles this dynamically

The previous change to `TariffList.tsx` already renders all non-energy rates dynamically from `tariffRates`, using the `notes` field for labels. No UI changes needed -- once the new charges are saved, they will automatically appear in the expanded tariff cards.

### 5. Re-extraction required

After deploying the updated edge function, the Eskom PDF will need to be re-extracted (or failed/pending batches re-triggered) to capture all 14 charge types.

## Technical Summary

| File | Change |
|------|--------|
| `process-tariff-file/index.ts` (tool schema) | Add 6 new charge fields |
| `process-tariff-file/index.ts` (rate saving) | Save 6 new charge types to `tariff_rates` |
| `process-tariff-file/index.ts` (prompt) | Tell AI to extract all charge columns |
| `TariffList.tsx` | No change needed (already dynamic) |

