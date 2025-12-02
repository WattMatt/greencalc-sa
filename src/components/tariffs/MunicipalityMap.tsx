import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Loader2 } from "lucide-react";

// South African province centers with colors
const SA_PROVINCES: Record<string, { center: [number, number]; color: string }> = {
  "Gauteng": { center: [28.0473, -26.2041], color: "#ef4444" },
  "Western Cape": { center: [19.0, -33.9], color: "#f97316" },
  "KwaZulu-Natal": { center: [30.5, -29.0], color: "#eab308" },
  "Eastern Cape": { center: [26.5, -32.0], color: "#22c55e" },
  "Mpumalanga": { center: [30.0, -25.5], color: "#14b8a6" },
  "Limpopo": { center: [29.5, -23.5], color: "#3b82f6" },
  "North West": { center: [25.5, -26.0], color: "#8b5cf6" },
  "Free State": { center: [26.5, -29.0], color: "#ec4899" },
  "Northern Cape": { center: [21.0, -29.0], color: "#6b7280" },
  "South Africa": { center: [25.0, -29.0], color: "#64748b" },
};

// Known municipality coordinates (can be expanded)
const MUNICIPALITY_COORDS: Record<string, [number, number]> = {
  "City of Johannesburg": [28.0473, -26.2041],
  "City of Cape Town": [18.4241, -33.9249],
  "eThekwini": [31.0218, -29.8587],
  "City of Tshwane": [28.1881, -25.7461],
  "Ekurhuleni": [28.4018, -26.1496],
  "Nelson Mandela Bay": [25.8915, -33.9608],
  "Buffalo City": [27.9116, -32.9872],
  "Mangaung": [26.2041, -29.1214],
  "Msunduzi": [30.3789, -29.6168],
  "Polokwane": [29.4486, -23.9045],
  "Mbombela": [31.0292, -25.4753],
  "Rustenburg": [27.2428, -25.6653],
  "Emfuleni": [27.8437, -26.6783],
  "Madibeng": [27.8, -25.65],
  "Mogale City": [27.5, -26.08],
  "Steve Tshwete": [29.2, -25.77],
  "Matjhabeng": [26.82, -27.97],
  "Sol Plaatje": [24.77, -28.74],
  "Drakenstein": [19.0, -33.73],
  "Stellenbosch": [18.86, -33.93],
  "George": [22.46, -33.96],
  "Mossel Bay": [22.13, -34.18],
  "Knysna": [23.05, -34.04],
};

interface Municipality {
  id: string;
  name: string;
  province: { name: string };
}

export function MunicipalityMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(true);
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
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken]);

  // Add municipality markers
  useEffect(() => {
    if (!map.current || municipalities.length === 0) return;

    // Wait for map to load
    const addMarkers = () => {
      // Clear existing markers
      const existingMarkers = document.querySelectorAll(".municipality-marker");
      existingMarkers.forEach((m) => m.remove());

      municipalities.forEach((muni) => {
        const provinceName = muni.province?.name || "South Africa";
        const provinceData = SA_PROVINCES[provinceName] || SA_PROVINCES["South Africa"];
        
        // Try to get specific coordinates, otherwise estimate based on province
        let coords = MUNICIPALITY_COORDS[muni.name];
        if (!coords) {
          // Add some randomness around province center for unknown municipalities
          const [lng, lat] = provinceData.center;
          const offset = () => (Math.random() - 0.5) * 2;
          coords = [lng + offset(), lat + offset()];
        }

        const el = document.createElement("div");
        el.className = "municipality-marker";
        el.style.width = "12px";
        el.style.height = "12px";
        el.style.backgroundColor = provinceData.color;
        el.style.borderRadius = "50%";
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
        el.style.cursor = "pointer";

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px;">
            <strong>${muni.name}</strong>
            <br />
            <span style="color: ${provinceData.color}; font-size: 12px;">${provinceName}</span>
          </div>
        `);

        new mapboxgl.Marker(el)
          .setLngLat(coords)
          .setPopup(popup)
          .addTo(map.current!);
      });
    };

    if (map.current.loaded()) {
      addMarkers();
    } else {
      map.current.on("load", addMarkers);
    }
  }, [municipalities, mapboxToken]);

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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5" />
          Municipality Map
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={mapContainer} className="h-[400px] rounded-b-lg" />
        {municipalities.length > 0 && (
          <div className="p-3 border-t flex flex-wrap gap-3 text-xs">
            {Object.entries(SA_PROVINCES).slice(0, 9).map(([name, data]) => (
              <div key={name} className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: data.color }}
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
