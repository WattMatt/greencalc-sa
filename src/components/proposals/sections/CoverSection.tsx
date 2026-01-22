import { Sun, Battery, Zap, TrendingUp } from "lucide-react";
import { SimulationData, ProposalBranding, formatCurrency, formatNumber, formatPercent } from "../types";
import { ProposalTemplate } from "../templates/types";

interface CoverSectionProps {
  proposal: {
    version?: number;
    branding?: ProposalBranding;
    executive_summary?: string | null;
  };
  project: {
    name?: string;
    location?: string;
  };
  simulation: SimulationData;
  template: ProposalTemplate;
  forPDF?: boolean;
}

export function CoverSection({ proposal, project, simulation, template, forPDF }: CoverSectionProps) {
  const primaryColor = proposal.branding?.primary_color || template.colors.accentColor;
  const secondaryColor = proposal.branding?.secondary_color || template.colors.headerBg;
  const date = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  
  // Determine if header is light (for text contrast)
  const isLightHeader = secondaryColor === '#ffffff' || secondaryColor === '#f8fafc' || secondaryColor.toLowerCase() === '#fff';
  const headerTextClass = isLightHeader ? 'text-foreground' : 'text-white';
  const headerSubtextClass = isLightHeader ? 'text-muted-foreground' : 'text-white/80';

  const metrics = [
    { icon: Sun, value: `${simulation.solarCapacity} kWp`, label: "System Size", subLabel: "DC Capacity" },
    { icon: Zap, value: formatCurrency(simulation.annualSavings), label: "Annual Savings", subLabel: "Year 1 Estimate" },
    { icon: TrendingUp, value: `${simulation.paybackYears.toFixed(1)} yrs`, label: "Payback", subLabel: "Investment Return" },
    { icon: Battery, value: simulation.npv ? formatCurrency(simulation.npv) : `${formatPercent(simulation.roiPercentage)}`, label: simulation.npv ? "NPV" : "20-Yr ROI", subLabel: simulation.npv ? "Net Present Value" : "Return on Investment" },
  ];

  return (
    <div className={forPDF ? "" : "p-6"}>
      {/* Header Band */}
      <div 
        className="rounded-t-lg p-6"
        style={{ backgroundColor: secondaryColor }}
      >
        <div className="flex items-start justify-between mb-4">
          {proposal.branding?.logo_url ? (
            <img 
              src={`${proposal.branding.logo_url}${proposal.branding.logo_url.includes('?') ? '&' : '?'}t=${Date.now()}`}
              alt="Company Logo"
              className="h-12 object-contain"
            />
          ) : (
            <div className="h-12" />
          )}
          <div className={`text-right ${headerSubtextClass}`}>
            <div className="text-sm font-medium">Version {proposal.version || 1}</div>
            <div className="text-xs">{date}</div>
          </div>
        </div>
        
        <h1 className={`text-2xl font-bold ${headerTextClass} mb-1`}>
          {proposal.branding?.company_name || 'Solar Proposal'}
        </h1>
        <p className={headerSubtextClass}>
          Prepared for: {project?.name || 'Client'}
        </p>
      </div>

      {/* Accent Bar */}
      <div className="h-1" style={{ backgroundColor: primaryColor }} />

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-4 gap-4 py-6 px-4 bg-muted/30 rounded-b-lg">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className="text-center">
              <div 
                className="w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <Icon className="h-5 w-5" style={{ color: primaryColor }} />
              </div>
              <div className="text-lg font-bold" style={{ color: primaryColor }}>
                {metric.value}
              </div>
              <div className="text-xs font-medium text-foreground">{metric.label}</div>
              <div className="text-xs text-muted-foreground">{metric.subLabel}</div>
            </div>
          );
        })}
      </div>

      {/* Executive Summary */}
      {proposal.executive_summary && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Executive Summary</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {proposal.executive_summary}
          </p>
        </div>
      )}

      {/* Auto-generated summary if none provided */}
      {!proposal.executive_summary && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Executive Summary</h2>
          <p className="text-sm text-muted-foreground">
            This proposal outlines a {simulation.solarCapacity} kWp solar PV system installation 
            for {project?.name}. The system is projected to generate {formatNumber(simulation.annualSolarGeneration)} kWh 
            annually, resulting in estimated annual savings of {formatCurrency(simulation.annualSavings)} with 
            a payback period of {simulation.paybackYears.toFixed(1)} years.
            {simulation.npv && ` The project delivers a Net Present Value of ${formatCurrency(simulation.npv)} 
            with an Internal Rate of Return of ${formatPercent(simulation.irr || 0)}.`}
          </p>
        </div>
      )}
    </div>
  );
}
