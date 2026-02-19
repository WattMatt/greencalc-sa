

## Store Municipality Boundaries in Backend File Storage

### Problem
The municipality boundary GeoJSON (~10MB) is fetched directly from the ArcGIS API on every page load (line 165-190 of `MunicipalityMap.tsx`). This causes slow map loads and failures when the ArcGIS service is down or slow.

### Solution
1. **Create an edge function** (`cache-boundaries`) that fetches the GeoJSON from ArcGIS once and stores it in a storage bucket, then serves it from storage on subsequent requests.
2. **Update the frontend** to call this edge function instead of ArcGIS directly.

### How It Works

1. Frontend calls `cache-boundaries` edge function
2. Edge function checks if `municipality-boundaries.geojson` exists in storage
3. If yes: return a signed URL (or the file content) from storage
4. If no (first time / manual refresh): fetch from ArcGIS, upload to storage, then return it
5. Optional `?refresh=true` parameter to force re-fetch from ArcGIS

### Technical Details

**New edge function: `supabase/functions/cache-boundaries/index.ts`**
- Checks for `boundary-cache/municipality-boundaries.geojson` in a storage bucket
- If file exists, downloads and returns it as JSON
- If file missing (or `?refresh=true`), fetches from ArcGIS, uploads to storage, returns the result
- Uses the existing `tariff-uploads` bucket (private) with a subfolder `boundary-cache/`

**Config: `supabase/config.toml`**
- Add `[functions.cache-boundaries]` with `verify_jwt = false`

**Frontend: `src/components/tariffs/MunicipalityMap.tsx`**
- Replace the direct ArcGIS fetch (lines 165-190) with a call to `supabase.functions.invoke("cache-boundaries")`
- Remove the `ARCGIS_BOUNDARY_URL` constant (line 81)
- Everything else (map rendering, popup logic, filters) stays unchanged

### Benefits
- Map loads from backend storage (fast, reliable)
- No dependency on ArcGIS availability at runtime
- One-time fetch populates the cache; subsequent loads are instant
- Manual refresh available via `?refresh=true` if boundaries ever update

### Files Modified
- `supabase/functions/cache-boundaries/index.ts` -- new edge function
- `supabase/config.toml` -- register new function
- `src/components/tariffs/MunicipalityMap.tsx` -- use edge function instead of ArcGIS

