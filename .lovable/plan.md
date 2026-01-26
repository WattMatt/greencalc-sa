
# Pre-select Province and Municipality Based on Project Location Pin

## Overview
When you drop a pin on the map in the Overview tab, the Tariff tab should automatically pre-select the Province and Municipality based on the pin's coordinates. This saves manual selection and ensures geographical accuracy.

## How It Will Work

1. **When you drop a pin on the map** - The coordinates (latitude/longitude) are saved to the project
2. **When you open the Tariff tab** - The system performs a reverse geocode lookup to determine which province and municipality the pin falls in
3. **Auto-selection** - The Province and Municipality dropdowns are automatically populated
4. **Manual override** - You can still change the selection if needed

## Technical Implementation

### 1. Extend the Geocoding Edge Function
Add reverse geocoding capability to the existing `geocode-location` function:

```text
┌─────────────────────────────────────────────────────────────┐
│  geocode-location Edge Function                              │
│                                                              │
│  Current: Location text → Coordinates                        │
│  New: Also supports Coordinates → Province/Municipality      │
│                                                              │
│  Request: { latitude, longitude, reverse: true }             │
│  Response: { province: "Limpopo", municipality: "MOGALAKWENA" }│
└─────────────────────────────────────────────────────────────┘
```

The Mapbox Geocoding API returns a `context` object with administrative regions. For South Africa, this includes:
- `region` → Province (e.g., "Limpopo", "Gauteng")
- `place` → Municipality/City (e.g., "Polokwane", "Johannesburg")

### 2. Update TariffSelector Component
Add new props and auto-selection logic:

| New Prop | Type | Purpose |
|----------|------|---------|
| `latitude` | `number \| null` | Project latitude from pin |
| `longitude` | `number \| null` | Project longitude from pin |

The component will:
1. Detect when coordinates are available but province isn't selected yet
2. Call the reverse geocode function
3. Match the returned province name against the `provinces` table
4. Match the returned municipality name against the `municipalities` table
5. Auto-select both dropdowns

### 3. Update ProjectDetail Page
Pass the project coordinates to TariffSelector:

```tsx
<TariffSelector
  projectId={id!}
  currentTariffId={project.tariff_id}
  latitude={project.latitude}      // NEW
  longitude={project.longitude}    // NEW
  onSelect={(tariffId) => updateProject.mutate({ tariff_id: tariffId })}
/>
```

### 4. Name Matching Strategy
Municipality names in the database may differ slightly from Mapbox results. The matching will use:
- Case-insensitive comparison
- Partial matching (e.g., "MOGALAKWENA" matches "Mogalakwena Local Municipality")
- Fallback to showing unmatched results for manual selection

## User Experience Flow

```text
1. Overview Tab: Drop pin on map
         ↓
2. Pin saved with coordinates (-23.9, 29.5)
         ↓
3. Navigate to Tariff Tab
         ↓
4. System performs reverse geocode lookup
         ↓
5. Mapbox returns: region="Limpopo", place="Mokopane"
         ↓
6. System matches "Limpopo" → Province dropdown pre-selected
   System matches "Mokopane" → Municipality dropdown pre-selected
         ↓
7. You select your specific tariff from the filtered list
```

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/geocode-location/index.ts` | Add reverse geocoding capability |
| `src/components/projects/TariffSelector.tsx` | Add coordinate props and auto-selection logic |
| `src/pages/ProjectDetail.tsx` | Pass latitude/longitude to TariffSelector |

## Edge Cases Handled

- **No pin dropped**: Dropdowns remain empty for manual selection
- **Location outside South Africa**: Show message, allow manual selection
- **No matching municipality in database**: Province selected, municipality left for manual selection
- **Already has a tariff selected**: Don't override existing selections
