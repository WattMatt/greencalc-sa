import { MapPin, Building, Zap, Ruler } from "lucide-react";
import { SimulationData, ProposalBranding, formatNumber } from "../types";
import { ProposalTemplate } from "../templates/types";

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
  };
  simulation: SimulationData;
  template: ProposalTemplate;
  forPDF?: boolean;
}

export function SiteOverviewSection({ project, simulation, template, forPDF }: SiteOverviewSectionProps) {
  const primaryColor = template.colors.accentColor;
  
  const siteDetails = [
    { icon: MapPin, label: "Location", value: project?.location || "Not specified" },
    { icon: Ruler, label: "Total Area", value: project?.total_area_sqm ? `${formatNumber(project.total_area_sqm)} m²` : "—" },
    { icon: Zap, label: "Connection Size", value: project?.connection_size_kva ? `${project.connection_size_kva} kVA` : "—" },
    { icon: Building, label: "Tariff", value: simulation.tariffName || "Standard" },
  ];

  // Generate Mapbox static map URL if coordinates are available
  const hasCoordinates = project?.latitude && project?.longitude;
  const mapUrl = hasCoordinates 
    ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/pin-l+${primaryColor.replace('#', '')}(${project.longitude},${project.latitude})/${project.longitude},${project.latitude},16,0/600x300@2x?access_token=pk.eyJ1IjoibG92YWJsZSIsImEiOiJjbHNxbnk4Y3MwNnUxMmpwY3R4a3V0dWMzIn0.example`
    : null;

  return (
    <div className={forPDF ? "" : "p-6"}>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <MapPin className="h-5 w-5" style={{ color: primaryColor }} />
        Site Overview
      </h2>

      <div className="grid grid-cols-2 gap-6">
        {/* Map Placeholder */}
        <div className="rounded-lg border bg-muted/30 overflow-hidden">
          {hasCoordinates ? (
            <div className="aspect-[4/3] bg-muted flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Map at {project.latitude?.toFixed(4)}, {project.longitude?.toFixed(4)}</p>
              </div>
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
