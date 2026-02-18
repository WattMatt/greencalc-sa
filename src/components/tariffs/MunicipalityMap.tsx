import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// South African province colors (using province codes from ArcGIS)
const PROVINCE_COLORS: Record<string, string> = {
  "GT": "#ef4444",  // Gauteng
  "WC": "#f97316",  // Western Cape
  "KZN": "#eab308", // KwaZulu-Natal
  "EC": "#22c55e",  // Eastern Cape
  "MP": "#14b8a6",  // Mpumalanga
  "LIM": "#3b82f6", // Limpopo
  "NW": "#8b5cf6",  // North West
  "FS": "#ec4899",  // Free State
  "NC": "#6b7280",  // Northern Cape
};

const PROVINCE_CODE_TO_NAME: Record<string, string> = {
  "GT": "Gauteng",
  "WC": "Western Cape",
  "KZN": "KwaZulu-Natal",
  "EC": "Eastern Cape",
  "MP": "Mpumalanga",
  "LIM": "Limpopo",
  "NW": "North West",
  "FS": "Free State",
  "NC": "Northern Cape",
};

const PROVINCE_NAME_TO_CODE: Record<string, string> = {
  "Gauteng": "GT",
  "Western Cape": "WC",
  "KwaZulu-Natal": "KZN",
  "Eastern Cape": "EC",
  "Mpumalanga": "MP",
  "Limpopo": "LIM",
  "North West": "NW",
  "Free State": "FS",
  "Northern Cape": "NC",
};

// Extraction status colors
const STATUS_COLORS = {
  done: "#22c55e",     // Green - completed
  error: "#ef4444",    // Red - error
  pending: "#f59e0b",  // Amber - pending
  none: "#94a3b8",     // Gray - not in database
};

type FilterType = "all" | "database" | "done" | "pending" | "error";

interface DbMunicipality {
  id: string;
  name: string;
  extraction_status: string | null;
  ai_confidence: number | null;
  total_tariffs: number | null;
  tariff_count: number;
  province: { name: string };
}

interface MunicipalityMapProps {
  onMunicipalityClick?: (municipalityId: string, municipalityName: string) => void;
}

// ArcGIS Feature Service URL for SA Local Municipality Boundaries
const ARCGIS_BOUNDARY_URL = "https://services7.arcgis.com/vhM1EF9boZaqDxYt/arcgis/rest/services/SA_Local_Municipal_Boundary/FeatureServer/0/query";

export function MunicipalityMap({ onMunicipalityClick }: MunicipalityMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [dbMunicipalities, setDbMunicipalities] = useState<DbMunicipality[]>([]);
  const [boundaryGeoJSON, setBoundaryGeoJSON] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingBoundaries, setLoadingBoundaries] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

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

  // Fetch municipalities from database with actual tariff counts
  useEffect(() => {
    async function fetchMunicipalities() {
      try {
        // Fetch municipalities
        const { data: muniData, error: muniError } = await supabase
          .from("municipalities")
          .select("id, name, nersa_increase_pct, province:provinces(name)") as any;
        
        if (muniError) throw muniError;
        
        // Fetch actual tariff counts per municipality
        const { data: tariffCounts, error: tariffError } = await supabase
          .from("tariff_plans")
          .select("municipality_id") as any;
        
        if (tariffError) throw tariffError;
        
        // Count tariffs per municipality
        const countMap = new Map<string, number>();
        (tariffCounts || []).forEach((t: any) => {
          const count = countMap.get(t.municipality_id) || 0;
          countMap.set(t.municipality_id, count + 1);
        });
        
        // Merge counts with municipality data
        const enrichedData = (muniData || []).map((m: any) => ({
          ...m,
          tariff_count: countMap.get(m.id) || 0,
        }));
        
        setDbMunicipalities(enrichedData as DbMunicipality[]);
      } catch (err) {
        console.error("Failed to fetch municipalities:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMunicipalities();
  }, []);

  // Fetch boundary GeoJSON from ArcGIS
  useEffect(() => {
    async function fetchBoundaries() {
      setLoadingBoundaries(true);
      try {
        const params = new URLSearchParams({
          where: "1=1",
          outFields: "MUNICNAME,PROVINCE,CAT_B,DISTRICT",
          f: "geojson",
          outSR: "4326",
        });

        const response = await fetch(`${ARCGIS_BOUNDARY_URL}?${params}`);
        if (!response.ok) throw new Error("Failed to fetch boundaries");
        
        const geojson = await response.json();
        console.log(`Loaded ${geojson.features?.length || 0} municipality boundaries`);
        setBoundaryGeoJSON(geojson);
      } catch (err) {
        console.error("Failed to fetch boundary data:", err);
      } finally {
        setLoadingBoundaries(false);
      }
    }
    fetchBoundaries();
  }, []);

  // Helper to normalize municipality names for matching
  const normalizeName = useCallback((name: string): string => {
    return name
      .toUpperCase()
      .replace(/\s+LOCAL\s+MUNICIPALITY/gi, "")
      .replace(/\s+MUNICIPALITY/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  // Find database municipality matching boundary
  const findDbMunicipality = useCallback((boundaryName: string, provinceCode: string): DbMunicipality | null => {
    const normalizedBoundary = normalizeName(boundaryName);
    const provinceName = PROVINCE_CODE_TO_NAME[provinceCode];
    
    return dbMunicipalities.find(m => {
      const normalizedDb = normalizeName(m.name);
      const dbProvinceCode = PROVINCE_NAME_TO_CODE[m.province?.name];
      
      // Match by name and province
      if (normalizedDb === normalizedBoundary && dbProvinceCode === provinceCode) {
        return true;
      }
      
      // Partial match for names that contain each other
      if (dbProvinceCode === provinceCode) {
        if (normalizedDb.includes(normalizedBoundary) || normalizedBoundary.includes(normalizedDb)) {
          return true;
        }
      }
      
      return false;
    }) || null;
  }, [dbMunicipalities, normalizeName]);

  // Initialize map and add boundaries
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || map.current) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [25.0, -29.0],
      zoom: 5,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken]);

  // Get filter expression for map layers
  const getFilterExpression = useCallback((filterType: FilterType): any => {
    switch (filterType) {
      case "database":
        return ["==", ["get", "inDatabase"], true];
      case "done":
        return ["all", ["==", ["get", "inDatabase"], true], ["==", ["get", "extractionStatus"], "done"]];
      case "pending":
        return ["all", ["==", ["get", "inDatabase"], true], ["==", ["get", "extractionStatus"], "pending"]];
      case "error":
        return ["all", ["==", ["get", "inDatabase"], true], ["==", ["get", "extractionStatus"], "error"]];
      default:
        return null; // Show all
    }
  }, []);

  // Add boundary layers when data is ready
  useEffect(() => {
    if (!map.current || !boundaryGeoJSON) return;

    const addBoundaryLayers = () => {
      // Remove existing layers and source if they exist
      if (map.current?.getLayer("municipality-boundaries-fill")) {
        map.current.removeLayer("municipality-boundaries-fill");
      }
      if (map.current?.getLayer("municipality-boundaries-line")) {
        map.current.removeLayer("municipality-boundaries-line");
      }
      if (map.current?.getLayer("municipality-boundaries-highlight")) {
        map.current.removeLayer("municipality-boundaries-highlight");
      }
      if (map.current?.getSource("municipality-boundaries")) {
        map.current.removeSource("municipality-boundaries");
      }

      // Enhance GeoJSON with database status
      const enhancedFeatures = boundaryGeoJSON.features.map((feature: any) => {
        const municName = feature.properties?.MUNICNAME || "";
        const provinceCode = feature.properties?.PROVINCE || "";
        const dbMuni = findDbMunicipality(municName, provinceCode);
        
        return {
          ...feature,
          properties: {
            ...feature.properties,
            inDatabase: !!dbMuni,
            extractionStatus: dbMuni?.extraction_status || "none",
            aiConfidence: dbMuni?.ai_confidence || 0,
            totalTariffs: dbMuni?.tariff_count || 0, // Use actual tariff count
            dbName: dbMuni?.name || null,
          }
        };
      });

      const enhancedGeoJSON = {
        ...boundaryGeoJSON,
        features: enhancedFeatures,
      };

      // Add source
      map.current!.addSource("municipality-boundaries", {
        type: "geojson",
        data: enhancedGeoJSON,
      });

      // Create color expression for provinces
      const provinceColorExpression: any = ["match", ["get", "PROVINCE"]];
      Object.entries(PROVINCE_COLORS).forEach(([code, color]) => {
        provinceColorExpression.push(code, color);
      });
      provinceColorExpression.push("#94a3b8"); // Default color

      // Add fill layer (all municipalities with province colors)
      map.current!.addLayer({
        id: "municipality-boundaries-fill",
        type: "fill",
        source: "municipality-boundaries",
        paint: {
          "fill-color": provinceColorExpression,
          "fill-opacity": [
            "case",
            ["get", "inDatabase"], 0.4,
            0.15
          ],
        },
      });

      // Add highlight layer for municipalities in database
      map.current!.addLayer({
        id: "municipality-boundaries-highlight",
        type: "line",
        source: "municipality-boundaries",
        filter: ["==", ["get", "inDatabase"], true],
        paint: {
          "line-color": [
            "match",
            ["get", "extractionStatus"],
            "done", STATUS_COLORS.done,
            "error", STATUS_COLORS.error,
            "pending", STATUS_COLORS.pending,
            STATUS_COLORS.none
          ],
          "line-width": 3,
        },
      });

      // Add outline layer
      map.current!.addLayer({
        id: "municipality-boundaries-line",
        type: "line",
        source: "municipality-boundaries",
        paint: {
          "line-color": "#475569",
          "line-width": 0.5,
          "line-opacity": 0.5,
        },
      });

      // Add hover effect
      map.current!.on("mousemove", "municipality-boundaries-fill", (e) => {
        if (!map.current) return;
        map.current.getCanvas().style.cursor = "pointer";
      });

      map.current!.on("mouseleave", "municipality-boundaries-fill", () => {
        if (!map.current) return;
        map.current.getCanvas().style.cursor = "";
      });

      // Add click popup
      map.current!.on("click", "municipality-boundaries-fill", (e) => {
        if (!e.features || e.features.length === 0) return;
        
        const feature = e.features[0];
        const props = feature.properties;
        const provinceName = PROVINCE_CODE_TO_NAME[props?.PROVINCE] || props?.PROVINCE;
        const inDb = props?.inDatabase;
        const status = props?.extractionStatus;
        const confidence = props?.aiConfidence;
        const tariffs = props?.totalTariffs;
        const dbName = props?.dbName;
        
        // Find the municipality ID from our data
        const dbMuni = dbMunicipalities.find(m => m.name === dbName);
        const municipalityId = dbMuni?.id;
        
        let statusBadge = "";
        let viewButton = "";
        if (inDb) {
          const statusColor = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.none;
          statusBadge = `
            <div style="margin-top: 8px; padding: 4px 8px; background: ${statusColor}20; border-left: 3px solid ${statusColor}; font-size: 11px;">
              <strong>In Database</strong><br/>
              Status: ${status || "pending"}<br/>
              ${confidence ? `Confidence: ${confidence}%<br/>` : ""}
              Tariffs: ${tariffs || 0}
            </div>
          `;
          if (tariffs > 0 && municipalityId) {
            viewButton = `
              <button 
                data-municipality-id="${municipalityId}"
                data-municipality-name="${dbName}"
                class="view-tariffs-btn"
                style="margin-top: 8px; width: 100%; padding: 6px 12px; background: hsl(142.1 76.2% 36.3%); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;"
              >
                View ${tariffs} Tariff${tariffs > 1 ? 's' : ''} →
              </button>
            `;
          }
        } else {
          statusBadge = `
            <div style="margin-top: 8px; padding: 4px 8px; background: #f1f5f9; font-size: 11px; color: #64748b;">
              Not in database
            </div>
          `;
        }

        const popup = new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="padding: 8px; min-width: 180px;">
              <strong style="font-size: 14px;">${props?.MUNICNAME}</strong>
              <div style="color: ${PROVINCE_COLORS[props?.PROVINCE] || "#64748b"}; font-size: 12px; margin-top: 2px;">
                ${provinceName}
              </div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                Code: ${props?.CAT_B || "N/A"}
              </div>
              ${statusBadge}
              ${viewButton}
            </div>
          `)
          .addTo(map.current!);

        // Add click handler for the view tariffs button
        setTimeout(() => {
          const btn = document.querySelector('.view-tariffs-btn');
          if (btn) {
            btn.addEventListener('click', (evt) => {
              const target = evt.target as HTMLButtonElement;
              const muniId = target.getAttribute('data-municipality-id');
              const muniName = target.getAttribute('data-municipality-name');
              if (muniId && muniName && onMunicipalityClick) {
                popup.remove();
                onMunicipalityClick(muniId, muniName);
              }
            });
          }
        }, 10);
      });

      // Apply initial filter
      const filterExpr = getFilterExpression(filter);
      if (filterExpr) {
        map.current!.setFilter("municipality-boundaries-fill", filterExpr);
        map.current!.setFilter("municipality-boundaries-line", filterExpr);
        map.current!.setFilter("municipality-boundaries-highlight", filterExpr);
      }
    };

    if (map.current.loaded()) {
      addBoundaryLayers();
    } else {
      map.current.on("load", addBoundaryLayers);
    }
  }, [boundaryGeoJSON, dbMunicipalities, findDbMunicipality, filter, getFilterExpression]);

  // Update filter when changed
  useEffect(() => {
    if (!map.current || !map.current.getLayer("municipality-boundaries-fill")) return;

    const filterExpr = getFilterExpression(filter);
    
    if (filterExpr) {
      map.current.setFilter("municipality-boundaries-fill", filterExpr);
      map.current.setFilter("municipality-boundaries-line", filterExpr);
      map.current.setFilter("municipality-boundaries-highlight", filterExpr);
    } else {
      // Remove filters to show all
      map.current.setFilter("municipality-boundaries-fill", null);
      map.current.setFilter("municipality-boundaries-line", null);
      map.current.setFilter("municipality-boundaries-highlight", ["==", ["get", "inDatabase"], true]);
    }
  }, [filter, getFilterExpression]);

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

  const dbCount = dbMunicipalities.length;
  const doneCount = dbMunicipalities.filter(m => m.extraction_status === "done").length;
  const pendingCount = dbMunicipalities.filter(m => m.extraction_status === "pending" || !m.extraction_status).length;
  const errorCount = dbMunicipalities.filter(m => m.extraction_status === "error").length;
  const totalTariffs = dbMunicipalities.reduce((sum, m) => sum + (m.tariff_count || 0), 0);
  const boundaryCount = boundaryGeoJSON?.features?.length || 0;

  const filterOptions: { value: FilterType; label: string; count?: number }[] = [
    { value: "all", label: "All", count: boundaryCount },
    { value: "database", label: "In DB", count: dbCount },
    { value: "done", label: "Done", count: doneCount },
    { value: "pending", label: "Pending", count: pendingCount },
    { value: "error", label: "Error", count: errorCount },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5" />
            Municipality Boundaries
            {(loading || loadingBoundaries) && <Loader2 className="h-4 w-4 animate-spin" />}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {filterOptions.map((opt) => (
              <Button
                key={opt.value}
                variant={filter === opt.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setFilter(opt.value)}
              >
                {opt.label}
                {opt.count !== undefined && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {opt.count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
        {!loading && !loadingBoundaries && (
          <div className="text-xs text-muted-foreground">
            {boundaryCount} boundaries • {dbCount} in database • {doneCount} extracted • {totalTariffs} tariffs
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div ref={mapContainer} className="h-[500px] rounded-b-lg" />
        <div className="p-3 border-t space-y-2">
          {/* Province legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(PROVINCE_CODE_TO_NAME).map(([code, name]) => (
              <div key={code} className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: PROVINCE_COLORS[code], opacity: 0.6 }}
                />
                <span>{name}</span>
              </div>
            ))}
          </div>
          {/* Status legend */}
          <div className="flex flex-wrap gap-4 text-xs pt-2 border-t">
            <span className="text-muted-foreground font-medium">Extraction Status:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-1 rounded" style={{ backgroundColor: STATUS_COLORS.done }} />
              <span>Done</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-1 rounded" style={{ backgroundColor: STATUS_COLORS.pending }} />
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-1 rounded" style={{ backgroundColor: STATUS_COLORS.error }} />
              <span>Error</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-1 rounded" style={{ backgroundColor: STATUS_COLORS.none }} />
              <span>Not in DB</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
