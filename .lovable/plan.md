

## Municipality Map: YoY Comparison Popup and Local Boundary Storage

### What Changes

**1. Municipality click popup shows YoY comparison chart**

When you click a municipality on the map (e.g. Polokwane), instead of the current basic info popup, a React dialog will open showing:
- A tariff name selector (dropdown of all tariffs in that municipality)
- The YoY bar chart comparing the same tariff across date periods
- Trend badges showing total % change and average annual change
- Charge type filter (Basic, Energy Low/High, Demand Low/High)

This reuses the existing `TariffPeriodComparisonDialog` logic but is triggered from the map click instead of from a non-existent button.

**2. Store boundary GeoJSON locally**

Currently, every time you open the Municipalities tab, the app fetches ~230 municipality boundaries from the ArcGIS server (`services7.arcgis.com`). This will be changed to:
- Download the GeoJSON file once and save it as `public/data/sa-local-municipality-boundaries.geojson`
- The `MunicipalityMap` component will load it from the local file instead of making an external API call
- This eliminates the external dependency and speeds up load times

### Technical Details

**File: `public/data/sa-local-municipality-boundaries.geojson`** (new)
- Fetched once from the ArcGIS endpoint and stored as a static asset
- Contains all SA local municipality boundary polygons with MUNICNAME, PROVINCE, CAT_B properties

**File: `src/components/tariffs/MunicipalityMap.tsx`**
- Remove the ArcGIS fetch `useEffect` (lines 146-170)
- Replace with a local fetch: `fetch('/data/sa-local-municipality-boundaries.geojson')`
- Remove the `ARCGIS_BOUNDARY_URL` constant
- On municipality click (line 358-438): instead of rendering an HTML popup, open the `TariffPeriodComparisonDialog` via React state
- Add state for `selectedMunicipalityId` and `selectedMunicipalityName` to control the dialog
- The existing "View Tariffs" button remains in the popup; the YoY chart opens as a separate dialog

**File: `src/components/tariffs/TariffPeriodComparisonDialog.tsx`**
- Add a new prop: `initialTariffName?: string` (optional, auto-selects first available if not provided)
- Add a tariff name selector dropdown that queries distinct tariff names in the municipality that have 2+ date periods
- When the municipality is clicked from the map, this dialog opens with all matching tariffs available for selection

**Flow:**
1. User clicks municipality on map
2. Mapbox popup appears with basic info (name, province, tariff count)
3. Popup includes a "YoY Trends" button (in addition to existing "View Tariffs" button)
4. Clicking "YoY Trends" opens the `TariffPeriodComparisonDialog` with a tariff selector pre-loaded for that municipality
5. User can switch between tariff names and charge types to see trends

