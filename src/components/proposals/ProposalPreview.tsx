import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sun, Battery, Zap, TrendingUp, Calendar, MapPin, Building2 } from "lucide-react";
import type { Proposal, SimulationData, ProposalBranding } from "./types";

interface ProposalPreviewProps {
  proposal: Partial<Proposal>;
  project: any;
  simulation?: SimulationData;
}

export function ProposalPreview({ proposal, project, simulation }: ProposalPreviewProps) {
  const branding = proposal.branding as ProposalBranding;
  const primaryColor = branding?.primary_color || "#22c55e";
  const secondaryColor = branding?.secondary_color || "#0f172a";

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

      {/* Site Overview */}
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: primaryColor }}>
          <MapPin className="h-5 w-5" />
          Site Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      </div>

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
            <p className="text-xl font-bold">{(simulation?.paybackYears || 0).toFixed(1)} years</p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: primaryColor + "10" }}>
            <p className="text-xs text-muted-foreground">25-Year ROI</p>
            <p className="text-xl font-bold">{(simulation?.roiPercentage || 0).toFixed(0)}%</p>
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
              {projection.slice(0, 10).map((row) => (
                <tr key={row.year} className="border-b">
                  <td className="py-2 px-2">{row.year}</td>
                  <td className="text-right py-2 px-2">{row.generation.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="text-right py-2 px-2">R{row.savings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="text-right py-2 px-2">R{row.cumulative.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="text-right py-2 px-2" style={{ color: row.roi > 0 ? primaryColor : undefined }}>
                    {row.roi.toFixed(0)}%
                  </td>
                </tr>
              ))}
              <tr className="text-xs text-muted-foreground">
                <td colSpan={5} className="py-2 px-2 text-center">... Years 11-25 available in full report ...</td>
              </tr>
            </tbody>
          </table>
        </div>
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
            <p>{proposal.assumptions || "• 0.5% annual panel degradation\n• 8% annual tariff escalation\n• Standard weather conditions"}</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="font-medium text-foreground mb-1">Disclaimers</p>
            <p>{proposal.disclaimers}</p>
          </div>
        </div>
      </div>

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
