
# Fix: Blended Tariff Rate Returns Zero for Flat-Rate Tariffs

## Root Cause

The `getCombinedRate()` function in `src/lib/tariffCalculations.ts` uses `rates.find()` to locate a matching rate row by `time_of_use` and `season`. However, **all rate rows** (including `basic`, `demand`, etc.) are passed into this function. Since both the `basic` charge row and the `energy` charge row share the same `time_of_use='Any'` and `season='All Year'`, the `find()` can return the `basic` row first — which has `rate_per_kwh: 0`.

This means the blended rate resolves to **R0.0000/kWh**, causing all revenue columns in the cashflow table to display zero.

## Fix

### 1. `src/lib/tariffCalculations.ts` — Filter to energy rates only

In `getCombinedRate()`, `getFlatRate()`, and `isFlatRateTariff()`, pre-filter the input `rates` array to only include rows where `rate_per_kwh > 0` (energy charges). Alternatively, add a `charge` field to the `TariffRate` interface and filter by `charge === 'energy'`.

The cleanest approach: update `getCombinedRate` and `getFlatRate` to filter out non-energy rates before calling `.find()`:

```typescript
// Filter to energy-bearing rates only (basic/demand rows have rate_per_kwh = 0)
const energyRates = rates.filter(r => Number(r.rate_per_kwh) > 0);
```

Then use `energyRates.find(...)` instead of `rates.find(...)` in the lookup chain.

### 2. `src/components/projects/simulation/AdvancedSimulationEngine.ts` — Fix double-counting bug

Line 448: `totalIncomeR = energyIncomeR + exportIncomeR + demandIncomeR`

`exportIncomeR` is already included in `energyIncomeR` (line 442). Change to:

```typescript
const totalIncomeR = energyIncomeR + demandIncomeR;
```

## Impact

- All rate and income columns in the cashflow table will display correct values
- LCOE, ROI, Savings, and Payback metrics will reflect the actual tariff rate
- The double-counting fix prevents export income from being added twice to total income
