

# Fix Eskom Tariff Display: Show All Charges and Correct Ordering

## Problem Summary

1. **Missing charges in UI**: The expanded tariff card only shows "Basic Charge" and "Demand Charge". It ignores legacy charge, generation capacity charge, transmission network charge, ancillary services, and electrification/rural subsidy -- even when these are already stored in the database.
2. **Missing charges in extraction**: The AI tool schema doesn't include fields for `ancillary_services_per_kwh` or `electrification_rural_per_kwh`, so these are never extracted from the PDF.
3. **Wrong tariff ordering**: Tariffs are shown alphabetically instead of following the PDF's Transmission Zone x Voltage matrix order (<=300km first, then >300-600km, etc.).

## What's Already in the Database (for Miniflex <= 300km < 500V)

| Charge | Amount | Unit | Notes |
|--------|--------|------|-------|
| basic | 198.52 | R/month | - |
| demand | 4.01 | R/kVA | - |
| demand | 49.85 | R/kVA | Generation capacity |
| network_demand | 57.33 | R/kVA | Transmission network |
| ancillary | 0.0023 | R/kWh | Legacy charge |
| energy (x6) | varies | R/kWh | Peak/Std/Off-Peak x High/Low |

Missing from extraction: electrification and rural network subsidy charge, ancillary services charge.

## Changes

### 1. Update the expanded tariff card UI to show ALL charge types

**File:** `src/components/tariffs/TariffList.tsx` (lines 762-789)

Replace the 4-item grid (Basic, Demand, Phase, Voltage) with a comprehensive charge display that renders ALL non-energy rates from the database:

```text
Basic Charge:        R 198.52/month
Demand Charge:       R 4.01/kVA
Gen Capacity:        R 49.85/kVA
Network (Tx):        R 57.33/kVA
Legacy Charge:       0.23 c/kWh
Ancillary Services:  (when available)
Elec & Rural Subsidy:(when available)
```

The display will dynamically render all charge types found in `tariffRates[tariff.id]` where `charge !== 'energy'`, using the `notes` field for labels where available (e.g. "Generation capacity"). This way any new charge types added in future extractions will automatically appear.

### 2. Add missing charge fields to AI extraction schema

**File:** `supabase/functions/process-tariff-file/index.ts` (lines 899-950)

Add to the tool function parameters:
- `ancillary_services_per_kwh` (number) - Ancillary services charge in c/kWh
- `electrification_rural_per_kwh` (number) - Electrification and rural network subsidy in c/kWh

### 3. Save the new charge types to tariff_rates

**File:** `supabase/functions/process-tariff-file/index.ts` (after line 1188)

Add rate row creation for the two new charges:
- `ancillary_services_per_kwh` -> charge: "ancillary", notes: "Ancillary services"
- `electrification_rural_per_kwh` -> charge: "ancillary", notes: "Electrification & rural subsidy"

### 4. Update AI extraction prompt to request these charges

**File:** `supabase/functions/process-tariff-file/index.ts` (Eskom extraction prompt ~line 868)

Add to the TABLE STRUCTURE GUIDE:
- Ancillary services charge [c/kWh]
- Electrification and rural network subsidy charge [c/kWh]

And to the field list in the prompt.

### 5. Fix tariff ordering within period groups

**File:** `src/components/tariffs/TariffList.tsx` (around line 710, inside `group.tariffs.map`)

Sort tariffs within each period group by:
1. `scale_code` (family name: Megaflex, Miniflex, etc.)
2. Transmission zone order: <=300km, >300-600km, >600-900km, >900km
3. Voltage order: <500V, >=500V&<66kV, >=66kV&<=132kV, >132kV

This matches the PDF's natural row order (Transmission Zone groups, with voltage sub-rows).

## Summary

| File | Change |
|------|--------|
| `TariffList.tsx` (lines 762-789) | Show all charge types dynamically, not just basic + demand |
| `TariffList.tsx` (line 710) | Sort tariffs by zone then voltage to match PDF order |
| `process-tariff-file/index.ts` (tool schema) | Add ancillary_services and electrification_rural fields |
| `process-tariff-file/index.ts` (rate saving) | Save the two new charge types to tariff_rates |
| `process-tariff-file/index.ts` (prompt) | Tell AI to extract the additional charges |

After these changes, re-extracting the Eskom PDF will capture all charge columns. Existing data already has legacy, gen capacity, and network charges -- those will immediately appear in the UI.
