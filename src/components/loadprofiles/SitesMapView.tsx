import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface Site {
  id: string;
  name: string;
  site_type: string | null;
  latitude: number | null;
  longitude: number | null;
  location: string | null;
  total_area_sqm: number | null;
  created_at: string;
  meter_count?: number;
  meters_with_data?: number;
  meters_listed_only?: number;
}

interface SitesMapViewProps {
  sites: Site[];
  onSiteSelect?: (site: Site) => void;
  onLocationSet?: (siteId: string, lat: number, lng: number) => void;
  onCreateSiteAtLocation?: (lat: number, lng: number) => void;
  selectedSiteId?: string | null;
}

// South Africa center for default view
const SA_CENTER: [number, number] = [24.0, -29.0];

export function SitesMapView({
  sites,
  onSiteSelect,
  onLocationSet,
  onCreateSiteAtLocation,
  selectedSiteId,
}: SitesMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const tempMarkerRef = useRef<mapboxgl.Marker | null>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [siteWithoutLocation, setSiteWithoutLocation] = useState<Site | null>(null);

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

  // Sites without coordinates
  const sitesWithoutLocation = sites.filter(s => !s.latitude || !s.longitude);
  const sitesWithLocation = sites.filter(s => s.latitude && s.longitude);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || map.current) return;

    mapboxgl.accessToken = mapboxToken;

    // Calculate bounds from sites with coordinates
    let initialCenter = SA_CENTER;
    let initialZoom = 5;

    if (sitesWithLocation.length > 0) {
      const lats = sitesWithLocation.map(s => s.latitude!);
      const lngs = sitesWithLocation.map(s => s.longitude!);
      initialCenter = [
        (Math.min(...lngs) + Math.max(...lngs)) / 2,
        (Math.min(...lats) + Math.max(...lats)) / 2,
      ];
      if (sitesWithLocation.length === 1) {
        initialZoom = 12;
      } else {
        initialZoom = 6;
      }
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    // Click handler for placing pins
    map.current.on("click", (e) => {
      if (isPlacingPin && siteWithoutLocation) {
        const { lng, lat } = e.lngLat;
        setPendingLocation({ lat, lng });
        
        // Show temporary marker
        if (tempMarkerRef.current) {
          tempMarkerRef.current.remove();
        }
        
        const el = createMarkerElement(siteWithoutLocation.name, true);
        tempMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([lng, lat])
          .addTo(map.current!);
      }
    });

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
      tempMarkerRef.current?.remove();
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken]);

  // Create marker element
  const createMarkerElement = useCallback((name: string, isPending = false, isSelected = false) => {
    const el = document.createElement("div");
    el.className = "site-marker";
    el.style.cursor = "pointer";
    
    const color = isPending 
      ? "hsl(45, 93%, 47%)" // amber for pending
      : isSelected 
        ? "hsl(142, 76%, 36%)" // green for selected
        : "hsl(var(--primary))";
    
    el.innerHTML = `
      <div style="transform: translateY(-50%); position: relative;">
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="${color}" class="drop-shadow-lg">
          <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
        </svg>
        <div style="
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          color: hsl(var(--foreground));
        ">
          ${name}
        </div>
      </div>
    `;
    
    return el;
  }, []);

  // Update markers when sites change
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    // Remove old markers
    markersRef.current.forEach((marker, id) => {
      if (!sitesWithLocation.find(s => s.id === id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add/update markers
    sitesWithLocation.forEach(site => {
      const isSelected = site.id === selectedSiteId;
      const existing = markersRef.current.get(site.id);
      
      if (existing) {
        existing.setLngLat([site.longitude!, site.latitude!]);
        // Update marker appearance if selection changed
        const el = createMarkerElement(site.name, false, isSelected);
        existing.getElement().innerHTML = el.innerHTML;
      } else {
        const el = createMarkerElement(site.name, false, isSelected);
        
        const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([site.longitude!, site.latitude!])
          .addTo(map.current!);
        
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSiteSelect?.(site);
        });
        
        markersRef.current.set(site.id, marker);
      }
    });

    // Fit bounds if we have sites
    if (sitesWithLocation.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      sitesWithLocation.forEach(site => {
        bounds.extend([site.longitude!, site.latitude!]);
      });
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 12 });
    } else if (sitesWithLocation.length === 1) {
      map.current.flyTo({
        center: [sitesWithLocation[0].longitude!, sitesWithLocation[0].latitude!],
        zoom: 12,
      });
    }
  }, [mapLoaded, sitesWithLocation, selectedSiteId, onSiteSelect, createMarkerElement]);

  // Start placing pin for a site
  const startPlacingPin = (site: Site) => {
    setSiteWithoutLocation(site);
    setIsPlacingPin(true);
    setPendingLocation(null);
    toast.info(`Click on the map to set location for "${site.name}"`);
  };

  // Cancel pin placement
  const cancelPlacement = () => {
    setIsPlacingPin(false);
    setSiteWithoutLocation(null);
    setPendingLocation(null);
    tempMarkerRef.current?.remove();
    tempMarkerRef.current = null;
  };

  // Confirm pin placement
  const confirmPlacement = () => {
    if (pendingLocation && siteWithoutLocation) {
      onLocationSet?.(siteWithoutLocation.id, pendingLocation.lat, pendingLocation.lng);
      cancelPlacement();
    }
  };

  return (
    <div className="relative h-[600px] rounded-lg overflow-hidden border border-border">
      {/* Map container */}
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Loading overlay */}
      {!mapboxToken && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Sites without location panel */}
      {sitesWithoutLocation.length > 0 && !isPlacingPin && (
        <Card className="absolute top-4 left-4 p-3 max-w-xs bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Sites without location</span>
            <Badge variant="secondary" className="ml-auto">{sitesWithoutLocation.length}</Badge>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {sitesWithoutLocation.slice(0, 5).map(site => (
              <Button
                key={site.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-7"
                onClick={() => startPlacingPin(site)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {site.name}
              </Button>
            ))}
            {sitesWithoutLocation.length > 5 && (
              <p className="text-xs text-muted-foreground px-2">
                +{sitesWithoutLocation.length - 5} more...
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Pin placement mode */}
      {isPlacingPin && siteWithoutLocation && (
        <Card className="absolute top-4 left-1/2 -translate-x-1/2 p-3 bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Setting location for:</span>{" "}
              <span className="font-medium">{siteWithoutLocation.name}</span>
            </div>
            {pendingLocation ? (
              <>
                <Badge variant="secondary" className="font-mono text-xs">
                  {pendingLocation.lat.toFixed(4)}, {pendingLocation.lng.toFixed(4)}
                </Badge>
                <Button size="sm" onClick={confirmPlacement}>
                  Confirm
                </Button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Click map to place pin</span>
            )}
            <Button size="sm" variant="ghost" onClick={cancelPlacement}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Stats badge */}
      <Badge 
        variant="secondary" 
        className="absolute bottom-4 left-4 bg-background/80 backdrop-blur"
      >
        {sitesWithLocation.length} / {sites.length} sites mapped
      </Badge>
    </div>
  );
}
