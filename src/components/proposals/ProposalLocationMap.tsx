import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface ProposalLocationMapProps {
  latitude: number | null;
  longitude: number | null;
  location?: string | null;
  projectName?: string;
}

export function ProposalLocationMap({ latitude, longitude, location, projectName }: ProposalLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-mapbox-token");
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        }
      } catch (err) {
        console.error("Failed to get Mapbox token:", err);
      }
    };
    fetchToken();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !latitude || !longitude || map.current) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [longitude, latitude],
      zoom: 15,
      interactive: false, // Static map for proposal
    });

    map.current.on("load", () => {
      setMapLoaded(true);

      // Add marker for the location
      const el = document.createElement("div");
      el.style.cssText = `
        width: 40px;
        height: 40px;
        background: hsl(var(--primary));
        border: 4px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      `;
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

      new mapboxgl.Marker(el)
        .setLngLat([longitude, latitude])
        .addTo(map.current!);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken, latitude, longitude]);

  // Show placeholder if no coordinates
  if (!latitude || !longitude) {
    return (
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center p-6 bg-muted/20 min-h-[200px]">
        <MapPin className="h-12 w-12 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground text-center">Site Location Map</p>
        <p className="text-xs text-muted-foreground/60 text-center mt-1">
          {location || "Coordinates not set"}
        </p>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border min-h-[200px]">
      <div ref={mapContainer} className="w-full h-[200px]">
        {!mapLoaded && <Skeleton className="w-full h-full" />}
      </div>
      {/* Location overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="flex items-center gap-2 text-white">
          <MapPin className="h-4 w-4" />
          <div>
            <p className="text-sm font-medium">{projectName || location || "Project Location"}</p>
            <p className="text-xs text-white/70">
              {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
