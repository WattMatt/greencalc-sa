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
import { ProposalTemplateId, PROPOSAL_TEMPLATES, getTemplateStyles } from "./templates/types";
import { FloorPlanMarkup } from "@/components/floor-plan/FloorPlanMarkup";
import { ProposalLocationMap } from "./ProposalLocationMap";
import { cn } from "@/lib/utils";

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
    const templateStyles = getTemplateStyles(template);
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

    // Determine if we need dark or light text based on header background
    const isLightHeader = template.colors.headerBg === '#ffffff' || template.colors.headerBg === '#fafaf9';
    const headerTextColor = isLightHeader ? '#1e293b' : '#ffffff';
    const headerSubtextColor = isLightHeader ? '#64748b' : 'rgba(255,255,255,0.7)';

    // Page header component
    const PageHeader = ({ pageNum }: { pageNum: number }) => (
      <div
        className="p-4 flex items-center justify-between shrink-0"
        style={{ backgroundColor: secondaryColor, color: headerTextColor }}
      >
        <div className="flex items-center gap-3">
          {branding?.logo_url && (
            <img src={branding.logo_url} alt="Logo" className="h-8 object-contain" />
          )}
          <div>
            <h1 className="text-lg font-bold">
              {branding?.company_name || "Solar Installation Proposal"}
            </h1>
            <p className="text-xs" style={{ color: headerSubtextColor }}>
              {project?.name}
            </p>
          </div>
        </div>
        <div className="text-right flex items-center gap-3">
          <Badge
            className="text-xs"
            style={{ backgroundColor: primaryColor, color: '#ffffff' }}
          >
            v{proposal.version || 1}
          </Badge>
          <span className="text-xs" style={{ color: headerSubtextColor }}>
            Page {pageNum} of {totalPages}
          </span>
        </div>
      </div>
    );

    // Page footer component
    const PageFooter = () => (
      <div
        className="p-3 text-center text-xs mt-auto shrink-0"
        style={{ backgroundColor: secondaryColor, color: headerTextColor }}
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

    // Page wrapper component - apply template styles
    const borderRadiusStyle = template.layout.cardStyle === 'rounded' ? '0.75rem' : 
                               template.layout.cardStyle === 'subtle' ? '0.375rem' : '0';
    
    const PageWrapper = ({ children, pageNum }: { children: React.ReactNode; pageNum: number }) => (
      <div 
        className="bg-white border overflow-hidden flex flex-col page-break-after"
        style={{ 
          width: "794px",
          minHeight: "1123px",
          pageBreakAfter: "always",
          marginBottom: "20px",
          borderRadius: borderRadiusStyle,
          boxShadow: template.layout.shadowStyle === 'pronounced' ? '0 10px 25px -5px rgba(0,0,0,0.1)' :
                     template.layout.shadowStyle === 'medium' ? '0 4px 12px -2px rgba(0,0,0,0.08)' :
                     template.layout.shadowStyle === 'subtle' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
        }}
      >
        <PageHeader pageNum={pageNum} />
        <div className={cn("flex-1 overflow-hidden", templateStyles.sectionSpacing.p)}>
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
              className={cn("p-6 text-white", templateStyles.sectionSpacing.mb)}
              style={{ backgroundColor: primaryColor, borderRadius: borderRadiusStyle }}
            >
              <h2 className={cn("text-2xl mb-2", templateStyles.headingWeight)}>Solar Installation Proposal</h2>
              <p className="text-white/80">
                {new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>

            {/* Key Metrics */}
            {simulation && (
              <div className={cn("grid grid-cols-4", templateStyles.sectionSpacing.gap, templateStyles.sectionSpacing.mb)}>
                <div className={cn("text-center", templateStyles.sectionSpacing.p)} style={{ backgroundColor: template.colors.cardBg, borderRadius: borderRadiusStyle }}>
                  {template.layout.showIcons && <Sun className="h-8 w-8 mx-auto mb-2" style={{ color: primaryColor }} />}
                  <div className={cn("text-2xl", templateStyles.headingWeight)}>{simulation.solarCapacity} kWp</div>
                  <div className="text-xs" style={{ color: template.colors.textSecondary }}>System Size</div>
                </div>
                <div className={cn("text-center", templateStyles.sectionSpacing.p)} style={{ backgroundColor: template.colors.cardBg, borderRadius: borderRadiusStyle }}>
                  {template.layout.showIcons && <TrendingUp className="h-8 w-8 mx-auto mb-2" style={{ color: primaryColor }} />}
                  <div className={cn("text-2xl", templateStyles.headingWeight)}>{formatCurrency(simulation.annualSavings)}</div>
                  <div className="text-xs" style={{ color: template.colors.textSecondary }}>Annual Savings</div>
                </div>
                <div className={cn("text-center", templateStyles.sectionSpacing.p)} style={{ backgroundColor: template.colors.cardBg, borderRadius: borderRadiusStyle }}>
                  {template.layout.showIcons && <Calendar className="h-8 w-8 mx-auto mb-2" style={{ color: primaryColor }} />}
                  <div className={cn("text-2xl", templateStyles.headingWeight)}>{simulation.paybackYears.toFixed(1)} yrs</div>
                  <div className="text-xs" style={{ color: template.colors.textSecondary }}>Payback Period</div>
                </div>
                <div className={cn("text-center", templateStyles.sectionSpacing.p)} style={{ backgroundColor: template.colors.cardBg, borderRadius: borderRadiusStyle }}>
                  {template.layout.showIcons && <Zap className="h-8 w-8 mx-auto mb-2" style={{ color: primaryColor }} />}
                  <div className={cn("text-2xl", templateStyles.headingWeight)}>{simulation.roiPercentage.toFixed(0)}%</div>
                  <div className="text-xs" style={{ color: template.colors.textSecondary }}>25-Year ROI</div>
                </div>
              </div>
            )}

            {/* Executive Summary */}
            <div className={templateStyles.sectionSpacing.mb}>
              <h3 className={cn("text-lg mb-3", templateStyles.headingWeight)} style={{ color: primaryColor }}>
                {template.layout.showIcons && <Zap className="h-5 w-5 inline mr-2" />}
                Executive Summary
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: template.colors.textSecondary }}>
                {proposal.executive_summary || 
                  `This proposal outlines a ${simulation?.solarCapacity || 0} kWp solar PV system installation for ${project?.name}. The system is projected to generate ${formatNumber(simulation?.annualSolarGeneration || 0)} kWh annually, resulting in estimated annual savings of ${formatCurrency(simulation?.annualSavings || 0)} with a payback period of ${(simulation?.paybackYears || 0).toFixed(1)} years.`}
              </p>
            </div>
          </div>
        </PageWrapper>

        {/* Site Overview Page */}
        <PageWrapper pageNum={pages.find(p => p.id === "site")?.pageNum || 2}>
          <div>
            <h3 className={cn("text-lg mb-4", templateStyles.headingWeight)} style={{ color: primaryColor }}>
              {template.layout.showIcons && <MapPin className="h-5 w-5 inline mr-2" />}
              Site Overview
            </h3>
            
            {/* Map */}
            {project?.latitude && project?.longitude && (
              <div className={cn("mb-4 overflow-hidden border", templateStyles.sectionSpacing.mb)} style={{ height: "200px", borderRadius: borderRadiusStyle }}>
                <ProposalLocationMap
                  latitude={project.latitude}
                  longitude={project.longitude}
                  location={project.location}
                  projectName={project.name}
                />
              </div>
            )}
            
            {/* Site Details */}
            <div className={cn("grid grid-cols-2", templateStyles.sectionSpacing.gap)}>
              <div className={templateStyles.sectionSpacing.p} style={{ backgroundColor: template.colors.cardBg, borderRadius: borderRadiusStyle }}>
                <div className="text-xs mb-1" style={{ color: template.colors.textSecondary }}>Location</div>
                <div className={cn("font-medium", templateStyles.headingWeight === 'font-extrabold' && 'font-semibold')}>{project?.location || "Not specified"}</div>
              </div>
              <div className={templateStyles.sectionSpacing.p} style={{ backgroundColor: template.colors.cardBg, borderRadius: borderRadiusStyle }}>
                <div className="text-xs mb-1" style={{ color: template.colors.textSecondary }}>Total Area</div>
                <div className="font-medium">{project?.total_area_sqm ? `${formatNumber(project.total_area_sqm)} m²` : "—"}</div>
              </div>
              <div className={templateStyles.sectionSpacing.p} style={{ backgroundColor: template.colors.cardBg, borderRadius: borderRadiusStyle }}>
                <div className="text-xs mb-1" style={{ color: template.colors.textSecondary }}>Connection Size</div>
                <div className="font-medium">{project?.connection_size_kva ? `${project.connection_size_kva} kVA` : "—"}</div>
              </div>
              <div className={templateStyles.sectionSpacing.p} style={{ backgroundColor: template.colors.cardBg, borderRadius: borderRadiusStyle }}>
                <div className="text-xs mb-1" style={{ color: template.colors.textSecondary }}>Tariff</div>
                <div className="font-medium">{simulation?.tariffName || "Standard"}</div>
              </div>
            </div>
          </div>
        </PageWrapper>

        {/* System Design Page (conditional) */}
        {hasSystemDesign && (
          <PageWrapper pageNum={pages.find(p => p.id === "design")?.pageNum || 3}>
            <div>
              <h3 className={cn("text-lg mb-4", templateStyles.headingWeight)} style={{ color: primaryColor }}>
                {template.layout.showIcons && <LayoutDashboard className="h-5 w-5 inline mr-2" />}
                System Design
              </h3>
              <div className="border overflow-hidden" style={{ height: "400px", borderRadius: borderRadiusStyle }}>
                <FloorPlanMarkup projectId={project?.id} readOnly />
              </div>
            </div>
          </PageWrapper>
        )}

        {/* Load Analysis Page (conditional) */}
        {tenants && shopTypes && (
          <PageWrapper pageNum={pages.find(p => p.id === "load")?.pageNum || 4}>
            <div>
              <h3 className={cn("text-lg mb-4", templateStyles.headingWeight)} style={{ color: primaryColor }}>
                {template.layout.showIcons && <BarChart3 className="h-5 w-5 inline mr-2" />}
                Load Analysis
              </h3>
              
              {/* Tenant Summary */}
              <div className={templateStyles.sectionSpacing.mb}>
                <h4 className={cn("text-sm mb-2", templateStyles.headingWeight)}>Tenant Summary</h4>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className={template.layout.tableStyle === 'bordered' ? 'border border-b-2' : 'border-b'}>
                      <th className="text-left py-2 px-3">Tenant</th>
                      <th className="text-right py-2 px-3">Area (m²)</th>
                      <th className="text-left py-2 px-3">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.slice(0, 10).map((tenant: any, idx: number) => {
                      const shopType = shopTypes.find((st: any) => st.id === tenant.shop_type_id);
                      const rowBg = template.layout.tableStyle === 'striped' && idx % 2 === 1 ? template.colors.cardBg : 'transparent';
                      return (
                        <tr key={tenant.id} className={template.layout.tableStyle === 'bordered' ? 'border' : 'border-b'} style={{ backgroundColor: rowBg }}>
                          <td className="py-2 px-3">{tenant.name}</td>
                          <td className="text-right py-2 px-3">{formatNumber(tenant.area_sqm)}</td>
                          <td className="py-2 px-3">{shopType?.name || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {tenants.length > 10 && (
                  <p className="text-xs mt-2" style={{ color: template.colors.textSecondary }}>
                    + {tenants.length - 10} more tenants
                  </p>
                )}
              </div>

              {/* Load Profile Note */}
              <div className={cn("border text-center text-sm", templateStyles.sectionSpacing.p)} style={{ color: template.colors.textSecondary, borderRadius: borderRadiusStyle }}>
                <p>See attached load profile analysis for detailed consumption patterns.</p>
              </div>
            </div>
          </PageWrapper>
        )}

        {/* System Specification Page */}
        <PageWrapper pageNum={pages.find(p => p.id === "specs")?.pageNum || 5}>
          <div>
            <h3 className={cn("text-lg mb-4", templateStyles.headingWeight)} style={{ color: primaryColor }}>
              {template.layout.showIcons && <Sun className="h-5 w-5 inline mr-2" />}
              System Specification
            </h3>
            
            {simulation && (
              <div className={cn("space-y-4", templateStyles.sectionSpacing.gap)}>
                <div className={cn("grid grid-cols-2", templateStyles.sectionSpacing.gap)}>
                  <div className={templateStyles.sectionSpacing.p} style={{ backgroundColor: template.colors.cardBg, borderRadius: borderRadiusStyle }}>
                    <div className="text-xs mb-1" style={{ color: template.colors.textSecondary }}>Solar Capacity</div>
                    <div className={cn("text-xl", templateStyles.headingWeight)} style={{ color: primaryColor }}>{simulation.solarCapacity} kWp</div>
                  </div>
                  <div className={templateStyles.sectionSpacing.p} style={{ backgroundColor: template.colors.cardBg, borderRadius: borderRadiusStyle }}>
                    <div className="text-xs mb-1" style={{ color: template.colors.textSecondary }}>Battery Storage</div>
                    <div className={cn("text-xl", templateStyles.headingWeight)} style={{ color: primaryColor }}>{simulation.batteryCapacity} kWh</div>
                  </div>
                  <div className={templateStyles.sectionSpacing.p} style={{ backgroundColor: template.colors.cardBg, borderRadius: borderRadiusStyle }}>
                    <div className="text-xs mb-1" style={{ color: template.colors.textSecondary }}>Battery Power</div>
                    <div className={cn("text-xl", templateStyles.headingWeight)} style={{ color: primaryColor }}>{simulation.batteryPower} kW</div>
                  </div>
                  <div className={templateStyles.sectionSpacing.p} style={{ backgroundColor: template.colors.cardBg, borderRadius: borderRadiusStyle }}>
                    <div className="text-xs mb-1" style={{ color: template.colors.textSecondary }}>System Cost</div>
                    <div className={cn("text-xl", templateStyles.headingWeight)} style={{ color: primaryColor }}>{formatCurrency(simulation.systemCost)}</div>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className={cn("text-sm mb-3", templateStyles.headingWeight)}>Energy Performance</h4>
                  <div className={cn("grid grid-cols-3", templateStyles.sectionSpacing.gap)}>
                    <div className={cn("text-center", templateStyles.sectionSpacing.p)} style={{ backgroundColor: '#dcfce7', borderRadius: borderRadiusStyle }}>
                      <div className={cn("text-lg", templateStyles.headingWeight)} style={{ color: '#16a34a' }}>{formatNumber(simulation.annualSolarGeneration)}</div>
                      <div className="text-xs" style={{ color: template.colors.textSecondary }}>Annual Generation (kWh)</div>
                    </div>
                    <div className={cn("text-center", templateStyles.sectionSpacing.p)} style={{ backgroundColor: '#dbeafe', borderRadius: borderRadiusStyle }}>
                      <div className={cn("text-lg", templateStyles.headingWeight)} style={{ color: '#2563eb' }}>{formatNumber(simulation.annualGridImport)}</div>
                      <div className="text-xs" style={{ color: template.colors.textSecondary }}>Grid Import (kWh)</div>
                    </div>
                    <div className={cn("text-center", templateStyles.sectionSpacing.p)} style={{ backgroundColor: '#ffedd5', borderRadius: borderRadiusStyle }}>
                      <div className={cn("text-lg", templateStyles.headingWeight)} style={{ color: '#ea580c' }}>{formatNumber(simulation.annualGridExport)}</div>
                      <div className="text-xs" style={{ color: template.colors.textSecondary }}>Grid Export (kWh)</div>
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
            <h3 className={cn("text-lg mb-4", templateStyles.headingWeight)} style={{ color: primaryColor }}>
              {template.layout.showIcons && <TrendingUp className="h-5 w-5 inline mr-2" />}
              25-Year Financial Projection
            </h3>
            
            <table className="w-full text-xs border-collapse mb-4">
              <thead>
                <tr style={{ backgroundColor: secondaryColor, color: isLightHeader ? template.colors.textPrimary : "white" }}>
                  <th className="py-2 px-2 text-left">Year</th>
                  <th className="py-2 px-2 text-right">Generation (kWh)</th>
                  <th className="py-2 px-2 text-right">Annual Savings</th>
                  <th className="py-2 px-2 text-right">Cumulative</th>
                  <th className="py-2 px-2 text-right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {projection.map((row, idx) => {
                  const rowBg = template.layout.tableStyle === 'striped' && idx % 2 === 1 ? template.colors.cardBg : 'transparent';
                  return (
                    <tr 
                      key={row.year} 
                      className={template.layout.tableStyle === 'bordered' ? 'border' : 'border-b'}
                      style={{ 
                        backgroundColor: row.year === paybackYear ? '#dcfce7' : rowBg,
                        fontWeight: row.year === paybackYear ? 500 : undefined,
                      }}
                    >
                      <td className="py-1 px-2">{row.year}</td>
                      <td className="py-1 px-2 text-right">{formatNumber(row.generation)}</td>
                      <td className="py-1 px-2 text-right">{formatCurrency(row.savings)}</td>
                      <td className="py-1 px-2 text-right">{formatCurrency(row.cumulative)}</td>
                      <td className="py-1 px-2 text-right">{row.roi.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {paybackYear > 0 && (
              <div className={cn("text-center", templateStyles.sectionSpacing.p)} style={{ backgroundColor: '#dcfce7', borderRadius: borderRadiusStyle }}>
                <span style={{ color: '#16a34a' }} className={templateStyles.headingWeight}>
                  ✓ Investment payback achieved in Year {paybackYear}
                </span>
              </div>
            )}
          </div>
        </PageWrapper>

        {/* Terms & Signatures Page */}
        <PageWrapper pageNum={pages.find(p => p.id === "terms")?.pageNum || 7}>
          <div>
            <h3 className={cn("text-lg mb-4", templateStyles.headingWeight)} style={{ color: primaryColor }}>
              {template.layout.showIcons && <Calendar className="h-5 w-5 inline mr-2" />}
              Terms & Conditions
            </h3>
            
            {/* Assumptions */}
            <div className={templateStyles.sectionSpacing.mb}>
              <h4 className={cn("text-sm mb-2", templateStyles.headingWeight)}>Assumptions</h4>
              <div className={cn("text-xs leading-relaxed whitespace-pre-line", templateStyles.sectionSpacing.p)} 
                   style={{ 
                     color: template.colors.textSecondary, 
                     backgroundColor: template.layout.useCards ? template.colors.cardBg : 'transparent',
                     borderRadius: borderRadiusStyle,
                     borderLeft: !template.layout.useCards ? `3px solid ${primaryColor}` : undefined,
                     paddingLeft: !template.layout.useCards ? '1rem' : undefined,
                   }}>
                {proposal.assumptions || "• 0.5% annual panel degradation\n• 8% annual tariff escalation\n• Standard weather conditions"}
              </div>
            </div>
            
            {/* Disclaimers */}
            <div className={templateStyles.sectionSpacing.mb}>
              <h4 className={cn("text-sm mb-2", templateStyles.headingWeight)}>Disclaimers</h4>
              <p className={cn("text-xs leading-relaxed", templateStyles.sectionSpacing.p)} 
                 style={{ 
                   color: template.colors.textSecondary,
                   backgroundColor: '#fef3c7',
                   borderRadius: borderRadiusStyle,
                   border: '1px solid #fcd34d',
                 }}>
                {proposal.disclaimers || "This proposal is based on estimated consumption data and solar irradiance forecasts. Actual performance may vary."}
              </p>
            </div>
            
            {/* Signatures */}
            <div className={cn("grid grid-cols-2 mt-12 pt-8 border-t", templateStyles.sectionSpacing.gap)}>
              <div>
                <div className="border-b-2 h-12 mb-2" style={{ borderColor: template.colors.tableBorder }}></div>
                <div className={cn("text-sm", templateStyles.headingWeight)}>{proposal.prepared_by || "Prepared By"}</div>
                <div className="text-xs" style={{ color: template.colors.textSecondary }}>Company Representative</div>
              </div>
              <div>
                <div className="border-b-2 h-12 mb-2" style={{ borderColor: template.colors.tableBorder }}></div>
                <div className={cn("text-sm", templateStyles.headingWeight)}>{proposal.client_signature || "Client Signature"}</div>
                <div className="text-xs" style={{ color: template.colors.textSecondary }}>Date: _______________</div>
              </div>
            </div>
          </div>
        </PageWrapper>
      </div>
    );
  }
);

ProposalPrintView.displayName = "ProposalPrintView";
