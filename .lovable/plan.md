

## Sync GSA Coordinates with Site Location on Refresh

### Problem
The `SolarForecastCard` initializes lat/lng from `defaultLatitude`/`defaultLongitude` props only once (via `useState` initial value). If the user updates the project's site location on the map, the GSA card still shows stale coordinates — clicking Refresh fetches data for the old coordinates.

### Fix
In `SolarForecastCard.tsx`:
- Add a `useEffect` that watches `defaultLatitude` and `defaultLongitude` props and syncs the local `latitude`/`longitude` state whenever they change.
- In `handleFetch`, reset local state to the current prop values before fetching, ensuring the input fields visually update to match the site location.

### File: `src/components/projects/SolarForecastCard.tsx`
- Add `useEffect` import (already has `useState`)
- Add effect:
  ```typescript
  useEffect(() => {
    setLatitude(defaultLatitude);
    setLongitude(defaultLongitude);
  }, [defaultLatitude, defaultLongitude]);
  ```
- Update `handleFetch` to also reset coordinates from props:
  ```typescript
  const handleFetch = () => {
    setLatitude(defaultLatitude);
    setLongitude(defaultLongitude);
    fetchData(defaultLatitude, defaultLongitude);
  };
  ```

This ensures clicking Refresh always uses the latest project site coordinates, and the input fields reflect the current site location.

