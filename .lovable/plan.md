

## Add Global Solar Atlas Integration to Solar Forecast Card

### What Global Solar Atlas Provides
A free public API at `api.globalsolaratlas.info/data/lta?loc={lat},{lng}` returning:
- **PVOUT_csi**: Specific PV output in kWh/kWp (annual + 12 monthly values)
- **GHI**: Global Horizontal Irradiation (kWh/m2)
- **DNI**: Direct Normal Irradiation (kWh/m2)
- **DIF**: Diffuse Horizontal Irradiation (kWh/m2)
- **GTI_opta**: Global Tilted Irradiation at optimum angle (kWh/m2)
- **OPTA**: Optimum tilt angle (degrees)
- **TEMP**: Air temperature (C)
- **ELE**: Elevation (m)

All values available as annual totals and monthly arrays (12 values).

### Changes

**1. New Edge Function: `supabase/functions/global-solar-atlas/index.ts`**
- Proxies requests to `https://api.globalsolaratlas.info/data/lta?loc={lat},{lng}`
- No API key needed (free public API), but proxy via edge function to avoid CORS
- Returns the parsed JSON response with annual and monthly data

**2. New Hook: `src/hooks/useGlobalSolarAtlas.ts`**
- Calls the edge function with lat/lng
- Returns typed data: annual PVOUT, GHI, DNI, DIF, GTI, OPTA, TEMP, ELE + monthly arrays
- Loading/error state management

**3. Replace `SolarForecastCard.tsx`**
- Swap from Solcast to Global Solar Atlas as the data source
- Update header: "Global Solar Atlas" branding
- Summary stats: PVOUT (kWh/kWp), GHI (kWh/m2), DNI (kWh/m2), Temp, Elevation
- Chart: Monthly PVOUT and GHI bar/area chart (12 months instead of 7 daily forecasts)
- Table: Monthly breakdown of PVOUT, GHI, DNI, DIF, GTI, Temp
- Badge: Show annual PVOUT (e.g. "1800 kWh/kWp")
- Keep the same lat/lng input pattern and Fetch button

### Technical Details

Edge function URL pattern:
```
GET -> api.globalsolaratlas.info/data/lta?loc=-26.2044,28.0456
```

Response shape (abbreviated):
```json
{
  "annual": {
    "data": {
      "PVOUT_csi": 1800.1,
      "GHI": 2005.4,
      "DNI": 2156.4,
      "DIF": 642.7,
      "GTI_opta": 2237.6,
      "OPTA": 29,
      "TEMP": 15.3,
      "ELE": 1766
    }
  },
  "monthly": {
    "data": {
      "PVOUT_csi": [139.8, 129.2, ...],  // 12 values
      "GHI": [196.2, 168.4, ...],
      "TEMP": [19, 18.8, ...]
    }
  }
}
```

