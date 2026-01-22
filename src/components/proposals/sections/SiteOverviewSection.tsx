import { useState, useEffect } from "react";
import { MapPin, Building, Zap, Ruler, Loader2 } from "lucide-react";
import { SimulationData, ProposalBranding, formatNumber } from "../types";
import { ProposalTemplate } from "../templates/types";
import { supabase } from "@/integrations/supabase/client";

interface SiteOverviewSectionProps {
  proposal: {
    branding?: ProposalBranding;
  };
  project: {
    name?: string;
    location?: string;
    total_area_sqm?: number;
    connection_size_kva?: number;
    latitude?: number;
    longitude?: number;
    tariff_id?: string;
  };
  simulation: SimulationData;
  template: ProposalTemplate;
  tariffName?: string;
  forPDF?: boolean;
}

export function SiteOverviewSection({ project, simulation, template, tariffName, forPDF }: SiteOverviewSectionProps) {
  const primaryColor = template.colors.accentColor;
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState(false);
  
  // Display tariff: prefer explicit tariffName prop, then simulation.tariffName, then fallback
  const displayTariff = tariffName || simulation.tariffName || "Not assigned";
  
  const siteDetails = [
    { icon: MapPin, label: "Location", value: project?.location || "Not specified" },
    { icon: Ruler, label: "Total Area", value: project?.total_area_sqm ? `${formatNumber(project.total_area_sqm)} m²` : "—" },
    { icon: Zap, label: "Connection Size", value: project?.connection_size_kva ? `${project.connection_size_kva} kVA` : "—" },
    { icon: Building, label: "Tariff", value: displayTariff },
  ];

  // Fetch Mapbox token and generate static map URL
  useEffect(() => {
    const fetchMapUrl = async () => {
      if (!project?.latitude || !project?.longitude) return;
      
      setMapLoading(true);
      setMapError(false);
      
      try {
        const { data, error } = await supabase.functions.invoke("get-mapbox-token");
        if (error || !data?.token) {
          console.warn("Failed to get Mapbox token:", error);
          setMapError(true);
          return;
        }
        
        const lng = project.longitude;
        const lat = project.latitude;
        const zoom = 15;
        const width = 600;
        const height = 400;
        const marker = `pin-l+${primaryColor.replace('#', '')}(${lng},${lat})`;
        const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${marker}/${lng},${lat},${zoom}/${width}x${height}@2x?access_token=${data.token}`;
        
        setMapUrl(url);
      } catch (e) {
        console.warn("Failed to generate map URL:", e);
        setMapError(true);
      } finally {
        setMapLoading(false);
      }
    };
    
    fetchMapUrl();
  }, [project?.latitude, project?.longitude, primaryColor]);

  const hasCoordinates = project?.latitude && project?.longitude;

  return (
    <div className={forPDF ? "" : "p-6"}>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <MapPin className="h-5 w-5" style={{ color: primaryColor }} />
        Site Overview
      </h2>

      <div className="grid grid-cols-2 gap-6">
        {/* Map */}
        <div className="rounded-lg border bg-muted/30 overflow-hidden">
          {hasCoordinates ? (
            <div className="aspect-[4/3] relative">
              {mapLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : mapUrl && !mapError ? (
                <img 
                  src={mapUrl} 
                  alt={`Site location map at ${project.latitude?.toFixed(4)}, ${project.longitude?.toFixed(4)}`}
                  className="w-full h-full object-cover"
                  onError={() => setMapError(true)}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <div className="text-center text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{project.latitude?.toFixed(4)}, {project.longitude?.toFixed(4)}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Map unavailable</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-[4/3] bg-muted flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No location coordinates</p>
              </div>
            </div>
          )}
        </div>

        {/* Site Details Grid */}
        <div className="space-y-4">
          {siteDetails.map((detail, index) => {
            const Icon = detail.icon;
            return (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Icon className="h-4 w-4" style={{ color: primaryColor }} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{detail.label}</p>
                  <p className="font-medium">{detail.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
