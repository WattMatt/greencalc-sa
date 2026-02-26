
# Miniflex Tariff Table Structure Analysis and Extraction Enhancement

## Table Structure Breakdown

The Miniflex table (and similarly Megaflex, Ruraflex, etc.) has a **4-dimensional grid** that the current extraction prompt doesn't describe clearly enough:

### Dimensions
1. **Transmission Zone** (row groups) -- 4 zones:
   - <= 300km
   - > 300km and <= 600km
   - > 600km and <= 900km
   - > 900km

2. **Voltage Level** (sub-rows within each zone) -- 4 levels:
   - < 500V (maps to "LV")
   - >= 500V and < 66kV (maps to "MV")
   - >= 66kV and <= 132kV (maps to "HV")
   - > 132kV (maps to "HV")

3. **Season** (column groups) -- 2 seasons:
   - High demand season [Jun - Aug] (maps to season: "high")
   - Low demand season [Sep - May] (maps to season: "low")

4. **TOU Period** (sub-columns) -- 3 periods:
   - Peak, Standard, Off-Peak

### Additional Charges (right-side columns)
- **Legacy charge** [c/kWh] -- a flat energy surcharge (season: "all", tou: "all")
- **Generation capacity charge** [R/kVA/m] -- a demand-type charge
- **Transmission network charges** [R/kVA/m] -- another demand-type charge

### Total Expected Output per Miniflex Table
Each Transmission Zone x Voltage combination = **1 tariff_plan**, giving us **16 tariff plans** (4 zones x 4 voltages).

Each tariff_plan gets:
- 6 energy rates (Peak/Standard/Off-Peak x High/Low)
- 1 legacy charge rate
- 1 generation capacity charge
- 1 transmission network charge
- = **9 tariff_rate rows** per plan

**Total: 16 plans x 9 rates = 144 rate rows** for a complete Miniflex extraction.

### How This Maps to the Current Schema

The existing schema supports this perfectly:
- `tariff_plans.name` = e.g. "Miniflex <= 300km < 500V"
- `tariff_plans.voltage` = "low" / "medium" / "high"
- `tariff_plans.scale_code` = "Miniflex" (tariff family)
- `tariff_rates.charge` = "energy" / "demand" / "network_demand" / "ancillary"
- `tariff_rates.season` = "high" / "low" / "all"
- `tariff_rates.tou` = "peak" / "standard" / "off_peak" / "all"
- `tariff_rates.notes` = Transmission zone label (e.g. "<= 300km")

## Changes Required

### File: `supabase/functions/process-tariff-file/index.ts`

**1. Update the Eskom extraction prompt (line ~868)** to include explicit Miniflex/Megaflex table structure instructions:

Add a detailed "TABLE STRUCTURE GUIDE" section to the Eskom extraction prompt that tells the AI:
- Each row group is a **Transmission Zone** -- this MUST become part of the tariff_name
- Each sub-row is a **Voltage Level** -- this maps to voltage_level
- Create **one tariff per zone+voltage combination** (e.g. "Miniflex <= 300km < 500V")
- Extract 6 energy rates per tariff (3 TOU periods x 2 seasons)
- Extract legacy charge as a separate rate with charge type "ancillary" or energy with notes "Legacy"
- Extract generation capacity and transmission network charges as demand-type rates
- Values in the table are in **c/kWh** (divide by 100 for R/kWh)
- Demand charges are in **R/kVA/m** (use as-is)

**2. Add `transmission_zone` and `network_charge` fields to the AI tool schema (line ~910)**:

Add to the `save_tariffs` function parameters:
- `transmission_zone`: string field for the zone label
- `network_charge_per_kva`: number for transmission network charge
- `legacy_charge_per_kwh`: number for legacy surcharge
- `generation_capacity_charge_per_kva`: number for gen capacity

**3. Update the rate row builder (line ~1102)** to handle the new charge types:

After the existing demand charge block, add:
- Legacy charge -> `charge: "ancillary"`, `unit: "R/kWh"`, `notes: "Legacy charge"`
- Generation capacity -> `charge: "demand"`, `unit: "R/kVA"`, `notes: "Generation capacity"`
- Transmission network -> `charge: "network_demand"`, `unit: "R/kVA"`, `notes: "Transmission network"`

Also store the transmission zone in the `notes` field of the tariff_rates, or encode it in the tariff_plan name.

**4. Update the Miniflex batch description (line ~647)**:

Change the Miniflex batch `description` to include the table structure hint so the AI knows exactly what to look for:

```
"Urban TOU for 25kVA-5MVA NMD. TABLE FORMAT: Rows grouped by Transmission Zone (<=300km, >300-600km, >600-900km, >900km) with sub-rows per Voltage (<500V, >=500V&<66kV, >=66kV&<=132kV, >132kV). Columns: High demand (Jun-Aug) Peak/Standard/Off-Peak, Low demand (Sep-May) Peak/Standard/Off-Peak, Legacy charge, Gen capacity, Transmission network. Create ONE tariff per zone+voltage combo (16 total). Values in c/kWh (divide by 100)."
```

Apply the same structure hint to Megaflex, Megaflex Gen, Ruraflex, and Ruraflex Gen batches since they share identical table layouts.

### Deployment
Redeploy the `process-tariff-file` edge function after changes.

## Summary of Edits
- **1 file**: `supabase/functions/process-tariff-file/index.ts`
  - Enhanced Eskom extraction prompt with table structure guide
  - Added new charge fields to AI tool schema
  - Updated rate row builder for legacy/gen/network charges
  - Updated batch descriptions for Miniflex, Megaflex, Ruraflex families
- **Redeploy** edge function
