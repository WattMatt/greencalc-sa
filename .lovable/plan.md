

# Fix Blended Tariff Rate Calculation for Seasonal Non-TOU Tariffs

## Problem Summary

The "Low Voltage Supply (Commercial and Business)" tariff from EMALAHLENI has:
- **High Season (Winter)**: R3.4309/kWh with `time_of_use: "Any"`
- **Low Season (Summer)**: R1.9179/kWh with `time_of_use: "Any"`

The Blended Tariff Rates panel displays **R0.0000/kWh** for all values because the calculation logic doesn't handle this tariff structure.

## Root Cause

The `getCombinedRate()` function in `src/lib/tariffCalculations.ts` has a gap in its fallback logic:

```text
Current Logic:
1. Look for TOU-specific rate (Peak/Standard/Off-Peak) for the season → No match (TOU is "Any")
2. Fallback: Look for flat rate (Any TOU + All Year season) → No match (season is High/Winter or Low/Summer)
3. Return 0 → PROBLEM
```

This tariff is a **"seasonal non-TOU" tariff** - it has seasonal variation but uses the same rate for all hours within each season. This is a valid tariff structure not currently handled.

## Solution

Add an intermediate fallback in `getCombinedRate()` to check for "Any" TOU rates that match the requested season:

```text
New Logic:
1. Look for TOU-specific rate (Peak/Standard/Off-Peak) for the season
2. NEW: If not found, look for "Any" TOU rate for the same season
3. Fallback: Look for flat rate (Any TOU + All Year season)
4. Return 0 only if all fallbacks fail
```

---

## Technical Implementation

### File: `src/lib/tariffCalculations.ts`

**Function: `getCombinedRate()`** (lines 121-152)

Add a new fallback between the TOU-specific search and the flat-rate fallback:

```typescript
export function getCombinedRate(
  rates: TariffRate[], 
  timeOfUse: 'Peak' | 'Standard' | 'Off-Peak', 
  season: 'high' | 'low',
  tariff?: { legacy_charge_per_kwh?: number }
): number {
  const seasonFilter = season === 'high' ? 'High/Winter' : 'Low/Summer';
  
  // 1. First try: TOU-specific rate for the season
  let rate = rates.find(r => 
    r.time_of_use === timeOfUse && 
    (r.season === seasonFilter || r.season?.includes(season === 'high' ? 'High' : 'Low'))
  );
  
  // 2. NEW: Fallback to "Any" TOU rate for the same season (seasonal non-TOU tariffs)
  if (!rate) {
    rate = rates.find(r => 
      (r.time_of_use === 'Any' || !r.time_of_use) &&
      (r.season === seasonFilter || r.season?.includes(season === 'high' ? 'High' : 'Low'))
    );
  }
  
  // 3. Final fallback: flat rate (All Year + Any TOU)
  if (!rate) {
    rate = rates.find(r => 
      (r.time_of_use === 'Any' || !r.time_of_use) &&
      (r.season === 'All Year' || !r.season)
    );
  }
  
  if (!rate) return 0;
  
  // Calculate combined rate with all unbundled charges
  const base = Number(rate.rate_per_kwh) || 0;
  const legacy = Number(tariff?.legacy_charge_per_kwh) || 0;
  const network = Number(rate.network_charge_per_kwh) || 0;
  const ancillary = Number(rate.ancillary_charge_per_kwh) || 0;
  const elecRural = Number(rate.electrification_rural_per_kwh) || 0;
  const affordability = Number(rate.affordability_subsidy_per_kwh) || 0;
  
  return base + legacy + network + ancillary + elecRural + affordability;
}
```

---

## Expected Results After Fix

For the EMALAHLENI tariff with R3.4309/kWh (Winter) and R1.9179/kWh (Summer):

| Metric | All Hours (24/7) | Solar Hours (6h) |
|--------|------------------|------------------|
| High (Winter) | R3.4309/kWh | R3.4309/kWh |
| Low (Summer) | R1.9179/kWh | R1.9179/kWh |
| Annual Blended | ~R2.30/kWh | ~R2.30/kWh |

Since this is a non-TOU tariff, Peak/Standard/Off-Peak will all use the same seasonal rate, making the blended calculation simply the weighted average of seasonal rates by hours.

---

## Testing Considerations

1. **Verify the fix** with the EMALAHLENI "Low Voltage Supply" tariff - should show correct seasonal rates
2. **Regression test** existing TOU tariffs (e.g., Megaflex, Miniflex) to ensure they still work correctly
3. **Test flat-rate tariffs** (All Year + Any) to ensure the final fallback still works

