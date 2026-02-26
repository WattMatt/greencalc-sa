

# Add Blended Rates Card to Tariff Selection Detail View

## Problem

The `BlendedRatesCard` component is fully implemented in `TariffSelector.tsx` (line 150) with All Hours / Solar Sun Hours selection, annual/high/low breakdowns, and click-to-select for simulation. However, it is **never rendered** in the selected tariff detail section. This means no blended rate selection is shown for any tariff -- Eskom or otherwise.

## Root Cause

There are two issues:
1. The `BlendedRatesCard` render call is simply missing from the tariff detail card (lines 756-862).
2. A **data shape mismatch** exists: the DB `tariff_rates` rows use fields `charge`, `amount`, `tou`, `season` (e.g., `charge: 'energy', tou: 'peak', season: 'high', amount: 3.50`), but the `BlendedRatesCard` and its underlying `calculateAnnualBlendedRates()` function expect the `TariffRate` interface with `rate_per_kwh`, `time_of_use`, `season` (e.g., `rate_per_kwh: 3.50, time_of_use: 'Peak', season: 'High/Winter'`).

## Solution

### 1. Add a mapping function to convert DB tariff_rates to TariffRate shape

Add a helper function in `TariffSelector.tsx` that converts raw DB rows into the `TariffRate` interface format:

- Filter to `charge === 'energy'` rows only (the blended calc only uses energy rates)
- Map `amount` to `rate_per_kwh`
- Map `tou` values: `peak` -> `Peak`, `standard` -> `Standard`, `off_peak` -> `Off-Peak`, `all` -> `Any`
- Map `season` values: `high` -> `High/Winter`, `low` -> `Low/Summer`, `all` -> `All Year`
- Map ancillary/network/subsidy charges from other rows onto matching energy rows as `network_charge_per_kwh`, `ancillary_charge_per_kwh`, etc.

### 2. Render BlendedRatesCard in the tariff detail section

After the energy rates block (line 859), add:

```tsx
<BlendedRatesCard
  rates={mapDbRatesToTariffRates((selectedTariff as any).tariff_rates)}
  tariff={{ legacy_charge_per_kwh: legacyCharge }}
  selectedType={selectedBlendedRateType}
  onTypeChange={onBlendedRateTypeChange}
/>
```

Where `legacyCharge` is extracted from the `ancillary` charge row (if present) in the tariff_rates.

### Files Changed

| File | Change |
|------|--------|
| `src/components/projects/TariffSelector.tsx` | Add `mapDbRatesToTariffRates()` helper function. Render `BlendedRatesCard` inside the selected tariff detail card after the energy rates section. |

### Result

After this change, selecting any tariff (Eskom or municipal) will show the blended rate selector with All Hours (Annual/High/Low) and Solar Sun Hours (Annual/High/Low) options. Clicking a rate selects it for use in the simulation engine.

