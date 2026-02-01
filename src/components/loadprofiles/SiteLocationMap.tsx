import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface GooglePlacesSuggestion {
  place_id: string;
  place_name: string;
  main_text: string;
  secondary_text: string;
}

interface SiteLocationMapProps {
  latitude?: number | null;
  longitude?: number | null;
  siteName?: string;
  editable?: boolean;
  onLocationChange?: (lat: number, lng: number) => void;
  compact?: boolean;
  className?: string;
}

// South Africa center for default view
const SA_CENTER: [number, number] = [24.0, -29.0];

export function SiteLocationMap({
  latitude,
  longitude,
  siteName,
  editable = false,
  onLocationChange,
  compact = false,
  className = "",
}: SiteLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  // Location search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GooglePlacesSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Fetch Mapbox token
  const { data: mapboxToken } = useQuery({
    queryKey: ["mapbox-token"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-mapbox-token");
      if (error) throw error;
      return data.token as string;
    },
    staleTime: 1000 * 60 * 60,
  });

  const currentLat = pendingCoords?.lat ?? latitude;
  const currentLng = pendingCoords?.lng ?? longitude;
  const hasCoordinates = !!(currentLat && currentLng);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || map.current) return;

    mapboxgl.accessToken = mapboxToken;

    const initialCenter = hasCoordinates 
      ? [currentLng!, currentLat!] as [number, number]
      : SA_CENTER;

    const initialZoom = hasCoordinates ? 12 : 5;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
    });

    if (!compact) {
      map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    }

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    if (editable) {
      map.current.on("click", (e) => {
        const { lng, lat } = e.lngLat;
        setPendingCoords({ lat, lng });
        updateMarker(lat, lng);
        onLocationChange?.(lat, lng);
      });
    }

    return () => {
      marker.current?.remove();
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, [mapboxToken]);

  const updateMarker = useCallback((lat: number, lng: number) => {
    if (!map.current) return;

    if (marker.current) {
      marker.current.setLngLat([lng, lat]);
    } else {
      const el = document.createElement("div");
      el.className = "custom-marker";
      el.innerHTML = `
        <div style="transform: translateY(-50%);">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="hsl(var(--primary))" class="drop-shadow-lg">
            <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
          </svg>
        </div>
      `;

      marker.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, lat])
        .addTo(map.current);
    }
  }, []);

  // Sync marker with coordinates
  useEffect(() => {
    if (mapLoaded && hasCoordinates) {
      updateMarker(currentLat!, currentLng!);
      map.current?.flyTo({ center: [currentLng!, currentLat!], zoom: 12 });
    }
  }, [mapLoaded, currentLat, currentLng, updateMarker, hasCoordinates]);

  // Location search handlers
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.length < 3) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }
    
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data, error } = await supabase.functions.invoke("google-places-search", {
          body: { query }
        });
        
        if (error) throw error;
        
        if (data?.suggestions && data.suggestions.length > 0) {
          setSearchResults(data.suggestions);
          setShowSuggestions(true);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.error("Search failed:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectSearchResult = useCallback(async (result: GooglePlacesSuggestion) => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-places-search", {
        body: { place_id: result.place_id }
      });
      
      if (error) throw error;
      
      if (data?.success && data.latitude && data.longitude) {
        setPendingCoords({ lat: data.latitude, lng: data.longitude });
        updateMarker(data.latitude, data.longitude);
        map.current?.flyTo({ 
          center: [data.longitude, data.latitude], 
          zoom: 14 
        });
        onLocationChange?.(data.latitude, data.longitude);
      } else {
        toast.error("Could not get coordinates for this location");
      }
    } catch (err) {
      console.error("Failed to get place details:", err);
      toast.error("Failed to get location details");
    } finally {
      setSearchQuery("");
      setShowSuggestions(false);
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [updateMarker, onLocationChange]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const mapHeight = compact ? "h-32" : "h-48";

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Search input (only in editable mode) */}
      {editable && (
        <div ref={searchContainerRef} className="relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSuggestions(true)}
              placeholder="Search location..."
              className="pl-8 pr-8 h-9"
            />
            {isSearching && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          
          {/* Suggestions Dropdown */}
          {showSuggestions && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
              {searchResults.map((result, i) => (
                <button
                  key={result.place_id || i}
                  className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/50 last:border-0"
                  onClick={() => handleSelectSearchResult(result)}
                >
                  <div className="font-medium text-sm">{result.main_text}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {result.secondary_text}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Map */}
      <div className={`relative rounded-lg overflow-hidden border border-border ${mapHeight}`}>
        <div ref={mapContainer} className="w-full h-full" />
        
        {/* Loading overlay */}
        {!mapboxToken && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* No location overlay */}
        {mapboxToken && !hasCoordinates && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80 pointer-events-none">
            <div className="text-center text-muted-foreground">
              <MapPin className="h-6 w-6 mx-auto mb-1 opacity-50" />
              <p className="text-xs">
                {editable ? "Click map or search" : "No location set"}
              </p>
            </div>
          </div>
        )}

        {/* Coordinates badge */}
        {hasCoordinates && (
          <Badge 
            variant="secondary" 
            className="absolute bottom-2 left-2 text-xs font-mono bg-background/80 backdrop-blur"
          >
            {currentLat!.toFixed(4)}, {currentLng!.toFixed(4)}
          </Badge>
        )}
      </div>
    </div>
  );
}
