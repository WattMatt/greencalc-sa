import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Loader2 } from "lucide-react";

// South African province colors
const PROVINCE_COLORS: Record<string, string> = {
  "Gauteng": "#ef4444",
  "Western Cape": "#f97316",
  "KwaZulu-Natal": "#eab308",
  "Eastern Cape": "#22c55e",
  "Mpumalanga": "#14b8a6",
  "Limpopo": "#3b82f6",
  "North West": "#8b5cf6",
  "Free State": "#ec4899",
  "Northern Cape": "#6b7280",
};

interface Municipality {
  id: string;
  name: string;
  province: { name: string };
}

interface GeocodedMunicipality extends Municipality {
  coordinates: [number, number] | null;
}

// Cache for geocoded coordinates
const geocodeCache: Record<string, [number, number] | null> = {};

export function MunicipalityMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [geocodedMunicipalities, setGeocodedMunicipalities] = useState<GeocodedMunicipality[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    async function fetchToken() {
      try {
        const { data, error } = await supabase.functions.invoke("get-mapbox-token");
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          setError("Mapbox token not available");
        }
      } catch (err) {
        console.error("Failed to fetch Mapbox token:", err);
        setError("Failed to load map configuration");
      }
    }
    fetchToken();
  }, []);

  // Fetch municipalities
  useEffect(() => {
    async function fetchMunicipalities() {
      try {
        const { data, error } = await supabase
          .from("municipalities")
          .select("id, name, province:provinces(name)");
        
        if (error) throw error;
        setMunicipalities(data || []);
      } catch (err) {
        console.error("Failed to fetch municipalities:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMunicipalities();
  }, []);

  // Geocode a municipality name using Mapbox Geocoding API
  const geocodeMunicipality = useCallback(async (name: string, province: string, token: string): Promise<[number, number] | null> => {
    const cacheKey = `${name}-${province}`;
    
    if (geocodeCache[cacheKey] !== undefined) {
      return geocodeCache[cacheKey];
    }

    try {
      // Search for municipality in South Africa with province context
      const searchQuery = encodeURIComponent(`${name}, ${province}, South Africa`);
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${searchQuery}.json?access_token=${token}&country=ZA&types=place,locality,district&limit=1`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }

      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        const coords: [number, number] = [lng, lat];
        geocodeCache[cacheKey] = coords;
        return coords;
      }
      
      // Try without province if no results
      const fallbackQuery = encodeURIComponent(`${name} Municipality, South Africa`);
      const fallbackResponse = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${fallbackQuery}.json?access_token=${token}&country=ZA&types=place,locality,district&limit=1`
      );
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (fallbackData.features && fallbackData.features.length > 0) {
          const [lng, lat] = fallbackData.features[0].center;
          const coords: [number, number] = [lng, lat];
          geocodeCache[cacheKey] = coords;
          return coords;
        }
      }

      geocodeCache[cacheKey] = null;
      return null;
    } catch (err) {
      console.error(`Failed to geocode ${name}:`, err);
      geocodeCache[cacheKey] = null;
      return null;
    }
  }, []);

  // Geocode all municipalities
  useEffect(() => {
    if (!mapboxToken || municipalities.length === 0) return;

    async function geocodeAll() {
      setGeocoding(true);
      
      const geocoded: GeocodedMunicipality[] = [];
      
      // Process in batches to avoid rate limiting
      for (let i = 0; i < municipalities.length; i++) {
        const muni = municipalities[i];
        const provinceName = muni.province?.name || "South Africa";
        const coords = await geocodeMunicipality(muni.name, provinceName, mapboxToken!);
        
        geocoded.push({
          ...muni,
          coordinates: coords,
        });

        // Small delay between requests to avoid rate limiting
        if (i < municipalities.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setGeocodedMunicipalities(geocoded);
      setGeocoding(false);
    }

    geocodeAll();
  }, [municipalities, mapboxToken, geocodeMunicipality]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || map.current) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [25.0, -29.0], // South Africa center
      zoom: 5,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken]);

  // Add municipality markers
  useEffect(() => {
    if (!map.current || geocodedMunicipalities.length === 0) return;

    const addMarkers = () => {
      // Clear existing markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];

      geocodedMunicipalities.forEach((muni) => {
        if (!muni.coordinates) return; // Skip municipalities that couldn't be geocoded

        const provinceName = muni.province?.name || "South Africa";
        const color = PROVINCE_COLORS[provinceName] || "#64748b";

        const el = document.createElement("div");
        el.className = "municipality-marker";
        el.style.width = "12px";
        el.style.height = "12px";
        el.style.backgroundColor = color;
        el.style.borderRadius = "50%";
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
        el.style.cursor = "pointer";

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px;">
            <strong>${muni.name}</strong>
            <br />
            <span style="color: ${color}; font-size: 12px;">${provinceName}</span>
          </div>
        `);

        const marker = new mapboxgl.Marker(el)
          .setLngLat(muni.coordinates)
          .setPopup(popup)
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    };

    if (map.current.loaded()) {
      addMarkers();
    } else {
      map.current.on("load", addMarkers);
    }
  }, [geocodedMunicipalities]);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5" />
            Municipality Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const geocodedCount = geocodedMunicipalities.filter(m => m.coordinates).length;
  const totalCount = municipalities.length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5" />
          Municipality Map
          {(loading || geocoding) && <Loader2 className="h-4 w-4 animate-spin" />}
          {!loading && !geocoding && totalCount > 0 && (
            <span className="text-xs font-normal text-muted-foreground ml-2">
              ({geocodedCount}/{totalCount} plotted)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={mapContainer} className="h-[400px] rounded-b-lg" />
        {municipalities.length > 0 && (
          <div className="p-3 border-t flex flex-wrap gap-3 text-xs">
            {Object.entries(PROVINCE_COLORS).map(([name, color]) => (
              <div key={name} className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span>{name}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
