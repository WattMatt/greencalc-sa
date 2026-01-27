
# Fix: Display Flat-Rate Tariffs Correctly

## Problem Summary
The "Three Phase Commercial (Conventional)" tariff from POLOKWANE has a valid energy rate of **R3.2622/kWh** stored in the database, but it shows as R0.0000 because:

1. The rate is stored as a **flat rate** with `season: 'All Year'` and `time_of_use: 'Any'`
2. The display code only shows rates that match "High/Winter" or "Low/Summer" seasons
3. The blended rate calculation only looks for "Peak", "Standard", and "Off-Peak" time-of-use values

## Solution Overview
Update the TariffSelector component and tariff calculation logic to properly handle fixed/flat-rate tariffs alongside TOU tariffs.

## Implementation Steps

### Step 1: Update Energy Rates Display in TariffSelector
**File:** `src/components/projects/TariffSelector.tsx`

Add logic to detect and display flat-rate tariffs differently:
- Check if rates contain only "All Year" / "Any" entries (indicating a flat-rate tariff)
- If flat-rate: Display a single rate card showing the flat rate
- If TOU: Keep existing High/Low season display

### Step 2: Update Blended Rate Calculation
**File:** `src/lib/tariffCalculations.ts`

Modify `getCombinedRate()` and `calculateAnnualBlendedRates()` to handle flat rates:
- If no TOU-specific rates are found, fall back to checking for "Any" time_of_use and "All Year" season
- Use that flat rate for all blended calculations (since it applies equally to all hours)

### Step 3: Update BlendedRatesCard Display
**File:** `src/components/projects/TariffSelector.tsx`

When displaying blended rates for a flat-rate tariff:
- Show the flat rate consistently across all columns (All Hours, Solar Hours, High/Low seasons)
- Consider adding a visual indicator that this is a "Flat Rate" tariff with no TOU variation

---

## Technical Details

### Detection Logic for Flat-Rate Tariffs
```typescript
const isFlat = rates.every(r => 
  (r.season === 'All Year' || !r.season) && 
  (r.time_of_use === 'Any' || !r.time_of_use)
);
```

### Fallback in getCombinedRate()
```typescript
// If no TOU-specific rate found, check for flat rate
if (!rate) {
  rate = rates.find(r => 
    (r.time_of_use === 'Any' || !r.time_of_use) &&
    (r.season === 'All Year' || !r.season)
  );
}
```

### Display Logic for Flat Rates
Instead of showing empty High/Low season grids, show:
- A single "Flat Rate" section
- The rate value (R3.2622/kWh in this case)
- A note explaining "This tariff has a fixed rate regardless of season or time of day"

---

## Files to Modify
1. `src/components/projects/TariffSelector.tsx` - Display logic for energy rates and blended rates card
2. `src/lib/tariffCalculations.ts` - Calculation logic fallback for flat rates

## Expected Result
After implementation:
- The Three Phase Commercial tariff will display R3.2622/kWh correctly
- Blended rates will show R3.2622/kWh across all scenarios (since there's no TOU variation)
- Users will clearly see this is a flat-rate tariff without seasonal or TOU variation
