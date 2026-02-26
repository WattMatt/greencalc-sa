

# Fix Missing Charges and Remove Incorrect Phase Default for Eskom Tariffs

## Problem 1: Three charges not being extracted

Service charge, Administration charge, and Urban low voltage subsidy are in separate lookup tables in the Eskom PDF (indexed by customer category or voltage level), NOT in the per-tariff-variant matrix. The AI extraction currently only looks at the main matrix and misses these.

From the PDF:
- **Service charge** [R/POD/day]: Indexed by customer category (kVA ranges like <= 100 kVA, > 100 kVA & <= 500 kVA, etc.)
- **Administration charge** [R/POD/day]: Same customer category index
- **Urban low voltage subsidy** [R/kVA/m]: Indexed by voltage level (< 500V, >= 500V & < 66kV, etc.)

## Problem 2: Phase incorrectly set to "Single Phase"

Line 1058 in the edge function has: `phase: tariff.phase_type || "Single Phase"`. Eskom tariffs do not have a phase attribute, so the AI correctly returns nothing, but the fallback hardcodes "Single Phase".

## Changes

### 1. Fix phase default for Eskom tariffs

**File:** `supabase/functions/process-tariff-file/index.ts` (~line 1058)

Change the phase assignment to skip the "Single Phase" default when processing an Eskom extraction:

```text
phase: isEskomExtraction ? (tariff.phase_type || null) : (tariff.phase_type || "Single Phase"),
```

### 2. Update AI extraction prompt to request the three missing charges from their separate PDF tables

**File:** `supabase/functions/process-tariff-file/index.ts` (Eskom extraction prompt)

Add explicit instructions telling the AI to:
- Find the "Service charge" and "Administration charge" table (indexed by customer category / kVA range) and map the correct row to each tariff variant based on its capacity
- Find the "Urban low voltage subsidy charge" table (indexed by voltage level) and map the correct row to each tariff variant based on its voltage

### 3. Fix unit descriptions in schema for service and admin charges

**File:** `supabase/functions/process-tariff-file/index.ts` (~lines 928-929)

- `service_charge_per_day`: Already correct (R/account/day)
- `administration_charge_per_kwh`: Wrong unit -- the PDF shows R/POD/day, not c/kWh. Rename to `administration_charge_per_day` with unit R/day.

### 4. Fix admin charge saving logic to use R/day instead of c/kWh conversion

**File:** `supabase/functions/process-tariff-file/index.ts` (~lines 1237-1248)

Currently divides by 100 (assuming c/kWh). Change to store as R/day directly (no conversion), matching the PDF's actual unit.

### 5. Fix urban low voltage subsidy unit

**File:** `supabase/functions/process-tariff-file/index.ts` (~line 931)

The PDF shows this charge in R/kVA/month, not c/kWh. Update schema field to `urban_low_voltage_subsidy_per_kva` with description "Urban low voltage subsidy in R/kVA/month" and update the saving logic to store with unit "R/kVA" (no c/kWh division).

### 6. Remove duplicate network_demand_charge_per_kva field

The `network_demand_charge_per_kva` field (line 930) is redundant with the existing `network_charge_per_kva` field (line 925) -- both capture the same Transmission network charge. Remove the duplicate field and its saving block (~lines 1250-1261) to avoid double-counting.

## Summary

| File | Change |
|------|--------|
| `process-tariff-file/index.ts` (line 1058) | Use null instead of "Single Phase" for Eskom tariffs |
| `process-tariff-file/index.ts` (prompt) | Tell AI to extract service/admin/urban LV subsidy from their separate PDF tables |
| `process-tariff-file/index.ts` (schema) | Fix admin charge unit to R/day, urban LV subsidy to R/kVA |
| `process-tariff-file/index.ts` (saving) | Fix unit conversions for admin and urban LV subsidy; remove duplicate network_demand |

After deploying, re-extract the Eskom PDF to capture the corrected data. Existing tariffs will need the phase column cleared (a one-time SQL update for Eskom municipality tariffs).
