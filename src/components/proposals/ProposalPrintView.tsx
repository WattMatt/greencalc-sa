/**
 * ProposalPrintView - Renders ALL pages for PDF export
 * This is a hidden component that renders the full proposal for WYSIWYG capture
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sun, Battery, Zap, TrendingUp, Calendar, MapPin, Building2, LayoutDashboard, BarChart3 } from "lucide-react";
import { forwardRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Proposal, SimulationData, ProposalBranding } from "./types";
import { ProposalTemplateId, PROPOSAL_TEMPLATES } from "./templates/types";
import { FloorPlanMarkup } from "@/components/floor-plan/FloorPlanMarkup";
import { ProposalLocationMap } from "./ProposalLocationMap";

interface ProposalPrintViewProps {
  proposal: Partial<Proposal>;
  project: any;
  simulation?: SimulationData;
  tenants?: any[];
  shopTypes?: any[];
  showSystemDesign?: boolean;
  templateId?: ProposalTemplateId;
}

export const ProposalPrintView = forwardRef<HTMLDivElement, ProposalPrintViewProps>(
  ({ proposal, project, simulation, tenants, shopTypes, showSystemDesign, templateId = "modern" }, ref) => {
    const template = PROPOSAL_TEMPLATES[templateId];
    const branding = proposal.branding as ProposalBranding;
    const primaryColor = branding?.primary_color || template.colors.accentColor;
    const secondaryColor = branding?.secondary_color || template.colors.headerBg;

    // Check if PV layout exists for this project
    const { data: pvLayout } = useQuery({
      queryKey: ["pv-layout-print", project?.id],
      queryFn: async () => {
        if (!project?.id) return null;
        const { data, error } = await supabase
          .from("pv_layouts")
          .select("id, pv_arrays")
          .eq("project_id", project.id)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      enabled: !!project?.id,
    });

    const hasSystemDesign = showSystemDesign && pvLayout?.pv_arrays && 
      Array.isArray(pvLayout.pv_arrays) && pvLayout.pv_arrays.length > 0;

    // Generate 25-year projection
    const projection = useMemo(() => {
      if (!simulation) return [];
      const rows = [];
      let cumulativeSavings = 0;
      const annualDegradation = 0.005;
      const tariffEscalation = 0.08;

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
    }, [simulation]);

    const paybackYear = projection.find(p => p.cumulative >= (simulation?.systemCost || 0))?.year || 0;

    // Define pages
    const pages = useMemo(() => {
      const pageList: { id: string; title: string; pageNum: number }[] = [
        { id: "cover", title: "Cover & Summary", pageNum: 1 },
        { id: "site", title: "Site Overview", pageNum: 2 },
      ];
      
      let num = 3;
      if (hasSystemDesign) {
        pageList.push({ id: "design", title: "System Design", pageNum: num++ });
      }
      
      if (tenants && shopTypes) {
        pageList.push({ id: "load", title: "Load Analysis", pageNum: num++ });
      }
      
      pageList.push({ id: "specs", title: "System Specification", pageNum: num++ });
      pageList.push({ id: "financial", title: "Financial Analysis", pageNum: num++ });
      pageList.push({ id: "terms", title: "Terms & Signatures", pageNum: num++ });
      
      return pageList;
    }, [hasSystemDesign, tenants, shopTypes]);

    const totalPages = pages.length;

    // Page header component
    const PageHeader = ({ pageNum }: { pageNum: number }) => (
      <div
        className="p-4 text-white flex items-center justify-between shrink-0"
        style={{ backgroundColor: secondaryColor }}
      >
        <div className="flex items-center gap-3">
          {branding?.logo_url && (
            <img src={branding.logo_url} alt="Logo" className="h-8 object-contain" />
          )}
          <div>
            <h1 className="text-lg font-bold">
              {branding?.company_name || "Solar Installation Proposal"}
            </h1>
            <p className="text-xs text-white/70">
              {project?.name}
            </p>
          </div>
        </div>
        <div className="text-right flex items-center gap-3">
          <Badge
            className="text-white border-white/30 text-xs"
            style={{ backgroundColor: primaryColor }}
          >
            v{proposal.version || 1}
          </Badge>
          <span className="text-xs text-white/70">
            Page {pageNum} of {totalPages}
          </span>
        </div>
      </div>
    );

    // Page footer component
    const PageFooter = () => (
      <div
        className="p-3 text-white text-center text-xs mt-auto shrink-0"
        style={{ backgroundColor: secondaryColor }}
      >
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {branding?.contact_email && <span>{branding.contact_email}</span>}
          {branding?.contact_phone && <span>•</span>}
          {branding?.contact_phone && <span>{branding.contact_phone}</span>}
          {branding?.website && <span>•</span>}
          {branding?.website && <span>{branding.website}</span>}
        </div>
      </div>
    );

    // Page wrapper component
    const PageWrapper = ({ children, pageNum }: { children: React.ReactNode; pageNum: number }) => (
      <div 
        className="bg-white border rounded-lg shadow-lg overflow-hidden flex flex-col page-break-after"
        style={{ 
          width: "794px",
          minHeight: "1123px",
          pageBreakAfter: "always",
          marginBottom: "20px",
        }}
      >
        <PageHeader pageNum={pageNum} />
        <div className="flex-1 p-6 overflow-hidden">
          {children}
        </div>
        <PageFooter />
      </div>
    );

    const formatCurrency = (value: number) => {
      return `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    const formatNumber = (value: number) => {
      return value.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    return (
      <div 
        ref={ref} 
        className="print-view"
        style={{ 
          position: "absolute", 
          left: "-9999px", 
          top: 0,
          background: "white",
          width: "794px",
        }}
      >
        {/* Cover & Summary Page */}
        <PageWrapper pageNum={pages.find(p => p.id === "cover")?.pageNum || 1}>
          <div>
            {/* Hero Section */}
            <div 
              className="rounded-lg p-6 text-white mb-6"
              style={{ backgroundColor: primaryColor }}
            >
              <h2 className="text-2xl font-bold mb-2">Solar Installation Proposal</h2>
              <p className="text-white/80">
                {new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>

            {/* Key Metrics */}
            {simulation && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Sun className="h-8 w-8 mx-auto mb-2" style={{ color: primaryColor }} />
                  <div className="text-2xl font-bold">{simulation.solarCapacity} kWp</div>
                  <div className="text-xs text-gray-500">System Size</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2" style={{ color: primaryColor }} />
                  <div className="text-2xl font-bold">{formatCurrency(simulation.annualSavings)}</div>
                  <div className="text-xs text-gray-500">Annual Savings</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Calendar className="h-8 w-8 mx-auto mb-2" style={{ color: primaryColor }} />
                  <div className="text-2xl font-bold">{simulation.paybackYears.toFixed(1)} yrs</div>
                  <div className="text-xs text-gray-500">Payback Period</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Zap className="h-8 w-8 mx-auto mb-2" style={{ color: primaryColor }} />
                  <div className="text-2xl font-bold">{simulation.roiPercentage.toFixed(0)}%</div>
                  <div className="text-xs text-gray-500">25-Year ROI</div>
                </div>
              </div>
            )}

            {/* Executive Summary */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3" style={{ color: primaryColor }}>
                Executive Summary
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                {proposal.executive_summary || 
                  `This proposal outlines a ${simulation?.solarCapacity || 0} kWp solar PV system installation for ${project?.name}. The system is projected to generate ${formatNumber(simulation?.annualSolarGeneration || 0)} kWh annually, resulting in estimated annual savings of ${formatCurrency(simulation?.annualSavings || 0)} with a payback period of ${(simulation?.paybackYears || 0).toFixed(1)} years.`}
              </p>
            </div>
          </div>
        </PageWrapper>

        {/* Site Overview Page */}
        <PageWrapper pageNum={pages.find(p => p.id === "site")?.pageNum || 2}>
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: primaryColor }}>
              <MapPin className="h-5 w-5 inline mr-2" />
              Site Overview
            </h3>
            
            {/* Map */}
            {project?.latitude && project?.longitude && (
              <div className="mb-4 rounded-lg overflow-hidden border" style={{ height: "200px" }}>
                <ProposalLocationMap
                  latitude={project.latitude}
                  longitude={project.longitude}
                  location={project.location}
                  projectName={project.name}
                />
              </div>
            )}
            
            {/* Site Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Location</div>
                <div className="font-medium">{project?.location || "Not specified"}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Total Area</div>
                <div className="font-medium">{project?.total_area_sqm ? `${formatNumber(project.total_area_sqm)} m²` : "—"}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Connection Size</div>
                <div className="font-medium">{project?.connection_size_kva ? `${project.connection_size_kva} kVA` : "—"}</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Tariff</div>
                <div className="font-medium">{simulation?.tariffName || "Standard"}</div>
              </div>
            </div>
          </div>
        </PageWrapper>

        {/* System Design Page (conditional) */}
        {hasSystemDesign && (
          <PageWrapper pageNum={pages.find(p => p.id === "design")?.pageNum || 3}>
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: primaryColor }}>
                <LayoutDashboard className="h-5 w-5 inline mr-2" />
                System Design
              </h3>
              <div className="border rounded-lg overflow-hidden" style={{ height: "400px" }}>
                <FloorPlanMarkup projectId={project?.id} readOnly />
              </div>
            </div>
          </PageWrapper>
        )}

        {/* Load Analysis Page (conditional) */}
        {tenants && shopTypes && (
          <PageWrapper pageNum={pages.find(p => p.id === "load")?.pageNum || 4}>
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: primaryColor }}>
                <BarChart3 className="h-5 w-5 inline mr-2" />
                Load Analysis
              </h3>
              
              {/* Tenant Summary */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Tenant Summary</h4>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Tenant</th>
                      <th className="text-right py-2 px-3">Area (m²)</th>
                      <th className="text-left py-2 px-3">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.slice(0, 10).map((tenant: any) => {
                      const shopType = shopTypes.find((st: any) => st.id === tenant.shop_type_id);
                      return (
                        <tr key={tenant.id} className="border-b">
                          <td className="py-2 px-3">{tenant.name}</td>
                          <td className="text-right py-2 px-3">{formatNumber(tenant.area_sqm)}</td>
                          <td className="py-2 px-3">{shopType?.name || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {tenants.length > 10 && (
                  <p className="text-xs text-gray-500 mt-2">
                    + {tenants.length - 10} more tenants
                  </p>
                )}
              </div>

              {/* Load Profile Note */}
              <div className="border rounded-lg p-4 text-center text-sm text-gray-500">
                <p>See attached load profile analysis for detailed consumption patterns.</p>
              </div>
            </div>
          </PageWrapper>
        )}

        {/* System Specification Page */}
        <PageWrapper pageNum={pages.find(p => p.id === "specs")?.pageNum || 5}>
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: primaryColor }}>
              <Sun className="h-5 w-5 inline mr-2" />
              System Specification
            </h3>
            
            {simulation && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Solar Capacity</div>
                    <div className="text-xl font-bold" style={{ color: primaryColor }}>{simulation.solarCapacity} kWp</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Battery Storage</div>
                    <div className="text-xl font-bold" style={{ color: primaryColor }}>{simulation.batteryCapacity} kWh</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Battery Power</div>
                    <div className="text-xl font-bold" style={{ color: primaryColor }}>{simulation.batteryPower} kW</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">System Cost</div>
                    <div className="text-xl font-bold" style={{ color: primaryColor }}>{formatCurrency(simulation.systemCost)}</div>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-3">Energy Performance</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-lg font-bold text-green-600">{formatNumber(simulation.annualSolarGeneration)}</div>
                      <div className="text-xs text-gray-500">Annual Generation (kWh)</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">{formatNumber(simulation.annualGridImport)}</div>
                      <div className="text-xs text-gray-500">Grid Import (kWh)</div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-lg font-bold text-orange-600">{formatNumber(simulation.annualGridExport)}</div>
                      <div className="text-xs text-gray-500">Grid Export (kWh)</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </PageWrapper>

        {/* Financial Analysis Page */}
        <PageWrapper pageNum={pages.find(p => p.id === "financial")?.pageNum || 6}>
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: primaryColor }}>
              <TrendingUp className="h-5 w-5 inline mr-2" />
              25-Year Financial Projection
            </h3>
            
            <table className="w-full text-xs border-collapse mb-4">
              <thead>
                <tr style={{ backgroundColor: secondaryColor, color: "white" }}>
                  <th className="py-2 px-2 text-left">Year</th>
                  <th className="py-2 px-2 text-right">Generation (kWh)</th>
                  <th className="py-2 px-2 text-right">Annual Savings</th>
                  <th className="py-2 px-2 text-right">Cumulative</th>
                  <th className="py-2 px-2 text-right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {projection.map((row) => (
                  <tr 
                    key={row.year} 
                    className={`border-b ${row.year === paybackYear ? "bg-green-50 font-medium" : ""}`}
                  >
                    <td className="py-1 px-2">{row.year}</td>
                    <td className="py-1 px-2 text-right">{formatNumber(row.generation)}</td>
                    <td className="py-1 px-2 text-right">{formatCurrency(row.savings)}</td>
                    <td className="py-1 px-2 text-right">{formatCurrency(row.cumulative)}</td>
                    <td className="py-1 px-2 text-right">{row.roi.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {paybackYear > 0 && (
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <span className="text-green-700 font-medium">
                  ✓ Investment payback achieved in Year {paybackYear}
                </span>
              </div>
            )}
          </div>
        </PageWrapper>

        {/* Terms & Signatures Page */}
        <PageWrapper pageNum={pages.find(p => p.id === "terms")?.pageNum || 7}>
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: primaryColor }}>
              Terms & Conditions
            </h3>
            
            {/* Assumptions */}
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-2">Assumptions</h4>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                {proposal.assumptions || "• 0.5% annual panel degradation\n• 8% annual tariff escalation\n• Standard weather conditions"}
              </p>
            </div>
            
            {/* Disclaimers */}
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-2">Disclaimers</h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                {proposal.disclaimers || "This proposal is based on estimated consumption data and solar irradiance forecasts. Actual performance may vary."}
              </p>
            </div>
            
            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t">
              <div>
                <div className="border-b-2 border-gray-300 h-12 mb-2"></div>
                <div className="text-sm font-medium">{proposal.prepared_by || "Prepared By"}</div>
                <div className="text-xs text-gray-500">Company Representative</div>
              </div>
              <div>
                <div className="border-b-2 border-gray-300 h-12 mb-2"></div>
                <div className="text-sm font-medium">{proposal.client_signature || "Client Signature"}</div>
                <div className="text-xs text-gray-500">Date: _______________</div>
              </div>
            </div>
          </div>
        </PageWrapper>
      </div>
    );
  }
);

ProposalPrintView.displayName = "ProposalPrintView";
