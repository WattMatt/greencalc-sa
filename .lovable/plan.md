

## Issue Found

**Simulation engine**: Correctly uses overridden rates for blended rate calculations (All Hours & Solar Sun Hours). When you save overrides, the simulation's `tariffRates` memo updates, which triggers `annualBlendedRates` to recompute. The financial engine receives the correct values.

**TariffSelector UI (BlendedRatesCard)**: Does **not** reflect overrides. It passes `selectedTariff.tariff_rates` (raw DB data) directly to `BlendedRatesCard`, bypassing any project-level overrides. So the displayed blended rates in the tariff card remain unchanged even after editing rates.

## Plan

### 1. Pass overridden rates to BlendedRatesCard in TariffSelector

**File**: `src/components/projects/TariffSelector.tsx`

- The `TariffSelector` component needs to query `project_tariff_overrides` for the current project (it already has `projectId` available).
- If overrides exist, use them instead of `selectedTariff.tariff_rates` when rendering the `BlendedRatesCard`.
- This ensures the displayed blended rates match what the simulation engine uses.

The change is localized: fetch the override in `TariffSelector`, and swap the rates array passed to `BlendedRatesCard` on line 966-968.

### Technical Detail

```
// In TariffSelector, add a query for overrides:
const { data: tariffOverride } = useQuery(...)

// Use overridden rates if available:
const displayRates = tariffOverride?.overridden_rates 
  ? mapOverriddenRates(tariffOverride.overridden_rates)
  : mapDbRatesToTariffRates(selectedTariff.tariff_rates, ...)

// Pass to BlendedRatesCard:
<BlendedRatesCard rates={displayRates} ... />
```

### Files to modify
- `src/components/projects/TariffSelector.tsx` — Query project overrides and use them for BlendedRatesCard display

