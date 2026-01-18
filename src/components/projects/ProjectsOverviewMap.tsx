import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Map, MapPin, Maximize2, Minimize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface Project {
  id: string;
  name: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface ProjectsOverviewMapProps {
  projects: Project[];
  onProjectClick?: (projectId: string) => void;
}

export function ProjectsOverviewMap({ projects, onProjectClick }: ProjectsOverviewMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

  // Get projects with coordinates
  const projectsWithCoords = projects.filter(p => p.latitude && p.longitude);

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
    if (!mapContainer.current || !mapboxToken || map.current) return;

    mapboxgl.accessToken = mapboxToken;

    // Calculate bounds or use South Africa center
    let center: [number, number] = [25.0, -29.0]; // South Africa center
    let zoom = 5;

    if (projectsWithCoords.length === 1) {
      center = [projectsWithCoords[0].longitude!, projectsWithCoords[0].latitude!];
      zoom = 10;
    } else if (projectsWithCoords.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      projectsWithCoords.forEach(p => {
        bounds.extend([p.longitude!, p.latitude!]);
      });
      center = bounds.getCenter().toArray() as [number, number];
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center,
      zoom,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      setMapLoaded(true);

      // Fit bounds if multiple projects
      if (projectsWithCoords.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        projectsWithCoords.forEach(p => {
          bounds.extend([p.longitude!, p.latitude!]);
        });
        map.current?.fitBounds(bounds, { padding: 50, maxZoom: 12 });
      }
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken]);

  // Add markers when map is loaded
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add markers for each project
    projectsWithCoords.forEach(project => {
      const el = document.createElement("div");
      el.className = "project-marker";
      el.style.cssText = `
        width: 32px;
        height: 32px;
        background: hsl(var(--primary));
        border: 3px solid white;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: transform 0.2s;
      `;
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
      
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.2)";
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
      });

      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setHTML(`
          <div style="padding: 8px;">
            <strong style="font-size: 14px;">${project.name}</strong>
            ${project.location ? `<p style="margin: 4px 0 0; font-size: 12px; color: #666;">${project.location}</p>` : ''}
          </div>
        `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([project.longitude!, project.latitude!])
        .setPopup(popup)
        .addTo(map.current!);

      el.addEventListener("click", () => {
        if (onProjectClick) {
          onProjectClick(project.id);
        }
      });

      markersRef.current.push(marker);
    });
  }, [mapLoaded, projectsWithCoords, onProjectClick]);

  // Resize map when expanded/collapsed
  useEffect(() => {
    if (map.current) {
      setTimeout(() => {
        map.current?.resize();
        
        // Refit bounds when expanding
        if (isExpanded && projectsWithCoords.length > 1) {
          const bounds = new mapboxgl.LngLatBounds();
          projectsWithCoords.forEach(p => {
            bounds.extend([p.longitude!, p.latitude!]);
          });
          map.current?.fitBounds(bounds, { padding: 50, maxZoom: 12 });
        }
      }, 100);
    }
  }, [isExpanded]);

  if (projectsWithCoords.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground text-center">
            No projects with coordinates yet.<br />
            Coordinates are auto-geocoded from location text.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isExpanded ? "col-span-full" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Map className="h-4 w-4" />
            Project Locations
            <span className="text-sm font-normal text-muted-foreground">
              ({projectsWithCoords.length} of {projects.length})
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={mapContainer}
          className={`w-full rounded-b-lg transition-all ${isExpanded ? "h-[500px]" : "h-[250px]"}`}
        >
          {!mapLoaded && (
            <Skeleton className="w-full h-full" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
