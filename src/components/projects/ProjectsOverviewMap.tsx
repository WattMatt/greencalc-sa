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
  fullHeight?: boolean;
}

export function ProjectsOverviewMap({ projects, onProjectClick, fullHeight = false }: ProjectsOverviewMapProps) {
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
      // Outer wrapper gives a stable hit area that doesn't move
      const wrapper = document.createElement("div");
      wrapper.style.cssText = `
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      `;

      const el = document.createElement("div");
      el.style.cssText = `
        width: 32px;
        height: 32px;
        background: hsl(var(--primary));
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: box-shadow 0.2s, border-color 0.2s;
        pointer-events: none;
      `;
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;

      wrapper.appendChild(el);

      // Hover tooltip - shows name on hover
      const tooltip = new mapboxgl.Popup({
        offset: 20,
        closeButton: false,
        closeOnClick: false,
        className: "marker-tooltip",
      }).setHTML(`
        <div style="padding: 6px 10px; font-family: system-ui, sans-serif;">
          <strong style="font-size: 13px;">${project.name}</strong>
          ${project.location ? `<br/><span style="font-size: 11px; color: #666;">${project.location}</span>` : ''}
        </div>
      `);

      wrapper.addEventListener("mouseenter", () => {
        el.style.boxShadow = "0 4px 16px rgba(0,0,0,0.4)";
        el.style.borderColor = "hsl(var(--primary))";
        // Show tooltip on hover (only if click popup isn't open)
        if (!marker.getPopup()?.isOpen()) {
          tooltip.setLngLat([project.longitude!, project.latitude!]).addTo(map.current!);
        }
      });
      wrapper.addEventListener("mouseleave", () => {
        el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
        el.style.borderColor = "white";
        tooltip.remove();
      });

      // Click popup - shows full info card with Open button
      const popupId = `popup-btn-${project.id}`;
      const popup = new mapboxgl.Popup({ offset: 25, closeButton: true, maxWidth: "280px" })
        .setHTML(`
          <div style="padding: 12px; font-family: system-ui, sans-serif;">
            <strong style="font-size: 15px; display: block; margin-bottom: 4px;">${project.name}</strong>
            ${project.location ? `<p style="margin: 0 0 8px; font-size: 13px; color: #666;">📍 ${project.location}</p>` : '<p style="margin: 0 0 8px; font-size: 13px; color: #999;">No location set</p>'}
            <button id="${popupId}" style="
              width: 100%;
              padding: 8px 16px;
              background: hsl(221.2, 83.2%, 53.3%);
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
            ">Open Project →</button>
          </div>
        `);

      popup.on("open", () => {
        tooltip.remove(); // Hide tooltip when click popup opens
        const btn = document.getElementById(popupId);
        if (btn && onProjectClick) {
          btn.addEventListener("click", () => onProjectClick(project.id));
        }
      });

      const marker = new mapboxgl.Marker({ element: wrapper, anchor: "center" })
        .setLngLat([project.longitude!, project.latitude!])
        .setPopup(popup)
        .addTo(map.current!);

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
          className={`w-full rounded-b-lg transition-all ${fullHeight ? "h-[calc(100vh-220px)]" : isExpanded ? "h-[500px]" : "h-[250px]"}`}
        >
          {!mapLoaded && (
            <Skeleton className="w-full h-full" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
