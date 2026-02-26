
# Fix Eskom Tariff Selection to Match Standard Province Flow

## Problem 1: Eskom uses a custom UI instead of the standard 4-dropdown flow

When Eskom is selected as a province, the Year and Tariff dropdowns are hidden (lines 727, 753 in TariffSelector.tsx) and replaced by a completely separate `EskomTariffSelector` component with family tabs, transmission zone collapsibles, and voltage groupings. The user expects the same Province -> Municipality -> Year -> Tariff dropdown flow that normal provinces use.

## Problem 2: Selected Eskom tariff details are empty

The `EskomTariffSelector` component (lines 121-151) maps tariff data to a legacy interface but:
- Sets `legacy_charge_per_kwh: null` instead of finding the legacy ancillary charge
- Sets `generation_capacity_charge: null` instead of reading the capacity charge
- Sets `transmission_zone: null` so all tariffs group under "No Zone"
- Divides energy `r.amount / 100` (line 148) assuming c/kWh, but the data is already stored in R/kWh
- Does not map network demand, subsidy, surcharge, or other unbundled charges to the rate display

## Solution

Remove the Eskom-specific branching in `TariffSelector.tsx` so Eskom uses the exact same 4-dropdown flow as every other province. The standard flow already works because the data structure is identical (tariff_plans with tariff_rates).

### Changes to `src/components/projects/TariffSelector.tsx`

1. **Remove the `isEskomSelected` guard on the Year dropdown** (line 727): Show the Year dropdown for Eskom too. The Eskom tariffs have `effective_from`/`effective_to` fields just like regular municipality tariffs.

2. **Remove the `isEskomSelected` guard on the Tariff dropdown** (line 753): Show the Tariff dropdown for Eskom too.

3. **Remove the `isEskomSelected` guard on the tariff query** (line 574): Allow the standard tariff query to run for Eskom municipalities. Currently `enabled: !!municipalityId && !isEskomSelected` blocks it.

4. **Remove the `isEskomSelected` guard on the selected tariff query** (line 658): Allow the selected tariff detail query to run for Eskom too.

5. **Remove the Eskom Matrix Selector block** (lines 776-785): Remove the `EskomTariffSelector` component rendering entirely from this file.

6. **Remove the `isEskomSelected` guard on the regular tariff display** (line 788): Show the standard tariff detail card for Eskom tariffs too.

7. **Remove the auto-select "Eskom Direct" logic** (lines 459-467): This references a non-existent "Eskom Direct" municipality. The actual municipality is "Non-Local Authority" and should be selected manually like any other municipality.

8. **Remove the EskomTariffSelector import** (line 10).

### Result

After these changes, selecting Eskom as province will show the Municipality dropdown (with "Non-Local Authority"), then the Year dropdown (with the extraction period), then the Tariff dropdown (listing all Miniflex variants by name). Selecting a tariff will display the standard detail card with energy rates, reactive energy, and other charges -- all rendered from the `tariff_rates` rows directly, no broken mapping layer in between.

### Files Changed

| File | Change |
|------|--------|
| `src/components/projects/TariffSelector.tsx` | Remove all `isEskomSelected` conditional branches and the EskomTariffSelector import. Eskom now follows the identical Province -> Municipality -> Year -> Tariff flow. |

Note: The `EskomTariffSelector.tsx` file is not deleted as it may still be used by the Tariff Management dashboard. Only its usage in the project-level tariff selection is removed.
