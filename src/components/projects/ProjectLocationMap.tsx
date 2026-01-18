import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Sun, Cloud, Thermometer, RefreshCw, Navigation, Zap } from "lucide-react";
import { toast } from "sonner";
import { useSolcastForecast, SolcastForecastResponse } from "@/hooks/useSolcastForecast";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

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

  // Fetch Mapbox token
  const { data: mapboxToken } = useQuery({
    queryKey: ["mapbox-token"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-mapbox-token");
      if (error) throw error;
      return data.token as string;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Solcast forecast hook
  const { data: solcastData, isLoading: solcastLoading, error: solcastError, fetchForecast } = useSolcastForecast();

  // Save location mutation
  const saveLocation = useMutation({
    mutationFn: async ({ lat, lng }: { lat: number; lng: number }) => {
      const { error } = await supabase
        .from("projects")
        .update({ latitude: lat, longitude: lng, updated_at: new Date().toISOString() })
        .eq("id", projectId);
      if (error) throw error;
      return { lat, lng };
    },
    onSuccess: ({ lat, lng }) => {
      toast.success("Site location saved");
      setPendingCoords(null);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      onLocationUpdate?.(lat, lng);
      // Fetch forecast for new location
      fetchForecast({ latitude: lat, longitude: lng, hours: 168 });
    },
    onError: (error: Error) => {
      toast.error(`Failed to save location: ${error.message}`);
    },
  });

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

    // Click to set location
    map.current.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      setPendingCoords({ lat, lng });
      updateMarker(lat, lng, true);
    });

    return () => {
      marker.current?.remove();
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, [mapboxToken]);

  // Update marker position
  const updateMarker = useCallback((lat: number, lng: number, isPending = false) => {
    if (!map.current) return;

    if (marker.current) {
      marker.current.setLngLat([lng, lat]);
    } else {
      const el = document.createElement("div");
      el.className = "custom-marker";
      el.innerHTML = `
        <div class="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="4"/>
            <line x1="21.17" x2="12" y1="8" y2="8"/>
            <line x1="3.95" x2="8.54" y1="6.06" y2="14"/>
            <line x1="10.88" x2="15.46" y1="21.94" y2="14"/>
          </svg>
        </div>
      `;

      marker.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map.current);
    }

    // Update marker style based on pending state
    const markerEl = marker.current.getElement();
    const innerDiv = markerEl.querySelector("div");
    if (innerDiv) {
      innerDiv.className = isPending
        ? "w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-pulse"
        : "w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-white";
    }
  }, []);

  // Set initial marker if coordinates exist
  useEffect(() => {
    if (mapLoaded && latitude && longitude && !pendingCoords) {
      updateMarker(latitude, longitude, false);
      map.current?.flyTo({ center: [longitude, latitude], zoom: 12 });
    }
  }, [mapLoaded, latitude, longitude, pendingCoords, updateMarker]);

  // Fetch Solcast data when we have coordinates
  useEffect(() => {
    if (latitude && longitude && !solcastData && !solcastLoading) {
      fetchForecast({ latitude, longitude, hours: 168 });
    }
  }, [latitude, longitude, solcastData, solcastLoading, fetchForecast]);

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
      fetchForecast({ latitude: lat, longitude: lng, hours: 168 });
    }
  };

  const hasCoordinates = !!(latitude && longitude);
  const displayLat = pendingCoords?.lat ?? latitude;
  const displayLng = pendingCoords?.lng ?? longitude;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Map */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              Site Location
            </CardTitle>
            <div className="flex items-center gap-2">
              {location && (
                <Badge variant="outline" className="text-xs">
                  {location}
                </Badge>
              )}
              {hasCoordinates && (
                <Badge variant="secondary" className="text-xs font-mono">
                  {latitude?.toFixed(4)}, {longitude?.toFixed(4)}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!mapboxToken ? (
            <Skeleton className="w-full h-[400px]" />
          ) : (
            <div className="relative">
              <div ref={mapContainer} className="w-full h-[400px] rounded-b-lg" />
              
              {/* Instructions overlay */}
              {!hasCoordinates && !pendingCoords && mapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-b-lg">
                  <div className="text-center p-4">
                    <Navigation className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Click on the map to set site location</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This will be used for solar irradiance forecasts
                    </p>
                  </div>
                </div>
              )}

              {/* Pending location actions */}
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

      {/* Solar Forecast Panel */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sun className="h-4 w-4 text-amber-500" />
              Solar Forecast
            </CardTitle>
            {(hasCoordinates || pendingCoords) && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleRefreshForecast}
                disabled={solcastLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${solcastLoading ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasCoordinates && !pendingCoords ? (
            <div className="text-center py-8">
              <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Set site location to view forecast</p>
            </div>
          ) : solcastLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : solcastError ? (
            <div className="text-center py-8">
              <Cloud className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{solcastError}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={handleRefreshForecast}>
                Try Again
              </Button>
            </div>
          ) : solcastData ? (
            <SolcastSummaryDisplay data={solcastData} />
          ) : (
            <div className="text-center py-8">
              <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Loading forecast data...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Solcast summary display component
function SolcastSummaryDisplay({ data }: { data: SolcastForecastResponse }) {
  const { summary, daily } = data;

  // Get next 7 days for mini forecast
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

      {/* Temperature range if available */}
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
        Powered by Solcast • {summary.total_forecast_days} days forecast
      </div>
    </div>
  );
}