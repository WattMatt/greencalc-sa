import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sun, Battery, Zap, TrendingUp, Calendar, MapPin, LayoutDashboard, BarChart3, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Proposal, SimulationData, ProposalBranding } from "./types";
import { ProposalTemplateId, PROPOSAL_TEMPLATES, getTemplateStyles } from "./templates/types";
import { FloorPlanMarkup } from "@/components/floor-plan/FloorPlanMarkup";
import { LoadProfileChart } from "@/components/projects/LoadProfileChart";
import { ProposalLocationMap } from "./ProposalLocationMap";
import { cn } from "@/lib/utils";

interface ProposalPreviewProps {
  proposal: Partial<Proposal>;
  project: any;
  simulation?: SimulationData;
  tenants?: any[];
  shopTypes?: any[];
  showSystemDesign?: boolean;
  templateId?: ProposalTemplateId;
}

export function ProposalPreview({ proposal, project, simulation, tenants, shopTypes, showSystemDesign, templateId = "modern" }: ProposalPreviewProps) {
  const template = PROPOSAL_TEMPLATES[templateId];
  const templateStyles = getTemplateStyles(template);
  const branding = proposal.branding as ProposalBranding;
  const primaryColor = branding?.primary_color || template.colors.accentColor;
  const secondaryColor = branding?.secondary_color || template.colors.headerBg;
  const [showFullProjection, setShowFullProjection] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  // Check if PV layout exists for this project
  const { data: pvLayout } = useQuery({
    queryKey: ["pv-layout-exists", project?.id],
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
  const generateProjection = () => {
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
  };

  const projection = generateProjection();
  const displayedProjection = showFullProjection ? projection : projection.slice(0, 10);
  const paybackYear = projection.find(p => p.cumulative >= (simulation?.systemCost || 0))?.year || 0;

  // Define pages based on available content
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
  const currentPageData = pages[currentPage];

  // Derive styles from template
  const isLightHeader = template.colors.headerBg === '#ffffff' || template.colors.headerBg === '#fafaf9';
  const headerTextColor = isLightHeader ? template.colors.textPrimary : '#ffffff';
  const headerSubtextColor = isLightHeader ? template.colors.textSecondary : 'rgba(255,255,255,0.7)';

  // Border radius based on card style
  const borderRadiusStyle = template.layout.cardStyle === 'rounded' ? '0.75rem' : 
                             template.layout.cardStyle === 'subtle' ? '0.375rem' : '0';

  // Shadow based on template
  const shadowStyle = template.layout.shadowStyle === 'pronounced' ? '0 10px 25px -5px rgba(0,0,0,0.1)' :
                      template.layout.shadowStyle === 'medium' ? '0 4px 12px -2px rgba(0,0,0,0.08)' :
                      template.layout.shadowStyle === 'subtle' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none';

  const formatCurrency = (value: number) => `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const formatNumber = (value: number) => value.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Open print preview in new window
  const openPrintPreview = useCallback(() => {
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) {
      alert('Please allow popups for this site to use print preview.');
      return;
    }

    // Generate all pages HTML
    const generatePageHTML = (pageId: string, pageNum: number, content: string) => `
      <div class="page" style="width: 794px; min-height: 1123px; background: white; margin: 0 auto 20px; display: flex; flex-direction: column; border-radius: ${borderRadiusStyle}; box-shadow: 0 4px 12px rgba(0,0,0,0.1); page-break-after: always; overflow: hidden;">
        <div style="padding: ${template.layout.sectionSpacing === 'spacious' ? '1.25rem' : '1rem'}; background: ${secondaryColor}; color: ${headerTextColor}; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${branding?.logo_url ? `<img src="${branding.logo_url}" alt="Logo" style="height: 40px; object-fit: contain;" />` : ''}
            <div>
              <div style="font-size: 18px; font-weight: bold;">${branding?.company_name || 'Solar Installation Proposal'}</div>
              <div style="font-size: 12px; color: ${headerSubtextColor};">${project?.name || ''}</div>
            </div>
          </div>
          <div style="text-align: right; display: flex; align-items: center; gap: 12px;">
            <span style="background: ${primaryColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">v${proposal.version || 1}</span>
            <span style="font-size: 12px; color: ${headerSubtextColor};">Page ${pageNum} of ${totalPages}</span>
          </div>
        </div>
        <div style="flex: 1; padding: ${template.layout.sectionSpacing === 'spacious' ? '1.5rem' : '1rem'};">
          ${content}
        </div>
        <div style="padding: 12px; background: ${secondaryColor}; color: ${headerTextColor}; text-align: center; font-size: 12px;">
          ${[branding?.contact_email, branding?.contact_phone, branding?.website].filter(Boolean).join(' • ')}
        </div>
      </div>
    `;

    // Cover page content
    const coverContent = `
      <div style="background: ${primaryColor}; color: white; padding: ${template.layout.sectionSpacing === 'spacious' ? '2rem' : '1.5rem'}; border-radius: ${borderRadiusStyle}; margin-bottom: 1.5rem;">
        <h2 style="font-size: 24px; margin: 0 0 8px; font-weight: ${template.typography.headingWeight};">Solar Installation Proposal</h2>
        <p style="opacity: 0.8; margin: 0 0 8px;">${project?.name || ''}</p>
        <p style="opacity: 0.7; font-size: 12px; margin: 0;">${new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      ${simulation ? `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: ${template.layout.sectionSpacing === 'spacious' ? '1.5rem' : '1rem'}; margin-bottom: 1.5rem;">
        <div style="background: ${template.colors.cardBg}; padding: 1rem; border-radius: ${borderRadiusStyle}; text-align: center; box-shadow: ${shadowStyle};">
          <div style="font-size: 24px; font-weight: bold; color: ${template.colors.textPrimary};">${simulation.solarCapacity} kWp</div>
          <div style="font-size: 12px; color: ${template.colors.textSecondary};">System Size</div>
        </div>
        <div style="background: ${template.colors.cardBg}; padding: 1rem; border-radius: ${borderRadiusStyle}; text-align: center; box-shadow: ${shadowStyle};">
          <div style="font-size: 24px; font-weight: bold; color: ${template.colors.textPrimary};">${formatCurrency(simulation.annualSavings)}</div>
          <div style="font-size: 12px; color: ${template.colors.textSecondary};">Annual Savings</div>
        </div>
        <div style="background: ${template.colors.cardBg}; padding: 1rem; border-radius: ${borderRadiusStyle}; text-align: center; box-shadow: ${shadowStyle};">
          <div style="font-size: 24px; font-weight: bold; color: ${template.colors.textPrimary};">${simulation.paybackYears.toFixed(1)} yrs</div>
          <div style="font-size: 12px; color: ${template.colors.textSecondary};">Payback Period</div>
        </div>
        <div style="background: ${template.colors.cardBg}; padding: 1rem; border-radius: ${borderRadiusStyle}; text-align: center; box-shadow: ${shadowStyle};">
          <div style="font-size: 24px; font-weight: bold; color: ${template.colors.textPrimary};">${simulation.roiPercentage.toFixed(0)}%</div>
          <div style="font-size: 12px; color: ${template.colors.textSecondary};">25-Year ROI</div>
        </div>
      </div>
      ` : ''}
      <div>
        <h3 style="font-size: 18px; color: ${primaryColor}; margin: 0 0 12px; font-weight: ${template.typography.headingWeight};">Executive Summary</h3>
        <p style="color: ${template.colors.textSecondary}; line-height: 1.6; margin: 0;">
          ${proposal.executive_summary || `This proposal outlines a ${simulation?.solarCapacity || 0} kWp solar PV system installation for ${project?.name}. The system is projected to generate ${formatNumber(simulation?.annualSolarGeneration || 0)} kWh annually, resulting in estimated annual savings of ${formatCurrency(simulation?.annualSavings || 0)} with a payback period of ${(simulation?.paybackYears || 0).toFixed(1)} years.`}
        </p>
      </div>
    `;

    // Site overview content
    const siteContent = `
      <h3 style="font-size: 18px; color: ${primaryColor}; margin: 0 0 16px; font-weight: ${template.typography.headingWeight};">Site Overview</h3>
      <div style="height: 200px; background: #f0f0f0; border-radius: ${borderRadiusStyle}; margin-bottom: 16px; display: flex; align-items: center; justify-content: center; border: 1px solid ${template.colors.tableBorder};">
        <span style="color: ${template.colors.textSecondary};">📍 ${project?.location || 'Location Map'}</span>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: ${template.layout.sectionSpacing === 'spacious' ? '1rem' : '0.75rem'};">
        <div style="background: ${template.colors.cardBg}; padding: 0.75rem; border-radius: ${borderRadiusStyle};">
          <div style="font-size: 12px; color: ${template.colors.textSecondary}; margin-bottom: 4px;">Location</div>
          <div style="font-weight: 500; color: ${template.colors.textPrimary};">${project?.location || 'Not specified'}</div>
        </div>
        <div style="background: ${template.colors.cardBg}; padding: 0.75rem; border-radius: ${borderRadiusStyle};">
          <div style="font-size: 12px; color: ${template.colors.textSecondary}; margin-bottom: 4px;">Total Area</div>
          <div style="font-weight: 500; color: ${template.colors.textPrimary};">${project?.total_area_sqm ? formatNumber(project.total_area_sqm) + ' m²' : '—'}</div>
        </div>
        <div style="background: ${template.colors.cardBg}; padding: 0.75rem; border-radius: ${borderRadiusStyle};">
          <div style="font-size: 12px; color: ${template.colors.textSecondary}; margin-bottom: 4px;">Connection Size</div>
          <div style="font-weight: 500; color: ${template.colors.textPrimary};">${project?.connection_size_kva ? project.connection_size_kva + ' kVA' : '—'}</div>
        </div>
        <div style="background: ${template.colors.cardBg}; padding: 0.75rem; border-radius: ${borderRadiusStyle};">
          <div style="font-size: 12px; color: ${template.colors.textSecondary}; margin-bottom: 4px;">Tariff</div>
          <div style="font-weight: 500; color: ${template.colors.textPrimary};">${simulation?.tariffName || 'Standard'}</div>
        </div>
      </div>
    `;

    // Specs content
    const specsContent = `
      <h3 style="font-size: 18px; color: ${primaryColor}; margin: 0 0 16px; font-weight: ${template.typography.headingWeight};">System Specification</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: ${template.layout.sectionSpacing === 'spacious' ? '1rem' : '0.75rem'}; margin-bottom: 1.5rem;">
        <div style="background: ${template.colors.cardBg}; padding: 1rem; border-radius: ${borderRadiusStyle}; text-align: center; box-shadow: ${shadowStyle};">
          <div style="font-size: 24px; font-weight: bold; color: ${template.colors.textPrimary};">${simulation?.solarCapacity || 0} kWp</div>
          <div style="font-size: 12px; color: ${template.colors.textSecondary};">Solar Capacity</div>
        </div>
        <div style="background: ${template.colors.cardBg}; padding: 1rem; border-radius: ${borderRadiusStyle}; text-align: center; box-shadow: ${shadowStyle};">
          <div style="font-size: 24px; font-weight: bold; color: ${template.colors.textPrimary};">${simulation?.batteryCapacity || 0} kWh</div>
          <div style="font-size: 12px; color: ${template.colors.textSecondary};">Battery Storage</div>
        </div>
        <div style="background: ${template.colors.cardBg}; padding: 1rem; border-radius: ${borderRadiusStyle}; text-align: center; box-shadow: ${shadowStyle};">
          <div style="font-size: 24px; font-weight: bold; color: ${template.colors.textPrimary};">${formatNumber(simulation?.annualSolarGeneration || 0)}</div>
          <div style="font-size: 12px; color: ${template.colors.textSecondary};">Annual Generation (kWh)</div>
        </div>
        <div style="background: ${template.colors.cardBg}; padding: 1rem; border-radius: ${borderRadiusStyle}; text-align: center; box-shadow: ${shadowStyle};">
          <div style="font-size: 24px; font-weight: bold; color: ${template.colors.textPrimary};">${simulation?.solarCapacity ? ((simulation.annualSolarGeneration || 0) / simulation.solarCapacity).toFixed(0) : 0}</div>
          <div style="font-size: 12px; color: ${template.colors.textSecondary};">Specific Yield (kWh/kWp)</div>
        </div>
      </div>
      <div style="padding: 1rem; border: 1px solid ${primaryColor}40; border-radius: ${borderRadiusStyle}; background: ${primaryColor}05;">
        <h4 style="margin: 0 0 12px; font-weight: ${template.typography.headingWeight}; color: ${template.colors.textPrimary};">Annual Energy Flow</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
          <div>
            <div style="color: ${template.colors.textSecondary}; font-size: 14px;">Solar Generation</div>
            <div style="font-size: 18px; font-weight: bold; color: ${template.colors.textPrimary};">${formatNumber(simulation?.annualSolarGeneration || 0)} kWh</div>
          </div>
          <div>
            <div style="color: ${template.colors.textSecondary}; font-size: 14px;">Grid Import</div>
            <div style="font-size: 18px; font-weight: bold; color: ${template.colors.textPrimary};">${formatNumber(simulation?.annualGridImport || 0)} kWh</div>
          </div>
          <div>
            <div style="color: ${template.colors.textSecondary}; font-size: 14px;">Grid Export</div>
            <div style="font-size: 18px; font-weight: bold; color: ${template.colors.textPrimary};">${formatNumber(simulation?.annualGridExport || 0)} kWh</div>
          </div>
        </div>
      </div>
    `;

    // Financial content
    const financialContent = `
      <h3 style="font-size: 18px; color: ${primaryColor}; margin: 0 0 16px; font-weight: ${template.typography.headingWeight};">Financial Analysis</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem;">
        <div style="padding: 0.75rem; border-radius: ${borderRadiusStyle}; background: ${primaryColor}10;">
          <div style="font-size: 12px; color: ${template.colors.textSecondary};">System Cost</div>
          <div style="font-size: 20px; font-weight: bold; color: ${template.colors.textPrimary};">${formatCurrency(simulation?.systemCost || 0)}</div>
        </div>
        <div style="padding: 0.75rem; border-radius: ${borderRadiusStyle}; background: ${primaryColor}10;">
          <div style="font-size: 12px; color: ${template.colors.textSecondary};">Annual Savings</div>
          <div style="font-size: 20px; font-weight: bold; color: ${template.colors.textPrimary};">${formatCurrency(simulation?.annualSavings || 0)}</div>
        </div>
        <div style="padding: 0.75rem; border-radius: ${borderRadiusStyle}; background: ${primaryColor}10;">
          <div style="font-size: 12px; color: ${template.colors.textSecondary};">Payback Period</div>
          <div style="font-size: 20px; font-weight: bold; color: ${template.colors.textPrimary};">${paybackYear || (simulation?.paybackYears || 0).toFixed(1)} years</div>
        </div>
        <div style="padding: 0.75rem; border-radius: ${borderRadiusStyle}; background: ${primaryColor}10;">
          <div style="font-size: 12px; color: ${template.colors.textSecondary};">25-Year ROI</div>
          <div style="font-size: 20px; font-weight: bold; color: ${primaryColor};">${projection[24]?.roi.toFixed(0) || 0}%</div>
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="border-bottom: 2px solid ${template.colors.tableBorder};">
            <th style="text-align: left; padding: 8px 4px; color: ${template.colors.textPrimary};">Year</th>
            <th style="text-align: right; padding: 8px 4px; color: ${template.colors.textPrimary};">Generation (kWh)</th>
            <th style="text-align: right; padding: 8px 4px; color: ${template.colors.textPrimary};">Annual Savings</th>
            <th style="text-align: right; padding: 8px 4px; color: ${template.colors.textPrimary};">Cumulative</th>
            <th style="text-align: right; padding: 8px 4px; color: ${template.colors.textPrimary};">ROI</th>
          </tr>
        </thead>
        <tbody>
          ${projection.slice(0, 15).map((row, idx) => `
            <tr style="border-bottom: 1px solid ${template.colors.tableBorder}; background: ${row.year === paybackYear ? primaryColor + '15' : (template.layout.tableStyle === 'striped' && idx % 2 === 1 ? template.colors.cardBg : 'transparent')};">
              <td style="padding: 6px 4px; color: ${template.colors.textPrimary};">${row.year}${row.year === paybackYear ? ' ✓' : ''}</td>
              <td style="text-align: right; padding: 6px 4px; color: ${template.colors.textSecondary};">${formatNumber(row.generation)}</td>
              <td style="text-align: right; padding: 6px 4px; color: ${template.colors.textSecondary};">${formatCurrency(row.savings)}</td>
              <td style="text-align: right; padding: 6px 4px; color: ${template.colors.textSecondary};">${formatCurrency(row.cumulative)}</td>
              <td style="text-align: right; padding: 6px 4px; color: ${row.roi > 0 ? primaryColor : template.colors.textSecondary};">${row.roi.toFixed(0)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${projection.length > 15 ? `<p style="text-align: center; font-size: 12px; color: ${template.colors.textSecondary}; margin-top: 8px;">+ ${projection.length - 15} more years (see full report)</p>` : ''}
    `;

    // Terms content
    const termsContent = `
      <h3 style="font-size: 18px; color: ${primaryColor}; margin: 0 0 16px; font-weight: ${template.typography.headingWeight};">Assumptions & Disclaimers</h3>
      <div style="margin-bottom: 1rem; padding: 0.75rem; border-radius: ${borderRadiusStyle}; ${template.layout.useCards ? `background: ${template.colors.cardBg};` : `border-left: 3px solid ${primaryColor}; padding-left: 1rem;`}">
        <div style="font-weight: 500; margin-bottom: 4px; color: ${template.colors.textPrimary};">Assumptions</div>
        <div style="white-space: pre-line; font-size: 14px; color: ${template.colors.textSecondary};">${proposal.assumptions || '• 0.5% annual panel degradation\n• 8% annual tariff escalation\n• Standard weather conditions'}</div>
      </div>
      <div style="margin-bottom: 1rem; padding: 0.75rem; border-radius: ${borderRadiusStyle}; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3);">
        <div style="font-weight: 500; margin-bottom: 4px; color: ${template.colors.textPrimary};">Disclaimers</div>
        <div style="font-size: 14px; color: ${template.colors.textSecondary};">${proposal.disclaimers || 'Actual results may vary based on weather conditions, consumption patterns, and tariff changes.'}</div>
      </div>
      <div style="border-top: 1px solid ${template.colors.tableBorder}; padding-top: 2rem; margin-top: 2rem;">
        <h4 style="font-size: 14px; color: ${template.colors.textSecondary}; margin: 0 0 16px;">Signatures</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
          <div style="text-align: center;">
            <div style="height: 64px; border-bottom: 2px solid ${template.colors.tableBorder}; margin-bottom: 8px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px;">
              ${proposal.prepared_by ? `<span style="font-weight: 500; color: ${template.colors.textPrimary};">${proposal.prepared_by}</span>` : ''}
            </div>
            <div style="font-size: 12px; color: ${template.colors.textSecondary};">Prepared By</div>
          </div>
          <div style="text-align: center;">
            <div style="height: 64px; border-bottom: 2px solid ${template.colors.tableBorder}; margin-bottom: 8px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px;">
              ${proposal.approved_by ? `<span style="font-weight: 500; color: ${template.colors.textPrimary};">${proposal.approved_by}</span>` : ''}
            </div>
            <div style="font-size: 12px; color: ${template.colors.textSecondary};">Approved By</div>
          </div>
          <div style="text-align: center;">
            <div style="height: 64px; border-bottom: 2px solid ${template.colors.tableBorder}; margin-bottom: 8px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px;">
              ${proposal.client_signature ? `<span style="font-weight: 500; color: ${primaryColor};">${proposal.client_signature}</span>` : ''}
            </div>
            <div style="font-size: 12px; color: ${template.colors.textSecondary};">Client Acceptance</div>
          </div>
        </div>
      </div>
    `;

    // Build all pages
    let pageNum = 1;
    let allPagesHTML = '';
    
    allPagesHTML += generatePageHTML('cover', pageNum++, coverContent);
    allPagesHTML += generatePageHTML('site', pageNum++, siteContent);
    allPagesHTML += generatePageHTML('specs', pageNum++, specsContent);
    allPagesHTML += generatePageHTML('financial', pageNum++, financialContent);
    allPagesHTML += generatePageHTML('terms', pageNum++, termsContent);

    // Write to window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Proposal - ${project?.name || 'Print Preview'}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #e5e5e5; 
            padding: 20px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-controls {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            display: flex;
            gap: 8px;
          }
          .print-btn {
            background: ${primaryColor};
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          .print-btn:hover { opacity: 0.9; }
          .close-btn {
            background: #6b7280;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          .close-btn:hover { background: #4b5563; }
          @media print {
            body { background: white; padding: 0; }
            .print-controls { display: none; }
            .page { 
              box-shadow: none !important; 
              margin: 0 !important;
              border-radius: 0 !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-controls">
          <button class="print-btn" onclick="window.print()">
            🖨️ Print
          </button>
          <button class="close-btn" onclick="window.close()">Close</button>
        </div>
        ${allPagesHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
  }, [proposal, project, simulation, template, templateStyles, branding, primaryColor, secondaryColor, headerTextColor, headerSubtextColor, borderRadiusStyle, shadowStyle, pages, totalPages, projection, paybackYear, formatCurrency, formatNumber]);

  // Page header component
  const PageHeader = () => (
    <div
      className="shrink-0 flex items-center justify-between"
      style={{ 
        backgroundColor: secondaryColor, 
        color: headerTextColor,
        padding: template.layout.sectionSpacing === 'spacious' ? '1.25rem' : '1rem',
        borderTopLeftRadius: borderRadiusStyle,
        borderTopRightRadius: borderRadiusStyle,
      }}
    >
      <div className="flex items-center gap-3">
        {branding?.logo_url && (
          <img src={branding.logo_url} alt="Company logo" className="h-10 object-contain" />
        )}
        <div>
          <h1 className={cn("text-lg", templateStyles.headingWeight)}>
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
          Page {currentPageData?.pageNum || 1} of {totalPages}
        </span>
      </div>
    </div>
  );

  // Page footer component
  const PageFooter = () => (
    <div
      className="shrink-0 text-center text-xs mt-auto"
      style={{ 
        backgroundColor: secondaryColor, 
        color: headerTextColor,
        padding: '0.75rem',
        borderBottomLeftRadius: borderRadiusStyle,
        borderBottomRightRadius: borderRadiusStyle,
      }}
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

  // Metric card component for consistent styling
  const MetricCard = ({ icon: Icon, value, label, subLabel }: { icon?: any; value: string; label: string; subLabel?: string }) => (
    <div 
      className="text-center"
      style={{ 
        backgroundColor: template.colors.cardBg, 
        borderRadius: borderRadiusStyle,
        padding: template.layout.sectionSpacing === 'spacious' ? '1.5rem' : template.layout.sectionSpacing === 'relaxed' ? '1.25rem' : '1rem',
        boxShadow: shadowStyle,
        border: template.layout.borderWidth !== 'none' ? `1px solid ${template.colors.tableBorder}` : 'none',
      }}
    >
      {template.layout.showIcons && Icon && (
        <Icon className="h-8 w-8 mx-auto mb-2" style={{ color: primaryColor }} />
      )}
      <div className={cn("text-2xl", templateStyles.headingWeight)} style={{ color: template.colors.textPrimary }}>{value}</div>
      <div className="text-xs" style={{ color: template.colors.textSecondary }}>{label}</div>
      {subLabel && <div className="text-xs" style={{ color: template.colors.textSecondary }}>{subLabel}</div>}
    </div>
  );

  // Section header component
  const SectionHeader = ({ icon: Icon, title }: { icon?: any; title: string }) => (
    <h2 
      className={cn("text-lg mb-4 flex items-center gap-2", templateStyles.headingWeight)}
      style={{ color: primaryColor }}
    >
      {template.layout.showIcons && Icon && <Icon className="h-5 w-5" />}
      {title}
    </h2>
  );

  // Info card for site details
  const InfoCard = ({ label, value }: { label: string; value: string }) => (
    <div 
      style={{ 
        backgroundColor: template.layout.useCards ? template.colors.cardBg : 'transparent',
        borderRadius: borderRadiusStyle,
        padding: template.layout.sectionSpacing === 'spacious' ? '1rem' : '0.75rem',
        borderBottom: !template.layout.useCards ? `1px solid ${template.colors.tableBorder}` : 'none',
        boxShadow: template.layout.useCards ? shadowStyle : 'none',
      }}
    >
      <div className="text-xs mb-1" style={{ color: template.colors.textSecondary }}>{label}</div>
      <div className={cn("font-medium", templateStyles.headingWeight === 'font-extrabold' && 'font-semibold')} style={{ color: template.colors.textPrimary }}>{value}</div>
    </div>
  );

  return (
    <div className="flex flex-col bg-muted/30" id="proposal-preview">
      {/* Pagination Controls */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
        </div>
        
        <div className="flex items-center gap-1">
          {pages.map((page, index) => (
            <button
              key={page.id}
              onClick={() => setCurrentPage(index)}
              className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                currentPage === index
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted-foreground/10"
              }`}
              title={page.title}
            >
              {page.pageNum}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openPrintPreview}
            title="Open full preview in new window"
          >
            <Printer className="h-4 w-4 mr-1" />
            Print Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Page Title */}
      <div className="px-4 py-2 bg-muted/50 border-b">
        <p className="text-sm text-muted-foreground text-center font-medium">
          {currentPageData?.title}
        </p>
      </div>

      {/* A4 Page Container */}
      <div className="p-4 flex justify-center overflow-auto">
        <div 
          className="overflow-hidden flex flex-col"
          style={{ 
            width: "100%",
            maxWidth: "794px",
            minHeight: "1123px",
            backgroundColor: '#ffffff',
            borderRadius: borderRadiusStyle,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 4px 12px -2px rgba(0,0,0,0.05)',
          }}
        >
          <PageHeader />
          
          <div 
            className="flex-1 overflow-auto"
            style={{ 
              padding: template.layout.sectionSpacing === 'spacious' ? '1.5rem' : 
                       template.layout.sectionSpacing === 'relaxed' ? '1.25rem' : 
                       template.layout.sectionSpacing === 'compact' ? '0.75rem' : '1rem',
              backgroundColor: '#ffffff',
            }}
          >
            {/* Cover & Summary Page */}
            {currentPageData?.id === "cover" && (
              <div>
                {/* Hero Banner */}
                <div 
                  className="text-white mb-6"
                  style={{ 
                    backgroundColor: primaryColor, 
                    borderRadius: borderRadiusStyle,
                    padding: template.layout.sectionSpacing === 'spacious' ? '2rem' : '1.5rem',
                  }}
                >
                  <h2 className={cn("text-2xl mb-2", templateStyles.headingWeight)}>Solar Installation Proposal</h2>
                  <p className="text-white/80 text-sm">{project?.name}</p>
                  <p className="text-white/70 text-xs mt-2">
                    {new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>

                {/* Key Metrics Grid */}
                {simulation && (
                  <div 
                    className="grid grid-cols-4 mb-6"
                    style={{ gap: template.layout.sectionSpacing === 'spacious' ? '1.5rem' : template.layout.sectionSpacing === 'relaxed' ? '1rem' : '0.75rem' }}
                  >
                    <MetricCard icon={Sun} value={`${simulation.solarCapacity} kWp`} label="System Size" />
                    <MetricCard icon={TrendingUp} value={formatCurrency(simulation.annualSavings)} label="Annual Savings" />
                    <MetricCard icon={Calendar} value={`${simulation.paybackYears.toFixed(1)} yrs`} label="Payback Period" />
                    <MetricCard icon={Zap} value={`${simulation.roiPercentage.toFixed(0)}%`} label="25-Year ROI" />
                  </div>
                )}

                {/* Executive Summary */}
                <div className="mb-6">
                  <SectionHeader icon={Zap} title="Executive Summary" />
                  <p className="leading-relaxed" style={{ color: template.colors.textSecondary }}>
                    {proposal.executive_summary ||
                      `This proposal outlines a ${simulation?.solarCapacity || 0} kWp solar PV system installation for ${project?.name}. ` +
                      `The system is projected to generate ${formatNumber(simulation?.annualSolarGeneration || 0)} kWh annually, ` +
                      `resulting in estimated annual savings of ${formatCurrency(simulation?.annualSavings || 0)} ` +
                      `with a payback period of ${(simulation?.paybackYears || 0).toFixed(1)} years.`
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Site Overview Page */}
            {currentPageData?.id === "site" && (
              <div>
                <SectionHeader icon={MapPin} title="Site Overview" />
                
                {/* Map */}
                <div 
                  className="mb-4 overflow-hidden border"
                  style={{ height: "240px", borderRadius: borderRadiusStyle, borderColor: template.colors.tableBorder }}
                >
                  <ProposalLocationMap
                    latitude={project?.latitude}
                    longitude={project?.longitude}
                    location={project?.location}
                    projectName={project?.name}
                  />
                </div>
                
                {/* Site Details Grid */}
                <div 
                  className="grid grid-cols-2"
                  style={{ gap: template.layout.sectionSpacing === 'spacious' ? '1rem' : '0.75rem' }}
                >
                  <InfoCard label="Location" value={project?.location || "Not specified"} />
                  <InfoCard label="Total Area" value={project?.total_area_sqm ? `${formatNumber(project.total_area_sqm)} m²` : "—"} />
                  <InfoCard label="Connection Size" value={project?.connection_size_kva ? `${project.connection_size_kva} kVA` : "—"} />
                  <InfoCard label="Tariff" value={simulation?.tariffName || "Standard"} />
                  {project?.latitude && project?.longitude && (
                    <div className="col-span-2">
                      <InfoCard label="Coordinates" value={`${project.latitude.toFixed(6)}, ${project.longitude.toFixed(6)}`} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* System Design Page */}
            {currentPageData?.id === "design" && hasSystemDesign && (
              <div>
                <SectionHeader icon={LayoutDashboard} title="System Design" />
                <div 
                  className="border overflow-hidden"
                  style={{ borderRadius: borderRadiusStyle, borderColor: template.colors.tableBorder }}
                >
                  <FloorPlanMarkup projectId={project?.id} readOnly={true} />
                </div>
              </div>
            )}

            {/* Load Analysis Page */}
            {currentPageData?.id === "load" && tenants && shopTypes && (
              <div>
                <SectionHeader icon={BarChart3} title="Load Analysis" />
                <div 
                  className="grid"
                  style={{ gap: template.layout.sectionSpacing === 'spacious' ? '1.5rem' : '1rem' }}
                >
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

            {/* System Specification Page */}
            {currentPageData?.id === "specs" && (
              <div>
                <SectionHeader icon={Sun} title="System Specification" />
                
                <div 
                  className="grid grid-cols-2 mb-6"
                  style={{ gap: template.layout.sectionSpacing === 'spacious' ? '1rem' : '0.75rem' }}
                >
                  <MetricCard icon={Sun} value={`${simulation?.solarCapacity || 0} kWp`} label="Solar Capacity" />
                  <MetricCard icon={Battery} value={`${simulation?.batteryCapacity || 0} kWh`} label="Battery Storage" subLabel={`${simulation?.batteryPower || 0} kW power`} />
                  <MetricCard icon={Zap} value={formatNumber(simulation?.annualSolarGeneration || 0)} label="Annual Generation" subLabel="kWh/year" />
                  <MetricCard icon={TrendingUp} value={simulation?.solarCapacity ? ((simulation.annualSolarGeneration || 0) / simulation.solarCapacity).toFixed(0) : "0"} label="Specific Yield" subLabel="kWh/kWp/year" />
                </div>

                {/* Energy Flow Summary */}
                <div 
                  style={{ 
                    padding: template.layout.sectionSpacing === 'spacious' ? '1.25rem' : '1rem',
                    borderRadius: borderRadiusStyle,
                    border: `1px solid ${primaryColor}40`,
                    backgroundColor: `${primaryColor}05`,
                  }}
                >
                  <h4 className={cn("mb-3", templateStyles.headingWeight)} style={{ color: template.colors.textPrimary }}>Annual Energy Flow</h4>
                  <div 
                    className="grid grid-cols-3 text-sm"
                    style={{ gap: template.layout.sectionSpacing === 'spacious' ? '1.5rem' : '1rem' }}
                  >
                    <div>
                      <p style={{ color: template.colors.textSecondary }}>Solar Generation</p>
                      <p className={cn("text-lg", templateStyles.headingWeight)} style={{ color: template.colors.textPrimary }}>{formatNumber(simulation?.annualSolarGeneration || 0)} kWh</p>
                    </div>
                    <div>
                      <p style={{ color: template.colors.textSecondary }}>Grid Import</p>
                      <p className={cn("text-lg", templateStyles.headingWeight)} style={{ color: template.colors.textPrimary }}>{formatNumber(simulation?.annualGridImport || 0)} kWh</p>
                    </div>
                    <div>
                      <p style={{ color: template.colors.textSecondary }}>Grid Export</p>
                      <p className={cn("text-lg", templateStyles.headingWeight)} style={{ color: template.colors.textPrimary }}>{formatNumber(simulation?.annualGridExport || 0)} kWh</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Financial Analysis Page */}
            {currentPageData?.id === "financial" && (
              <div>
                <SectionHeader icon={TrendingUp} title="Financial Analysis" />

                {/* Key Financial Metrics */}
                <div 
                  className="grid grid-cols-2 mb-6"
                  style={{ gap: template.layout.sectionSpacing === 'spacious' ? '1rem' : '0.75rem' }}
                >
                  <div 
                    style={{ 
                      padding: template.layout.sectionSpacing === 'spacious' ? '1rem' : '0.75rem',
                      borderRadius: borderRadiusStyle,
                      backgroundColor: `${primaryColor}10`,
                    }}
                  >
                    <p className="text-xs" style={{ color: template.colors.textSecondary }}>System Cost</p>
                    <p className={cn("text-xl", templateStyles.headingWeight)} style={{ color: template.colors.textPrimary }}>{formatCurrency(simulation?.systemCost || 0)}</p>
                  </div>
                  <div 
                    style={{ 
                      padding: template.layout.sectionSpacing === 'spacious' ? '1rem' : '0.75rem',
                      borderRadius: borderRadiusStyle,
                      backgroundColor: `${primaryColor}10`,
                    }}
                  >
                    <p className="text-xs" style={{ color: template.colors.textSecondary }}>Annual Savings</p>
                    <p className={cn("text-xl", templateStyles.headingWeight)} style={{ color: template.colors.textPrimary }}>{formatCurrency(simulation?.annualSavings || 0)}</p>
                  </div>
                  <div 
                    style={{ 
                      padding: template.layout.sectionSpacing === 'spacious' ? '1rem' : '0.75rem',
                      borderRadius: borderRadiusStyle,
                      backgroundColor: `${primaryColor}10`,
                    }}
                  >
                    <p className="text-xs" style={{ color: template.colors.textSecondary }}>Payback Period</p>
                    <p className={cn("text-xl", templateStyles.headingWeight)} style={{ color: template.colors.textPrimary }}>{paybackYear || (simulation?.paybackYears || 0).toFixed(1)} years</p>
                  </div>
                  <div 
                    style={{ 
                      padding: template.layout.sectionSpacing === 'spacious' ? '1rem' : '0.75rem',
                      borderRadius: borderRadiusStyle,
                      backgroundColor: `${primaryColor}10`,
                    }}
                  >
                    <p className="text-xs" style={{ color: template.colors.textSecondary }}>25-Year ROI</p>
                    <p className={cn("text-xl", templateStyles.headingWeight)} style={{ color: primaryColor }}>{projection[24]?.roi.toFixed(0) || simulation?.roiPercentage || 0}%</p>
                  </div>
                </div>

                {/* 25-Year Projection Table */}
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${template.colors.tableBorder}` }}>
                        <th className="text-left py-2 px-2" style={{ color: template.colors.textPrimary }}>Year</th>
                        <th className="text-right py-2 px-2" style={{ color: template.colors.textPrimary }}>Generation (kWh)</th>
                        <th className="text-right py-2 px-2" style={{ color: template.colors.textPrimary }}>Annual Savings</th>
                        <th className="text-right py-2 px-2" style={{ color: template.colors.textPrimary }}>Cumulative Savings</th>
                        <th className="text-right py-2 px-2" style={{ color: template.colors.textPrimary }}>ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedProjection.map((row, idx) => {
                        const isPaybackYear = row.year === paybackYear;
                        const rowBg = template.layout.tableStyle === 'striped' && idx % 2 === 1 ? template.colors.cardBg : 
                                       isPaybackYear ? `${primaryColor}10` : 'transparent';
                        return (
                          <tr
                            key={row.year}
                            style={{ 
                              borderBottom: `1px solid ${template.colors.tableBorder}`,
                              backgroundColor: rowBg,
                            }}
                          >
                            <td className="py-2 px-2" style={{ color: template.colors.textPrimary }}>
                              {row.year}
                              {isPaybackYear && (
                                <Badge 
                                  variant="outline" 
                                  className="ml-2 text-xs"
                                  style={{ borderColor: primaryColor, color: primaryColor }}
                                >
                                  Payback
                                </Badge>
                              )}
                            </td>
                            <td className="text-right py-2 px-2" style={{ color: template.colors.textSecondary }}>{formatNumber(row.generation)}</td>
                            <td className="text-right py-2 px-2" style={{ color: template.colors.textSecondary }}>{formatCurrency(row.savings)}</td>
                            <td className="text-right py-2 px-2" style={{ color: template.colors.textSecondary }}>{formatCurrency(row.cumulative)}</td>
                            <td className="text-right py-2 px-2" style={{ color: row.roi > 0 ? primaryColor : template.colors.textSecondary }}>
                              {row.roi.toFixed(0)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {projection.length > 10 && (
                    <Button
                      variant="ghost"
                      className="w-full mt-2"
                      style={{ color: template.colors.textSecondary }}
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
                  <div 
                    style={{ 
                      padding: template.layout.sectionSpacing === 'spacious' ? '1.25rem' : '1rem',
                      borderRadius: borderRadiusStyle,
                      border: `1px solid ${primaryColor}40`,
                      backgroundColor: `${primaryColor}05`,
                    }}
                  >
                    <h4 className={cn("mb-3", templateStyles.headingWeight)} style={{ color: template.colors.textPrimary }}>25-Year Summary</h4>
                    <div className="grid grid-cols-3 text-sm" style={{ gap: '1rem' }}>
                      <div>
                        <p style={{ color: template.colors.textSecondary }}>Total Generation</p>
                        <p className={templateStyles.headingWeight} style={{ color: template.colors.textPrimary }}>{formatNumber(projection.reduce((sum, r) => sum + r.generation, 0))} kWh</p>
                      </div>
                      <div>
                        <p style={{ color: template.colors.textSecondary }}>Total Savings</p>
                        <p className={templateStyles.headingWeight} style={{ color: template.colors.textPrimary }}>{formatCurrency(projection[24]?.cumulative || 0)}</p>
                      </div>
                      <div>
                        <p style={{ color: template.colors.textSecondary }}>Net Profit</p>
                        <p className={templateStyles.headingWeight} style={{ color: primaryColor }}>
                          {formatCurrency((projection[24]?.cumulative || 0) - (simulation?.systemCost || 0))}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Terms & Signatures Page */}
            {currentPageData?.id === "terms" && (
              <div>
                {/* Assumptions & Disclaimers */}
                <div className="mb-6">
                  <SectionHeader icon={Calendar} title="Assumptions & Disclaimers" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: template.layout.sectionSpacing === 'spacious' ? '1rem' : '0.75rem' }}>
                    <div 
                      style={{ 
                        padding: '0.75rem',
                        borderRadius: borderRadiusStyle,
                        backgroundColor: template.layout.useCards ? template.colors.cardBg : 'transparent',
                        borderLeft: !template.layout.useCards ? `3px solid ${primaryColor}` : 'none',
                        paddingLeft: !template.layout.useCards ? '1rem' : '0.75rem',
                      }}
                    >
                      <p className={cn("mb-1", templateStyles.headingWeight)} style={{ color: template.colors.textPrimary }}>Assumptions</p>
                      <p className="text-sm whitespace-pre-line" style={{ color: template.colors.textSecondary }}>
                        {proposal.assumptions || "• 0.5% annual panel degradation\n• 8% annual tariff escalation\n• Standard weather conditions"}
                      </p>
                    </div>
                    <div 
                      style={{ 
                        padding: '0.75rem',
                        borderRadius: borderRadiusStyle,
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                      }}
                    >
                      <p className={cn("mb-1", templateStyles.headingWeight)} style={{ color: template.colors.textPrimary }}>Disclaimers</p>
                      <p className="text-sm" style={{ color: template.colors.textSecondary }}>{proposal.disclaimers}</p>
                    </div>
                    {proposal.custom_notes && (
                      <div 
                        style={{ 
                          padding: '0.75rem',
                          borderRadius: borderRadiusStyle,
                          backgroundColor: template.layout.useCards ? template.colors.cardBg : 'transparent',
                          borderLeft: !template.layout.useCards ? `3px solid ${primaryColor}` : 'none',
                          paddingLeft: !template.layout.useCards ? '1rem' : '0.75rem',
                        }}
                      >
                        <p className={cn("mb-1", templateStyles.headingWeight)} style={{ color: template.colors.textPrimary }}>Additional Notes</p>
                        <p className="text-sm" style={{ color: template.colors.textSecondary }}>{proposal.custom_notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Verification Status */}
                {proposal.verification_checklist && (
                  <div 
                    className="mb-6"
                    style={{ 
                      padding: '1rem',
                      borderRadius: borderRadiusStyle,
                      backgroundColor: template.colors.cardBg,
                      border: `1px solid ${template.colors.tableBorder}`,
                    }}
                  >
                    <h3 className="text-sm font-semibold mb-2" style={{ color: template.colors.textSecondary }}>Data Verification</h3>
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
                <div style={{ borderTop: `1px solid ${template.colors.tableBorder}`, paddingTop: '1.5rem' }}>
                  <h3 className="text-sm font-semibold mb-4" style={{ color: template.colors.textSecondary }}>Signatures</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div 
                        className="h-16 mb-2 flex items-end justify-center pb-1"
                        style={{ borderBottom: `2px solid ${template.colors.tableBorder}` }}
                      >
                        {proposal.prepared_by && <span className={templateStyles.headingWeight} style={{ color: template.colors.textPrimary }}>{proposal.prepared_by}</span>}
                      </div>
                      <p className="text-xs" style={{ color: template.colors.textSecondary }}>Prepared By</p>
                      {proposal.prepared_at && (
                        <p className="text-xs" style={{ color: template.colors.textSecondary }}>
                          {new Date(proposal.prepared_at).toLocaleDateString('en-ZA')}
                        </p>
                      )}
                    </div>
                    <div className="text-center">
                      <div 
                        className="h-16 mb-2 flex items-end justify-center pb-1"
                        style={{ borderBottom: `2px solid ${template.colors.tableBorder}` }}
                      >
                        {proposal.approved_by && <span className={templateStyles.headingWeight} style={{ color: template.colors.textPrimary }}>{proposal.approved_by}</span>}
                      </div>
                      <p className="text-xs" style={{ color: template.colors.textSecondary }}>Approved By</p>
                      {proposal.approved_at && (
                        <p className="text-xs" style={{ color: template.colors.textSecondary }}>
                          {new Date(proposal.approved_at).toLocaleDateString('en-ZA')}
                        </p>
                      )}
                    </div>
                    <div className="text-center">
                      <div 
                        className="h-16 mb-2 flex items-end justify-center pb-1"
                        style={{ borderBottom: `2px solid ${template.colors.tableBorder}` }}
                      >
                        {proposal.client_signature && <span className={templateStyles.headingWeight} style={{ color: primaryColor }}>{proposal.client_signature}</span>}
                      </div>
                      <p className="text-xs" style={{ color: template.colors.textSecondary }}>Client Acceptance</p>
                      {proposal.client_signed_at && (
                        <p className="text-xs" style={{ color: template.colors.textSecondary }}>
                          {new Date(proposal.client_signed_at).toLocaleDateString('en-ZA')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <PageFooter />
        </div>
      </div>
    </div>
  );
}
