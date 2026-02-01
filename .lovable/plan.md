

## Plan: Add Location Data to Sites in Load Profiles

### Overview

This plan adds geographic location support (latitude/longitude) to sites in the Load Profiles section, enabling map visualization using the existing Mapbox integration. Locations can be synced from the external engi-ops-nexus application or geocoded using site names.

---

### Technical Summary

**Current State:**
- The `sites` table only has a text `location` field (currently null for all sites)
- The `projects` table has `latitude` and `longitude` columns with data
- Projects can be synced from `https://engi-ops-nexus.lovable.app` via the existing `sync-external-projects` edge function
- Sites and projects are separate entities with no direct link

**What We'll Build:**
1. Add `latitude` and `longitude` columns to the `sites` table
2. Create a new edge function `sync-external-sites` to pull site locations from the external source
3. Add a batch geocode function for sites (similar to `batch-geocode-projects`)
4. Add a mini-map component to display site location in the Sites UI
5. Add location search/selection capability when editing a site

---

### Implementation Steps

#### Step 1: Database Migration
Add coordinate columns to the `sites` table:
- `latitude DOUBLE PRECISION` (nullable)
- `longitude DOUBLE PRECISION` (nullable)

#### Step 2: Create `sync-external-sites` Edge Function
Create a new edge function that:
- Calls the external `engi-ops-nexus` API endpoint to fetch site/project data with coordinates
- Maps external project names to local site names (case-insensitive match)
- Updates local sites with latitude/longitude from matched external projects
- Returns sync statistics (matched, updated, not found)

#### Step 3: Create `batch-geocode-sites` Edge Function
Create a function similar to `batch-geocode-projects` that:
- Fetches all sites with a name but no coordinates
- Uses Mapbox geocoding API to lookup coordinates (site name + ", South Africa")
- Updates sites with found coordinates
- Returns batch results

#### Step 4: Create `SiteLocationMap` Component
Build a compact map component for displaying site location:
- Shows satellite view with pin marker (reusing Mapbox setup from `ProjectLocationMap`)
- Displays coordinates badge
- Includes click-to-set-location functionality
- Uses existing `get-mapbox-token` edge function

#### Step 5: Update `SitesTab.tsx` - Site Card Display
Modify the site list to show location preview:
- Add small map thumbnail or coordinate badge to each site row
- Show MapPin icon with coordinates when available
- Add "Set Location" action when coordinates are missing

#### Step 6: Update Site Edit Dialog
Enhance the Add/Edit Site dialog:
- Add embedded mini-map for location selection
- Integrate Google Places search (reusing existing `google-places-search` edge function)
- Allow manual coordinate entry
- Save location when site is saved

#### Step 7: Add Sync Button to Sites Tab Header
Add a "Sync from Engi-Ops" button that:
- Calls the new `sync-external-sites` edge function
- Shows progress/results toast
- Refreshes the sites list after sync

#### Step 8: Add Batch Geocode Action
Add a "Geocode All Sites" button (shown when sites without coordinates exist):
- Calls `batch-geocode-sites` edge function
- Shows batch processing results
- Useful for sites that weren't synced from external source

---

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Database | Create migration | Add latitude/longitude to sites table |
| `supabase/functions/sync-external-sites/index.ts` | Create | Sync sites from external source |
| `supabase/functions/batch-geocode-sites/index.ts` | Create | Batch geocode sites by name |
| `src/components/loadprofiles/SiteLocationMap.tsx` | Create | Compact map component for sites |
| `src/components/loadprofiles/SitesTab.tsx` | Modify | Add location display, sync/geocode buttons |
| `src/components/loadprofiles/SiteManager.tsx` | Modify | Add location editing to dialog |
| `supabase/config.toml` | Modify | Register new edge functions |

---

### Dependencies

- Existing Mapbox token (already configured as secret)
- Existing Google Places API (already configured)
- External API at `https://rsdisaisxdglmdmzmkyw.supabase.co/functions/v1/fetch-tenant-schedule`

---

### User Experience Flow

1. **First-time Setup**: User clicks "Sync from Engi-Ops" to pull locations for matching sites
2. **Fallback**: For sites not in external system, user clicks "Geocode All" to lookup by name
3. **Manual Override**: User can click any site's location to manually adjust via map/search
4. **Visual Feedback**: Sites with coordinates show a small map preview; those without show a "Set Location" prompt

