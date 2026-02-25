

# TOU Settings Card UI and Legend Updates

## Summary
Update the TOU Settings Card to:
1. Remove the helper sentence about selected months
2. Redesign the legend with season colours (High-Demand Indigo, Low-Demand Violet) alongside existing period colours
3. Rename "High-Demand Season Months" to "Demand Season Months" with month badges toggling between High (Indigo) and Low (Violet) colours
4. No database schema changes needed -- the existing `tariff_rates` table already has `season` (high/low/all) and `tou` (peak/standard/off_peak/all) columns that align with the TOU settings

## Changes

### 1. `src/components/projects/load-profile/types.ts`
- Add `SEASON_COLORS` constant alongside `TOU_COLORS`:
  - High-Demand: Deep Indigo `hsl(230 70% 50%)`
  - Low-Demand: Soft Violet `hsl(270 50% 60%)`

### 2. `src/components/settings/TOUSettingsCard.tsx`
- **Remove** the paragraph: "Selected months use High-Demand Season periods. All other months use Low-Demand."
- **Update legend** to show all 5 items in order: High-Demand, Low-Demand, Peak, Standard, Off-Peak (using `SEASON_COLORS` for the first two)
- **Rename** heading from "High-Demand Season Months" to "Demand Season Months"
- **Update month badges**: Instead of toggling between `default`/`outline` variants, each badge gets a background colour:
  - High-season months: Indigo background (from `SEASON_COLORS`)
  - Low-season months: Violet background (from `SEASON_COLORS`)
  - Clicking toggles the month between high and low season (no "unselected" state -- every month is always one or the other)

### Technical Details
- The `highSeasonMonths` array in `TOUSettings` already drives which months are high vs low season
- `toggleMonth` logic remains the same -- months not in `highSeasonMonths` are implicitly low-demand
- All simulation consumers (`getTOUPeriod`, `touPeriodToWindows`, chart background shading) already use `highSeasonMonths` to determine the season, so no additional wiring is needed
- The `tariff_rates` table's `season` enum (high/low/all) already maps correctly to the TOU settings

