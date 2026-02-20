import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MapPin, Sun, Cloud, Thermometer, RefreshCw, Navigation, Zap, Locate, Database, Radio, Check, X, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSolcastForecast, SolcastForecastResponse } from "@/hooks/useSolcastForecast";
import { usePVGISProfile, PVGISTMYResponse, PVGISMonthlyResponse } from "@/hooks/usePVGISProfile";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface GooglePlacesSuggestion {
  place_id: string;
  place_name: string;
  main_text: string;
  secondary_text: string;
}

interface ProjectLocationMapProps {
  projectId: string;
  latitude?: number | null;
  longitude?: number | null;
  location?: string | null;
  onLocationUpdate?: (lat: number, lng: number) => void;
}

// South Africa bounds for initial view
const SA_BOUNDS = {
  center: [-29.0, 24.0] as [number, number],
  zoom: 5,
};

type DataSource = "pvgis_monthly" | "pvgis_tmy" | "solcast";

export function ProjectLocationMap({
  projectId,
  latitude,
  longitude,
  location,
  onLocationUpdate,
}: ProjectLocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const queryClient = useQueryClient();

  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeAttempted, setGeocodeAttempted] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>("pvgis_monthly");
  
  // Editable coordinate inputs
  const [editLat, setEditLat] = useState<string>("");
  const [editLng, setEditLng] = useState<string>("");
  const [isEditingCoords, setIsEditingCoords] = useState(false);
  
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

  // Solcast forecast hook
  const { data: solcastData, isLoading: solcastLoading, error: solcastError, fetchForecast } = useSolcastForecast();

  // PVGIS hooks (TMY and Monthly)
  const { tmyData, monthlyData, isLoadingTMY, isLoadingMonthly, tmyError, monthlyError, fetchTMY, fetchMonthlyRadiation, fetchBothDatasets } = usePVGISProfile();

  // Save location mutation
  const saveLocation = useMutation({
    mutationFn: async ({ lat, lng }: { lat: number; lng: number }) => {
      // Reverse geocode to get location text
      let locationText: string | null = null;
      try {
        const response = await supabase.functions.invoke('geocode-location', {
          body: { latitude: lat, longitude: lng, reverse: true }
        });
        if (!response.error && response.data) {
          const { municipality, province } = response.data;
          const parts = [municipality, province, 'South Africa'].filter(Boolean);
          locationText = parts.join(', ');
        }
      } catch (err) {
        console.error('Reverse geocoding for location text failed:', err);
      }

      const updateData: Record<string, any> = {
        latitude: lat,
        longitude: lng,
        updated_at: new Date().toISOString(),
      };
      if (locationText) {
        updateData.location = locationText;
      }

      const { error } = await supabase
        .from("projects")
        .update(updateData)
        .eq("id", projectId);
      if (error) throw error;
      return { lat, lng };
    },
    onSuccess: ({ lat, lng }) => {
      toast.success("Site location saved");
      setPendingCoords(null);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      onLocationUpdate?.(lat, lng);
      // Fetch data based on selected source
      if (dataSource === "solcast") {
        fetchForecast({ latitude: lat, longitude: lng, hours: 168 });
      } else {
        fetchBothDatasets({ latitude: lat, longitude: lng, projectId });
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to save location: ${error.message}`);
    },
  });

  // Auto-geocode when we have location text but no coordinates
  const geocodeLocation = useCallback(async () => {
    if (!location || latitude || longitude || geocodeAttempted) return;
    
    setIsGeocoding(true);
    setGeocodeAttempted(true);
    
    try {
      console.log(`Auto-geocoding location: ${location}`);
      const { data, error } = await supabase.functions.invoke("geocode-location", {
        body: { 
          project_id: projectId,
          location,
          save_to_project: true 
        },
      });

      if (error) throw error;

      if (data.success && data.latitude && data.longitude) {
        toast.success(`Location found: ${data.place_name}`);
        queryClient.invalidateQueries({ queryKey: ["project", projectId] });
        onLocationUpdate?.(data.latitude, data.longitude);
        
        if (map.current && mapLoaded) {
          updateMarker(data.latitude, data.longitude, false);
          map.current.flyTo({ center: [data.longitude, data.latitude], zoom: 12 });
        }
        
        // Fetch based on selected source
        if (dataSource === "solcast") {
          fetchForecast({ latitude: data.latitude, longitude: data.longitude, hours: 168 });
        } else {
          fetchBothDatasets({ latitude: data.latitude, longitude: data.longitude, projectId });
        }
      } else {
        toast.warning("Could not find coordinates for this location");
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
      toast.error("Failed to geocode location");
    } finally {
      setIsGeocoding(false);
    }
  }, [location, latitude, longitude, geocodeAttempted, projectId, mapLoaded, queryClient, onLocationUpdate, fetchForecast, fetchBothDatasets, dataSource]);

  // Trigger auto-geocode when map loads
  useEffect(() => {
    if (mapLoaded && location && !latitude && !longitude && !geocodeAttempted) {
      geocodeLocation();
    }
  }, [mapLoaded, location, latitude, longitude, geocodeAttempted, geocodeLocation]);

  const handleManualGeocode = () => {
    setGeocodeAttempted(false);
    setTimeout(() => geocodeLocation(), 100);
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || map.current) return;

    mapboxgl.accessToken = mapboxToken;

    const initialCenter = latitude && longitude 
      ? [longitude, latitude] as [number, number]
      : SA_BOUNDS.center;

    const initialZoom = latitude && longitude ? 12 : SA_BOUNDS.zoom;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: initialCenter,
      zoom: initialZoom,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.addControl(new mapboxgl.ScaleControl(), "bottom-left");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    map.current.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      setPendingCoords({ lat, lng });
      // Update editable inputs when clicking map
      setEditLat(lat.toFixed(6));
      setEditLng(lng.toFixed(6));
      setIsEditingCoords(false);
      updateMarker(lat, lng, true);
    });

    return () => {
      marker.current?.remove();
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, [mapboxToken]);

  const updateMarker = useCallback((lat: number, lng: number, isPending = false) => {
    if (!map.current) return;

    if (marker.current) {
      marker.current.setLngLat([lng, lat]);
    } else {
      const el = document.createElement("div");
      el.className = "custom-marker";
      // Dropped pin SVG icon
      const fillColor = isPending ? "#f59e0b" : "hsl(var(--primary))";
      el.innerHTML = `
        <div style="transform: translateY(-50%);">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="${fillColor}" class="drop-shadow-lg">
            <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
          </svg>
        </div>
      `;

      marker.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, lat])
        .addTo(map.current);
    }

    // Update pin color based on pending state
    const markerEl = marker.current.getElement();
    const svg = markerEl.querySelector("svg");
    if (svg) {
      const fillColor = isPending ? "#f59e0b" : "hsl(var(--primary))";
      svg.setAttribute("fill", fillColor);
    }
  }, []);

  // Sync edit fields with coordinates
  useEffect(() => {
    const lat = pendingCoords?.lat ?? latitude;
    const lng = pendingCoords?.lng ?? longitude;
    if (lat && lng && !isEditingCoords) {
      setEditLat(lat.toFixed(6));
      setEditLng(lng.toFixed(6));
    }
  }, [latitude, longitude, pendingCoords, isEditingCoords]);

  // Handle manual coordinate input
  const handleCoordinateChange = (type: "lat" | "lng", value: string) => {
    if (type === "lat") setEditLat(value);
    else setEditLng(value);
    setIsEditingCoords(true);
  };

  const handleApplyManualCoords = () => {
    const lat = parseFloat(editLat);
    const lng = parseFloat(editLng);
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error("Invalid coordinates. Latitude: -90 to 90, Longitude: -180 to 180");
      return;
    }
    
    setPendingCoords({ lat, lng });
    updateMarker(lat, lng, true);
    map.current?.flyTo({ center: [lng, lat], zoom: 12 });
    setIsEditingCoords(false);
  };

  const handleCancelCoordEdit = () => {
    setIsEditingCoords(false);
    const lat = pendingCoords?.lat ?? latitude;
    const lng = pendingCoords?.lng ?? longitude;
    setEditLat(lat?.toFixed(6) || "");
    setEditLng(lng?.toFixed(6) || "");
  };

  // Location search handlers - using Google Places API
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.length < 3) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }
    
    // Debounce search
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
    // Fetch place details to get coordinates
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-places-search", {
        body: { place_id: result.place_id }
      });
      
      if (error) throw error;
      
      if (data?.success && data.latitude && data.longitude) {
        setPendingCoords({ lat: data.latitude, lng: data.longitude });
        setEditLat(data.latitude.toFixed(6));
        setEditLng(data.longitude.toFixed(6));
        updateMarker(data.latitude, data.longitude, true);
        map.current?.flyTo({ 
          center: [data.longitude, data.latitude], 
          zoom: 14 
        });
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
  }, [updateMarker]);

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

  useEffect(() => {
    if (mapLoaded && latitude && longitude && !pendingCoords) {
      updateMarker(latitude, longitude, false);
      map.current?.flyTo({ center: [longitude, latitude], zoom: 12 });
    }
  }, [mapLoaded, latitude, longitude, pendingCoords, updateMarker]);

  // Fetch data when we have coordinates
  useEffect(() => {
    if (latitude && longitude) {
      if (dataSource === "solcast" && !solcastData && !solcastLoading) {
        fetchForecast({ latitude, longitude, hours: 168 });
      } else if ((dataSource === "pvgis_tmy" || dataSource === "pvgis_monthly") && !tmyData && !monthlyData && !isLoadingTMY && !isLoadingMonthly) {
        fetchBothDatasets({ latitude, longitude, projectId });
      }
    }
  }, [latitude, longitude, dataSource, solcastData, solcastLoading, tmyData, monthlyData, isLoadingTMY, isLoadingMonthly, fetchForecast, fetchBothDatasets, projectId]);

  // Handle data source change
  const handleDataSourceChange = (value: string) => {
    if (value === "pvgis_monthly" || value === "pvgis_tmy" || value === "solcast") {
      setDataSource(value);
      const lat = pendingCoords?.lat ?? latitude;
      const lng = pendingCoords?.lng ?? longitude;
      
      if (lat && lng) {
        if (value === "solcast" && !solcastData) {
          fetchForecast({ latitude: lat, longitude: lng, hours: 168 });
        } else if ((value === "pvgis_tmy" || value === "pvgis_monthly") && !tmyData && !monthlyData) {
          fetchBothDatasets({ latitude: lat, longitude: lng, projectId });
        }
      }
    }
  };

  const handleSaveLocation = () => {
    if (pendingCoords) {
      saveLocation.mutate(pendingCoords);
    }
  };

  const handleCancelPending = () => {
    setPendingCoords(null);
    if (latitude && longitude) {
      updateMarker(latitude, longitude, false);
    } else {
      marker.current?.remove();
      marker.current = null;
    }
  };

  const handleRefreshForecast = () => {
    const lat = pendingCoords?.lat ?? latitude;
    const lng = pendingCoords?.lng ?? longitude;
    if (lat && lng) {
      if (dataSource === "solcast") {
        fetchForecast({ latitude: lat, longitude: lng, hours: 168 });
      } else {
        fetchBothDatasets({ latitude: lat, longitude: lng, projectId });
      }
    }
  };

  const hasCoordinates = !!(latitude && longitude);
  const isLoading = dataSource === "solcast" ? solcastLoading : (isLoadingTMY || isLoadingMonthly);
  const currentError = dataSource === "solcast" ? solcastError : (tmyError || monthlyError);
  const pvgisData = dataSource === "pvgis_tmy" ? tmyData : monthlyData;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Map */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2 space-y-3">
          {/* Row 1: Title + Search */}
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base shrink-0">
              <MapPin className="h-4 w-4" />
              Site Location
            </CardTitle>
            
            {/* Location Search */}
            <div ref={searchContainerRef} className="relative flex-1 max-w-[280px]">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowSuggestions(true)}
                  placeholder="Search location..."
                  className="h-7 text-xs pl-7 pr-8"
                />
                {isSearching && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
              
              {/* Suggestions Dropdown */}
              {showSuggestions && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-[200px] overflow-y-auto">
                  {searchResults.map((result, i) => (
                    <button
                      key={result.place_id || i}
                      onClick={() => handleSelectSearchResult(result)}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-accent flex items-start gap-2 border-b border-border/50 last:border-0"
                    >
                      <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-medium truncate">{result.main_text}</span>
                        <span className="text-muted-foreground text-[10px] truncate">{result.secondary_text}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {location && (
              <Badge variant="outline" className="text-xs shrink-0 hidden sm:inline-flex">
                {location}
              </Badge>
            )}
          </div>
          
          {/* Row 2: Editable Coordinates */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 flex-1">
              <span className="text-xs text-muted-foreground w-7">Lat:</span>
              <Input
                type="text"
                value={editLat}
                onChange={(e) => handleCoordinateChange("lat", e.target.value)}
                placeholder="-34.0000"
                className="h-7 text-xs font-mono flex-1"
              />
            </div>
            <div className="flex items-center gap-1 flex-1">
              <span className="text-xs text-muted-foreground w-8">Long:</span>
              <Input
                type="text"
                value={editLng}
                onChange={(e) => handleCoordinateChange("lng", e.target.value)}
                placeholder="18.7013"
                className="h-7 text-xs font-mono flex-1"
              />
            </div>
            {isEditingCoords && (
              <div className="flex gap-1">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-7 w-7" 
                  onClick={handleCancelCoordEdit}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button 
                  size="icon" 
                  className="h-7 w-7" 
                  onClick={handleApplyManualCoords}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!mapboxToken ? (
            <Skeleton className="w-full h-[400px]" />
          ) : (
            <div className="relative">
              <div ref={mapContainer} className="w-full h-[400px] rounded-b-lg" />
              
              {isGeocoding && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-b-lg z-10">
                  <div className="text-center p-4">
                    <Locate className="h-8 w-8 mx-auto mb-2 text-primary animate-pulse" />
                    <p className="text-sm font-medium">Finding coordinates...</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Geocoding: {location}
                    </p>
                  </div>
                </div>
              )}

              {!hasCoordinates && !pendingCoords && !isGeocoding && mapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-b-lg">
                  <div className="text-center p-4">
                    <Navigation className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    {location ? (
                      <>
                        <p className="text-sm font-medium">Could not auto-locate: {location}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Click on the map to set location manually
                        </p>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="mt-3"
                          onClick={handleManualGeocode}
                        >
                          <Locate className="h-3.5 w-3.5 mr-1" />
                          Try Geocode Again
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">Click on the map to set site location</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          This will be used for solar irradiance data
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {pendingCoords && (
                <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur-sm rounded-lg p-3 border shadow-lg">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm">
                      <span className="font-medium">New location: </span>
                      <span className="font-mono text-xs">
                        {pendingCoords.lat.toFixed(6)}, {pendingCoords.lng.toFixed(6)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={handleCancelPending}>
                        Cancel
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={handleSaveLocation}
                        disabled={saveLocation.isPending}
                      >
                        {saveLocation.isPending ? "Saving..." : "Save Location"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Solar Data Panel */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sun className="h-4 w-4 text-amber-500" />
              Solar Data
            </CardTitle>
            {(hasCoordinates || pendingCoords) && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleRefreshForecast}
                disabled={isLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>
          
          {/* Data Source Toggle */}
          <ToggleGroup 
            type="single" 
            value={dataSource} 
            onValueChange={handleDataSourceChange}
            className="justify-start mt-2"
          >
            <ToggleGroupItem value="pvgis_monthly" size="sm" className="text-xs gap-1">
              <Database className="h-3 w-3" />
              Monthly Avg
            </ToggleGroupItem>
            <ToggleGroupItem value="pvgis_tmy" size="sm" className="text-xs gap-1">
              <Database className="h-3 w-3" />
              TMY
            </ToggleGroupItem>
            <ToggleGroupItem value="solcast" size="sm" className="text-xs gap-1">
              <Radio className="h-3 w-3" />
              Solcast
            </ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          {!hasCoordinates && !pendingCoords ? (
            <div className="text-center py-8">
              <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Set site location to view data</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : currentError ? (
            <div className="text-center py-8">
              <Cloud className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{currentError}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={handleRefreshForecast}>
                Try Again
              </Button>
            </div>
          ) : dataSource === "solcast" && solcastData ? (
            <SolcastSummaryDisplay data={solcastData} />
          ) : (dataSource === "pvgis_tmy" || dataSource === "pvgis_monthly") && pvgisData ? (
            <PVGISSummaryDisplay data={pvgisData} dataType={dataSource} />
          ) : (
            <div className="text-center py-8">
              <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Loading solar data...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// PVGIS display component (works for both TMY and Monthly)
function PVGISSummaryDisplay({ data, dataType }: { data: PVGISTMYResponse | PVGISMonthlyResponse; dataType: "pvgis_tmy" | "pvgis_monthly" }) {
  const { summary, monthly } = data;

  // Month names for display
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="space-y-4">
      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-500/10 rounded-lg p-3 text-center">
          <Sun className="h-5 w-5 mx-auto mb-1 text-amber-500" />
          <div className="text-lg font-bold">{summary.peakSunHours.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">Peak Sun Hours</div>
        </div>
        <div className="bg-primary/10 rounded-lg p-3 text-center">
          <Zap className="h-5 w-5 mx-auto mb-1 text-primary" />
          <div className="text-lg font-bold">{summary.dailyGhiKwh.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">kWh/m²/day</div>
        </div>
      </div>

      {/* Annual total */}
      <div className="bg-muted/30 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-primary">{summary.annualGhiKwh.toFixed(0)}</div>
        <div className="text-xs text-muted-foreground">kWh/m²/year</div>
      </div>

      {/* Monthly breakdown */}
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2">Monthly Average (kWh/m²/day)</div>
        <div className="grid grid-cols-4 gap-1">
          {monthly.map((m) => (
            <div
              key={m.month}
              className="text-center py-1.5 px-1 rounded bg-muted/30"
            >
              <div className="text-xs text-muted-foreground">{monthNames[m.month - 1]}</div>
              <div className="text-xs font-mono font-medium">{m.avgDailyGhi.toFixed(1)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Temperature */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
        <Thermometer className="h-3.5 w-3.5" />
        <span>Avg Temperature: {summary.avgTemp.toFixed(1)}°C</span>
      </div>

      {/* Data source */}
      <div className="text-xs text-muted-foreground text-center pt-2 border-t">
        <Badge variant="secondary" className="text-xs">
          {dataType === "pvgis_monthly" ? "19-Yr Avg" : "TMY"}
        </Badge>
        <span className="ml-2">
          PVGIS • {dataType === "pvgis_monthly" ? "2005-2023 Average" : "Typical Year"}
        </span>
      </div>
    </div>
  );
}

// Solcast summary display component
function SolcastSummaryDisplay({ data }: { data: SolcastForecastResponse }) {
  const { summary, daily } = data;
  const next7Days = daily?.slice(0, 7) || [];

  return (
    <div className="space-y-4">
      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-500/10 rounded-lg p-3 text-center">
          <Sun className="h-5 w-5 mx-auto mb-1 text-amber-500" />
          <div className="text-lg font-bold">{summary.average_peak_sun_hours.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">Peak Sun Hours</div>
        </div>
        <div className="bg-primary/10 rounded-lg p-3 text-center">
          <Zap className="h-5 w-5 mx-auto mb-1 text-primary" />
          <div className="text-lg font-bold">{summary.average_daily_ghi_kwh_m2.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground">kWh/m²/day</div>
        </div>
      </div>

      {/* 7-day mini forecast */}
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2">7-Day Forecast</div>
        <div className="space-y-1.5">
          {next7Days.map((day, i) => {
            const date = new Date(day.date);
            const dayName = i === 0 ? "Today" : date.toLocaleDateString("en-ZA", { weekday: "short" });
            const cloudOpacity = day.cloud_opacity_avg ?? 0;
            const isCloudyDay = cloudOpacity > 50;

            return (
              <div
                key={day.date}
                className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-muted/30"
              >
                <span className="text-xs w-12">{dayName}</span>
                <div className="flex items-center gap-1">
                  {isCloudyDay ? (
                    <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono">{day.peak_sun_hours.toFixed(1)}h</span>
                  <span className="text-muted-foreground">{day.ghi_kwh_m2.toFixed(1)} kWh/m²</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Temperature */}
      {next7Days[0]?.air_temp_avg !== null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
          <Thermometer className="h-3.5 w-3.5" />
          <span>
            Today: {next7Days[0]?.air_temp_min?.toFixed(0)}° - {next7Days[0]?.air_temp_max?.toFixed(0)}°C
          </span>
        </div>
      )}

      {/* Data source */}
      <div className="text-xs text-muted-foreground text-center pt-2 border-t">
        <Badge variant="secondary" className="text-xs">Forecast</Badge>
        <span className="ml-2">Powered by Solcast • {summary.total_forecast_days} days</span>
      </div>
    </div>
  );
}
