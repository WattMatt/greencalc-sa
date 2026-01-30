
# Add Location Search to Project Location Modal

## Overview
Add a search bar to the Site Location section in the Project Location modal that allows searching for locations by name, address, or place. When a user types and selects a location, the map will fly to that location and set the coordinates.

---

## Summary of Changes

1. **Add search input field** - Place a search bar next to the "Site Location" heading
2. **Implement location search** - Call the existing `geocode-location` edge function to search for places
3. **Show search suggestions** - Display a dropdown with matching location results as the user types
4. **Auto-fill coordinates** - When a result is selected, update the map position and coordinate inputs

---

## UI Design

### Current Layout:
```text
┌──────────────────────────────────────────────────┐
│ 📍 Site Location                    [Johannesburg]│
├──────────────────────────────────────────────────┤
│ Lat: [-34.0000]     Long: [18.7013]              │
└──────────────────────────────────────────────────┘
```

### New Layout:
```text
┌──────────────────────────────────────────────────┐
│ 📍 Site Location     [🔍 Search location...    ] │
├──────────────────────────────────────────────────┤
│ Lat: [-34.0000]     Long: [18.7013]              │
│                                                  │
│ ┌────────────────────────────────────────────┐   │
│ │ 📍 Cape Town, Western Cape, South Africa   │   │  ← Dropdown suggestions
│ │ 📍 Johannesburg, Gauteng, South Africa     │   │    (shown while typing)
│ │ 📍 Durban, KwaZulu-Natal, South Africa     │   │
│ └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## Technical Implementation

### 1. Update Edge Function for Search Suggestions

Modify `geocode-location/index.ts` to support returning multiple results for autocomplete:

```typescript
// New parameter: limit (number of results to return)
interface GeocodeRequest {
  project_id?: string;
  location?: string;
  save_to_project?: boolean;
  latitude?: number;
  longitude?: number;
  reverse?: boolean;
  limit?: number;  // NEW: for search suggestions
}

// When limit > 1, return array of results for suggestions
const mapboxUrl = `...&limit=${limit || 1}`;

// Return multiple features for autocomplete
if (limit && limit > 1) {
  return {
    success: true,
    suggestions: data.features.map(f => ({
      place_name: f.place_name,
      latitude: f.center[1],
      longitude: f.center[0],
      relevance: f.relevance
    }))
  };
}
```

### 2. Add Search UI to ProjectLocationMap Component

Update `src/components/projects/ProjectLocationMap.tsx`:

**New State:**
```typescript
const [searchQuery, setSearchQuery] = useState("");
const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
const [isSearching, setIsSearching] = useState(false);
const [showSuggestions, setShowSuggestions] = useState(false);
```

**Search Input Component:**
```typescript
<div className="relative flex-1 max-w-[250px]">
  <div className="relative">
    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
    <Input
      type="text"
      value={searchQuery}
      onChange={(e) => handleSearchChange(e.target.value)}
      onFocus={() => setShowSuggestions(true)}
      placeholder="Search location..."
      className="h-7 text-xs pl-7 pr-8"
    />
    {isSearching && (
      <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin" />
    )}
  </div>
  
  {/* Suggestions Dropdown */}
  {showSuggestions && searchResults.length > 0 && (
    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-[200px] overflow-y-auto">
      {searchResults.map((result, i) => (
        <button
          key={i}
          onClick={() => handleSelectResult(result)}
          className="w-full px-3 py-2 text-left text-xs hover:bg-accent flex items-start gap-2"
        >
          <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
          <span className="truncate">{result.place_name}</span>
        </button>
      ))}
    </div>
  )}
</div>
```

**Debounced Search Function:**
```typescript
const handleSearchChange = useCallback(
  debounce(async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const { data } = await supabase.functions.invoke("geocode-location", {
        body: { location: query, limit: 5 }
      });
      
      if (data?.suggestions) {
        setSearchResults(data.suggestions);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  }, 300),
  []
);
```

**Handle Result Selection:**
```typescript
const handleSelectResult = (result: SearchResult) => {
  setPendingCoords({ lat: result.latitude, lng: result.longitude });
  setEditLat(result.latitude.toFixed(6));
  setEditLng(result.longitude.toFixed(6));
  updateMarker(result.latitude, result.longitude, true);
  map.current?.flyTo({ 
    center: [result.longitude, result.latitude], 
    zoom: 14 
  });
  setSearchQuery("");
  setShowSuggestions(false);
  setSearchResults([]);
};
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/geocode-location/index.ts` | Add `limit` parameter to return multiple results for autocomplete |
| `src/components/projects/ProjectLocationMap.tsx` | Add search input, suggestion dropdown, and search logic |

---

## User Flow

1. User opens the Project Location modal (current behavior)
2. User sees the new search input next to "Site Location"
3. User types a location name (e.g., "Cape Town")
4. After 3 characters, suggestions appear in a dropdown
5. User clicks a suggestion
6. Map flies to the selected location
7. Latitude/Longitude inputs are updated
8. Pin marker appears at the new location (in pending/orange state)
9. User clicks "Save" to confirm the location
