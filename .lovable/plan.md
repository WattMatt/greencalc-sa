

# TOU Period Settings -- Settings Dashboard Integration

## Overview
Add a new **"TOU Periods"** tab to the Settings dashboard (`/settings`) where users can view and edit the default Time-of-Use period definitions for High-Demand and Low-Demand seasons. These settings will be stored in localStorage and consumed by all chart/simulation components that currently call `getTOUPeriod()`.

## TOU Periods Reverse-Engineered from Image

Based on the Eskom Megaflex clock diagram:

### High-Demand Season (June -- August)
| Hours | Weekday | Saturday | Sunday |
|-------|---------|----------|--------|
| 00-06 | Off-Peak | Off-Peak | Off-Peak |
| 06-07 | Peak | Off-Peak | Off-Peak |
| 07-09 | Peak | Standard | Off-Peak |
| 09-12 | Standard | Standard | Off-Peak |
| 12-14 | Off-Peak | Off-Peak | Off-Peak |
| 14-17 | Standard | Off-Peak | Off-Peak |
| 17-19 | Peak | Off-Peak | Off-Peak |
| 19-22 | Standard | Off-Peak | Off-Peak |
| 22-24 | Off-Peak | Off-Peak | Off-Peak |

### Low-Demand Season (September -- May)
| Hours | Weekday | Saturday | Sunday |
|-------|---------|----------|--------|
| 00-06 | Off-Peak | Off-Peak | Off-Peak |
| 06-07 | Standard | Off-Peak | Off-Peak |
| 07-10 | Peak | Standard | Off-Peak |
| 10-12 | Standard | Standard | Off-Peak |
| 12-18 | Standard | Off-Peak | Off-Peak |
| 18-20 | Peak | Standard | Off-Peak |
| 20-22 | Standard | Off-Peak | Off-Peak |
| 22-24 | Off-Peak | Off-Peak | Off-Peak |

## Plan

### 1. Define TOU Settings Types and Defaults
**File:** `src/components/projects/load-profile/types.ts`

- Add `TOUHourMap` type: `Record<number, TOUPeriod>` (hours 0-23)
- Add `TOUSeasonConfig` interface: `{ weekday: TOUHourMap; saturday: TOUHourMap; sunday: TOUHourMap }`
- Add `TOUSettings` interface: `{ highSeasonMonths: number[]; highSeason: TOUSeasonConfig; lowSeason: TOUSeasonConfig }`
- Add `DEFAULT_TOU_SETTINGS` constant matching the tables above
- Update `getTOUPeriod()` to accept optional `TOUSettings` and `month` parameters (backward compatible -- falls back to current hardcoded logic if no settings provided)

### 2. Create TOU Settings Storage Hook
**File:** `src/hooks/useTOUSettings.ts` (new)

- Read/write `TOUSettings` from localStorage (key: `tou-settings`)
- Provide `touSettings`, `updateTOUSettings`, `resetToDefaults`
- Pure getter function `getTOUSettings()` for non-React contexts (simulation engine, etc.)

### 3. Create TOU Settings Card Component
**File:** `src/components/settings/TOUSettingsCard.tsx` (new)

- Two-tab layout: **High-Demand Season** / **Low-Demand Season**
- Each tab shows a 24-hour grid with 3 rows (Weekday, Saturday, Sunday)
- Each cell is clickable to cycle through Peak (red) / Standard (yellow) / Off-Peak (green)
- High-season month selector (multi-select toggles for Jan-Dec)
- "Reset to Defaults" button
- Visual colour legend matching the existing `TOU_COLORS`

### 4. Add Tab to Settings Page
**File:** `src/pages/Settings.tsx`

- Add a new "TOU Periods" tab (with `Clock` icon from lucide-react)
- Render `TOUSettingsCard` in the tab content
- Update `EXPECTED_TAB_COUNT` from 9 to 10

### 5. Update Consumers of `getTOUPeriod()`
The following files have local or imported `getTOUPeriod` calls. Each will be updated to pass the stored TOU settings:

- `src/components/projects/load-profile/hooks/useLoadProfileData.ts`
- `src/components/projects/load-profile/charts/LoadChart.tsx`
- `src/components/projects/load-profile/charts/GridFlowChart.tsx`
- `src/components/projects/load-profile/charts/SolarChart.tsx`
- `src/components/projects/load-profile/charts/LoadEnvelopeChart.tsx`
- `src/components/projects/load-profile/charts/BuildingProfileChart.tsx`
- `src/components/projects/ScaledMeterPreview.tsx` (local copy)
- `src/components/loadprofiles/MeterProfilePreview.tsx` (local copy)
- `src/components/loadprofiles/ScadaImportsList.tsx` (local copy)
- `src/components/projects/SimulationPanel.tsx` (`touPeriodToWindows`)

Local copies of `getTOUPeriod` in `ScaledMeterPreview`, `MeterProfilePreview`, and `ScadaImportsList` will be replaced with the shared version from `types.ts`.

### 6. Update `touPeriodToWindows()` in SimulationPanel
Currently hardcoded hour windows. Will be updated to derive windows dynamically from the stored `TOUSettings` for the current season context.

## Technical Notes
- Storage: localStorage (consistent with existing `useCalculationDefaults` pattern)
- No database changes required
- No new dependencies needed
- The user mentioned they will update the periods once the functionality is created, so the reverse-engineered defaults serve as a starting point

