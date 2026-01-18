import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sun, Battery, Zap, TrendingUp, Calendar, MapPin, Building2, ChevronDown, ChevronUp, LayoutDashboard, BarChart3 } from "lucide-react";
import { useState } from "react";
import type { Proposal, SimulationData, ProposalBranding } from "./types";
import { FloorPlanMarkup } from "@/components/floor-plan/FloorPlanMarkup";
import { LoadProfileChart } from "@/components/projects/LoadProfileChart";
import { ProposalLocationMap } from "./ProposalLocationMap";

interface ProposalPreviewProps {
  proposal: Partial<Proposal>;
  project: any;
  simulation?: SimulationData;
  tenants?: any[];
  shopTypes?: any[];
}

export function ProposalPreview({ proposal, project, simulation, tenants, shopTypes }: ProposalPreviewProps) {
  const branding = proposal.branding as ProposalBranding;
  const primaryColor = branding?.primary_color || "#22c55e";
  const secondaryColor = branding?.secondary_color || "#0f172a";
  const [showFullProjection, setShowFullProjection] = useState(false);

  // Generate 25-year projection
  const generateProjection = () => {
    if (!simulation) return [];
    const rows = [];
    let cumulativeSavings = 0;
    const annualDegradation = 0.005; // 0.5% per year
    const tariffEscalation = 0.08; // 8% per year

    for (let year = 1; year <= 25; year++) {
      const degradationFactor = Math.pow(1 - annualDegradation, year - 1);
      const escalationFactor = Math.pow(1 + tariffEscalation, year - 1);
      const yearSavings = simulation.annualSavings * degradationFactor * escalationFactor;
      cumulativeSavings += yearSavings;

      rows.push({
        year,
        generation: simulation.annualSolarGeneration * degradationFactor,
        savings: yearSavings,
        cumulative: cumulativeSavings,
        roi: ((cumulativeSavings - simulation.systemCost) / simulation.systemCost) * 100,
      });
    }
    return rows;
  };

  const projection = generateProjection();
  const displayedProjection = showFullProjection ? projection : projection.slice(0, 10);
  const paybackYear = projection.find(p => p.cumulative >= (simulation?.systemCost || 0))?.year || 0;

  return (
    <div className="bg-background border rounded-lg overflow-hidden" id="proposal-preview">
      {/* Header with branding */}
      <div
        className="p-6 text-white"
        style={{ backgroundColor: secondaryColor }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {branding?.logo_url && (
              <img src={branding.logo_url} alt="Logo" className="h-12 object-contain" />
            )}
            <div>
              <h1 className="text-2xl font-bold">
                {branding?.company_name || "Solar Installation Proposal"}
              </h1>
              <p className="text-white/70">
                Prepared for: {project?.name}
              </p>
            </div>
          </div>
          <div className="text-right">
            <Badge
              className="text-white border-white/30"
              style={{ backgroundColor: primaryColor }}
            >
              Version {proposal.version || 1}
            </Badge>
            <p className="text-sm text-white/70 mt-1">
              {new Date().toLocaleDateString('en-ZA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: primaryColor }}>
          <Zap className="h-5 w-5" />
          Executive Summary
        </h2>
        <p className="text-muted-foreground">
          {proposal.executive_summary ||
            `This proposal outlines a ${simulation?.solarCapacity || 0} kWp solar PV system installation for ${project?.name}. ` +
            `The system is projected to generate ${(simulation?.annualSolarGeneration || 0).toLocaleString()} kWh annually, ` +
            `resulting in estimated annual savings of R${(simulation?.annualSavings || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ` +
            `with a payback period of ${(simulation?.paybackYears || 0).toFixed(1)} years.`
          }
        </p>
      </div>

      {/* Site Overview with Map Placeholder */}
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: primaryColor }}>
          <MapPin className="h-5 w-5" />
          Site Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="font-medium">{project?.location || "Not specified"}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Total Area</p>
              <p className="font-medium">{project?.total_area_sqm?.toLocaleString() || "—"} m²</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Connection Size</p>
              <p className="font-medium">{project?.connection_size_kva || "—"} kVA</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Tariff</p>
              <p className="font-medium">{simulation?.tariffName || "Standard"}</p>
            </div>
          </div>
          {/* Actual Map */}
          <ProposalLocationMap
            latitude={project?.latitude}
            longitude={project?.longitude}
            location={project?.location}
            projectName={project?.name}
          />
        </div>
      </div>

      {/* System Design */}
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: primaryColor }}>
          <LayoutDashboard className="h-5 w-5" />
          System Design
        </h2>
        <div className="rounded-lg border overflow-hidden">
          <FloorPlanMarkup projectId={project?.id} readOnly={true} />
        </div>
      </div>

      {/* Load Analysis */}
      {tenants && shopTypes && (
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: primaryColor }}>
            <BarChart3 className="h-5 w-5" />
            Load Analysis
          </h2>
          <div className="grid gap-6">
            <LoadProfileChart
              tenants={tenants}
              shopTypes={shopTypes}
              connectionSizeKva={project?.connection_size_kva}
              latitude={project?.latitude ?? -33.9249}
              longitude={project?.longitude ?? 18.4241}
            />
          </div>
        </div>
      )}

      {/* System Specification */}
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: primaryColor }}>
          <Sun className="h-5 w-5" />
          System Specification
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="border-2" style={{ borderColor: primaryColor + "40" }}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Sun className="h-4 w-4" style={{ color: primaryColor }} />
                <span className="text-sm text-muted-foreground">Solar Capacity</span>
              </div>
              <p className="text-2xl font-bold">{simulation?.solarCapacity || 0} kWp</p>
            </CardContent>
          </Card>
          <Card className="border-2" style={{ borderColor: primaryColor + "40" }}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Battery className="h-4 w-4" style={{ color: primaryColor }} />
                <span className="text-sm text-muted-foreground">Battery Storage</span>
              </div>
              <p className="text-2xl font-bold">{simulation?.batteryCapacity || 0} kWh</p>
              <p className="text-xs text-muted-foreground">{simulation?.batteryPower || 0} kW power</p>
            </CardContent>
          </Card>
          <Card className="border-2" style={{ borderColor: primaryColor + "40" }}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4" style={{ color: primaryColor }} />
                <span className="text-sm text-muted-foreground">Annual Generation</span>
              </div>
              <p className="text-2xl font-bold">
                {(simulation?.annualSolarGeneration || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">kWh/year</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Financial Analysis */}
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: primaryColor }}>
          <TrendingUp className="h-5 w-5" />
          Financial Analysis
        </h2>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg" style={{ backgroundColor: primaryColor + "10" }}>
            <p className="text-xs text-muted-foreground">System Cost</p>
            <p className="text-xl font-bold">R{(simulation?.systemCost || 0).toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: primaryColor + "10" }}>
            <p className="text-xs text-muted-foreground">Annual Savings</p>
            <p className="text-xl font-bold">R{(simulation?.annualSavings || 0).toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: primaryColor + "10" }}>
            <p className="text-xs text-muted-foreground">Payback Period</p>
            <p className="text-xl font-bold">{paybackYear || (simulation?.paybackYears || 0).toFixed(1)} years</p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: primaryColor + "10" }}>
            <p className="text-xs text-muted-foreground">25-Year ROI</p>
            <p className="text-xl font-bold">{projection[24]?.roi.toFixed(0) || simulation?.roiPercentage || 0}%</p>
          </div>
        </div>

        {/* 25-Year Projection Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2">Year</th>
                <th className="text-right py-2 px-2">Generation (kWh)</th>
                <th className="text-right py-2 px-2">Annual Savings</th>
                <th className="text-right py-2 px-2">Cumulative Savings</th>
                <th className="text-right py-2 px-2">ROI</th>
              </tr>
            </thead>
            <tbody>
              {displayedProjection.map((row) => (
                <tr
                  key={row.year}
                  className={`border-b ${row.year === paybackYear ? 'bg-primary/5 font-medium' : ''}`}
                >
                  <td className="py-2 px-2">
                    {row.year}
                    {row.year === paybackYear && (
                      <Badge variant="outline" className="ml-2 text-xs" style={{ borderColor: primaryColor, color: primaryColor }}>
                        Payback
                      </Badge>
                    )}
                  </td>
                  <td className="text-right py-2 px-2">{row.generation.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="text-right py-2 px-2">R{row.savings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="text-right py-2 px-2">R{row.cumulative.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="text-right py-2 px-2" style={{ color: row.roi > 0 ? primaryColor : undefined }}>
                    {row.roi.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {projection.length > 10 && (
            <Button
              variant="ghost"
              className="w-full mt-2 text-muted-foreground"
              onClick={() => setShowFullProjection(!showFullProjection)}
            >
              {showFullProjection ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Show Years 11-25
                </>
              )}
            </Button>
          )}
        </div>

        {/* 25-Year Totals */}
        {projection.length > 0 && (
          <div className="mt-4 p-4 rounded-lg border-2" style={{ borderColor: primaryColor + "40" }}>
            <h4 className="font-semibold mb-2">25-Year Summary</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Generation</p>
                <p className="font-bold">{projection.reduce((sum, r) => sum + r.generation, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} kWh</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Savings</p>
                <p className="font-bold">R{projection[24]?.cumulative.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Net Profit</p>
                <p className="font-bold" style={{ color: primaryColor }}>
                  R{((projection[24]?.cumulative || 0) - (simulation?.systemCost || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Assumptions & Disclaimers */}
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: primaryColor }}>
          <Calendar className="h-5 w-5" />
          Assumptions & Disclaimers
        </h2>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="font-medium text-foreground mb-1">Assumptions</p>
            <p className="whitespace-pre-line">{proposal.assumptions || "• 0.5% annual panel degradation\n• 8% annual tariff escalation\n• Standard weather conditions"}</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="font-medium text-foreground mb-1">Disclaimers</p>
            <p>{proposal.disclaimers}</p>
          </div>
          {proposal.custom_notes && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="font-medium text-foreground mb-1">Additional Notes</p>
              <p>{proposal.custom_notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Verification Status */}
      {proposal.verification_checklist && (
        <div className="p-6 border-b bg-muted/30">
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Data Verification</h3>
          <div className="flex flex-wrap gap-2">
            {proposal.verification_checklist.site_coordinates_verified && (
              <Badge variant="outline" className="border-green-500/50 text-green-700">✓ Coordinates Verified</Badge>
            )}
            {proposal.verification_checklist.consumption_data_source && (
              <Badge variant="outline" className="border-green-500/50 text-green-700">
                ✓ {proposal.verification_checklist.consumption_data_source === 'actual' ? 'Actual' : 'Estimated'} Data
              </Badge>
            )}
            {proposal.verification_checklist.tariff_rates_confirmed && (
              <Badge variant="outline" className="border-green-500/50 text-green-700">✓ Tariff Confirmed</Badge>
            )}
            {proposal.verification_checklist.system_specs_validated && (
              <Badge variant="outline" className="border-green-500/50 text-green-700">✓ Specs Validated</Badge>
            )}
          </div>
        </div>
      )}

      {/* Signature Section */}
      {(proposal.prepared_by || proposal.approved_by || proposal.client_signature) && (
        <div className="p-6 border-b">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground">Signatures</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="h-16 border-b-2 border-muted-foreground/30 mb-2 flex items-end justify-center pb-1">
                {proposal.prepared_by && <span className="font-semibold">{proposal.prepared_by}</span>}
              </div>
              <p className="text-xs text-muted-foreground">Prepared By</p>
              {proposal.prepared_at && (
                <p className="text-xs text-muted-foreground">
                  {new Date(proposal.prepared_at).toLocaleDateString('en-ZA')}
                </p>
              )}
            </div>
            <div className="text-center">
              <div className="h-16 border-b-2 border-muted-foreground/30 mb-2 flex items-end justify-center pb-1">
                {proposal.approved_by && <span className="font-semibold">{proposal.approved_by}</span>}
              </div>
              <p className="text-xs text-muted-foreground">Approved By</p>
              {proposal.approved_at && (
                <p className="text-xs text-muted-foreground">
                  {new Date(proposal.approved_at).toLocaleDateString('en-ZA')}
                </p>
              )}
            </div>
            <div className="text-center">
              <div className="h-16 border-b-2 border-muted-foreground/30 mb-2 flex items-end justify-center pb-1">
                {proposal.client_signature && <span className="font-semibold text-primary">{proposal.client_signature}</span>}
              </div>
              <p className="text-xs text-muted-foreground">Client Acceptance</p>
              {proposal.client_signed_at && (
                <p className="text-xs text-muted-foreground">
                  {new Date(proposal.client_signed_at).toLocaleDateString('en-ZA')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer with branding */}
      <div
        className="p-4 text-white text-center text-sm"
        style={{ backgroundColor: secondaryColor }}
      >
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {branding?.contact_email && <span>{branding.contact_email}</span>}
          {branding?.contact_phone && <span>•</span>}
          {branding?.contact_phone && <span>{branding.contact_phone}</span>}
          {branding?.website && <span>•</span>}
          {branding?.website && <span>{branding.website}</span>}
        </div>
        {branding?.address && <p className="mt-1 text-white/70">{branding.address}</p>}
      </div>
    </div>
  );
}
