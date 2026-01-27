

# Add Comprehensive Tariff Edit Functionality with Validity Dates

## Overview
Enhance the tariff preview/edit functionality to allow full editing of tariff data (including energy rates) and add date validity tracking for tariffs.

---

## Part 1: Database Migration - Add Validity Date Columns

### New Columns on `tariffs` Table
Add two new date columns to track when tariffs are valid:

```sql
ALTER TABLE tariffs 
ADD COLUMN effective_from DATE DEFAULT '2025-07-01',
ADD COLUMN effective_to DATE DEFAULT '2026-06-30';
```

**Rationale**: South African tariffs typically run from 1 July to 30 June each financial year. These columns allow:
- Filtering tariffs by validity period
- Displaying which tariffs are current vs. expired
- Warning users when using outdated tariffs

---

## Part 2: Enhanced Edit Mode in Preview Dialog

### Current State
The existing edit mode in `TariffList.tsx` only allows editing 4 fields:
- Basic Charge
- Demand Charge
- Phase Type
- Amperage Limit

### Enhanced Edit Mode Features

**A. Tariff Header Fields (New)**
- Tariff Name
- Customer Category
- Tariff Type (Fixed/TOU/IBT dropdown)
- Effective From / Effective To dates

**B. Fixed Charges Section (Expanded)**
Current fields plus:
- Network Access Charge
- Service Charge per Day
- Administration Charge per Day
- Reactive Energy Charge
- Generation Capacity Charge

**C. Energy Rates Section (New)**
Enable inline editing of individual rate rows:
- Rate per kWh (editable input)
- Season selector (All Year/High-Winter/Low-Summer)
- Time of Use selector (Peak/Standard/Off-Peak/Any)
- Block Start/End for IBT tariffs
- Add/Remove rate rows

---

## Part 3: UI Implementation

### File: `src/components/tariffs/TariffList.tsx`

**Changes to Tariff Interface**:
```typescript
interface Tariff {
  // ... existing fields
  effective_from: string | null;
  effective_to: string | null;
}
```

**Enhanced Edit Form Layout**:

```text
+---------------------------------------------------+
| Tariff Name: [Three Phase Commercial       ] [v] |
| Category: [Industrial v]  Type: [Fixed v]        |
+---------------------------------------------------+
| Validity Period                                   |
| From: [2025-07-01]    To: [2026-06-30]           |
+---------------------------------------------------+
| Fixed Charges                                     |
| Basic Charge     | [R 2636.31  ]  /month         |
| Demand Charge    | [R 393.40   ]  /kVA           |
| Phase Type       | [Three Phase v]                |
| Amperage         | [>100A       ]                 |
| Network Access   | [R 0.00     ]  /month         |
+---------------------------------------------------+
| Energy Rates                                      |
| Season     | Time of Use | Rate (c/kWh) | Actions |
|------------|-------------|--------------|---------|
| All Year   | Any         | [142.00    ] | [x]     |
| ----------------------------------------[+ Add]  |
+---------------------------------------------------+
| [Cancel]                              [Save All] |
+---------------------------------------------------+
```

**Edit Rate Row Component**:
- Inline inputs for each rate field
- Delete button to remove a rate
- Add Row button to insert new rate entries

**Save Operation**:
1. Update `tariffs` table with header fields
2. For each modified rate, update `tariff_rates` table
3. Insert any new rates
4. Delete any removed rates
5. Invalidate queries and show success toast

---

## Part 4: Display Validity Badges

### Show Tariff Status
In both the list view and preview:
- **Current**: Green badge if today is within `effective_from` - `effective_to`
- **Upcoming**: Blue badge if `effective_from` is in the future
- **Expired**: Red badge if `effective_to` is in the past

Example badge display:
```
Bulk Supply >100A 3Phase - High Voltage
Industrial | Fixed | Valid: Jul 2025 - Jun 2026 [Current]
```

---

## Technical Details

### Database Update Mutation
```typescript
const updateTariff = useMutation({
  mutationFn: async (data: {
    tariff: Partial<Tariff>;
    rates: TariffRate[];
    deletedRateIds: string[];
  }) => {
    // 1. Update tariff record
    await supabase.from("tariffs")
      .update({
        name: data.tariff.name,
        fixed_monthly_charge: data.tariff.fixed_monthly_charge,
        demand_charge_per_kva: data.tariff.demand_charge_per_kva,
        phase_type: data.tariff.phase_type,
        amperage_limit: data.tariff.amperage_limit,
        effective_from: data.tariff.effective_from,
        effective_to: data.tariff.effective_to,
        // ... other fields
      })
      .eq("id", data.tariff.id);
    
    // 2. Update existing rates
    for (const rate of data.rates.filter(r => !r.isNew)) {
      await supabase.from("tariff_rates")
        .update({ rate_per_kwh: rate.rate_per_kwh, ... })
        .eq("id", rate.id);
    }
    
    // 3. Insert new rates
    const newRates = data.rates.filter(r => r.isNew);
    if (newRates.length) {
      await supabase.from("tariff_rates")
        .insert(newRates.map(r => ({
          tariff_id: data.tariff.id,
          rate_per_kwh: r.rate_per_kwh,
          season: r.season,
          time_of_use: r.time_of_use,
          ...
        })));
    }
    
    // 4. Delete removed rates
    if (data.deletedRateIds.length) {
      await supabase.from("tariff_rates")
        .delete()
        .in("id", data.deletedRateIds);
    }
  }
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/tariffs/TariffList.tsx` | Expand edit form, add date fields, add rate editing, add validity badges |
| Database Migration | Add `effective_from` and `effective_to` columns to `tariffs` table |

---

## Implementation Order

1. **Database Migration**: Add validity date columns
2. **Update Tariff Interface**: Add new date fields to TypeScript types
3. **Expand Edit Form**: Add all editable fields including dates
4. **Add Rate Editing**: Enable inline editing of energy rates
5. **Add Validity Badges**: Show current/expired/upcoming status
6. **Test & Validate**: Ensure saves work correctly and data persists

