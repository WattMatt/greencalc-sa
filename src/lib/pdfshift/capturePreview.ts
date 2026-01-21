/**
 * WYSIWYG PDF capture utility
 * Generates standalone HTML with inline styles for PDFShift
 */

import type { Proposal, SimulationData, ProposalBranding } from "@/components/proposals/types";
import { ProposalTemplateId, PROPOSAL_TEMPLATES, getTemplateStyles } from "@/components/proposals/templates/types";

interface CaptureOptions {
  proposal: Partial<Proposal>;
  project: any;
  simulation?: SimulationData;
  tenants?: any[];
  shopTypes?: any[];
  showSystemDesign?: boolean;
  templateId?: ProposalTemplateId;
  title?: string;
}

/**
 * Generate full standalone HTML document for PDF conversion
 * Uses inline styles instead of Tailwind classes for PDFShift compatibility
 */
export async function generateProposalHTML(options: CaptureOptions): Promise<string> {
  const {
    proposal,
    project,
    simulation,
    tenants,
    shopTypes,
    showSystemDesign,
    templateId = "modern",
    title = "Solar Proposal",
  } = options;

  const template = PROPOSAL_TEMPLATES[templateId];
  const branding = proposal.branding as ProposalBranding;
  const primaryColor = branding?.primary_color || template.colors.accentColor;
  const secondaryColor = branding?.secondary_color || template.colors.headerBg;

  // Determine text colors based on header brightness
  const isLightHeader = template.colors.headerBg === '#ffffff' || template.colors.headerBg === '#fafaf9';
  const headerTextColor = isLightHeader ? '#1e293b' : '#ffffff';
  const headerSubtextColor = isLightHeader ? '#64748b' : 'rgba(255,255,255,0.7)';

  // Template-based styling
  const borderRadius = template.layout.cardStyle === 'rounded' ? '12px' : 
                       template.layout.cardStyle === 'subtle' ? '6px' : '0';
  const boxShadow = template.layout.shadowStyle === 'pronounced' ? '0 10px 25px -5px rgba(0,0,0,0.1)' :
                    template.layout.shadowStyle === 'medium' ? '0 4px 12px -2px rgba(0,0,0,0.08)' :
                    template.layout.shadowStyle === 'subtle' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none';
  const sectionPadding = template.layout.sectionSpacing === 'spacious' ? '24px' : 
                         template.layout.sectionSpacing === 'compact' ? '12px' : '16px';
  const sectionGap = template.layout.sectionSpacing === 'spacious' ? '24px' : 
                     template.layout.sectionSpacing === 'compact' ? '12px' : '16px';
  const headingWeight = template.typography.headingWeight;

  // Generate 25-year projection
  const projection: Array<{year: number; generation: number; savings: number; cumulative: number; roi: number}> = [];
  if (simulation) {
    let cumulativeSavings = 0;
    const annualDegradation = 0.005;
    const tariffEscalation = 0.08;

    for (let year = 1; year <= 25; year++) {
      const degradationFactor = Math.pow(1 - annualDegradation, year - 1);
      const escalationFactor = Math.pow(1 + tariffEscalation, year - 1);
      const yearSavings = simulation.annualSavings * degradationFactor * escalationFactor;
      cumulativeSavings += yearSavings;

      projection.push({
        year,
        generation: simulation.annualSolarGeneration * degradationFactor,
        savings: yearSavings,
        cumulative: cumulativeSavings,
        roi: ((cumulativeSavings - simulation.systemCost) / simulation.systemCost) * 100,
      });
    }
  }

  const paybackYear = projection.find(p => p.cumulative >= (simulation?.systemCost || 0))?.year || 0;

  // Helper functions
  const formatCurrency = (value: number) => `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const formatNumber = (value: number) => value.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const formatDate = () => new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

  // Calculate page count
  let pageCount = 6; // Cover, Site, Charts, Specs, Financial, Terms
  if (tenants && tenants.length > 0) pageCount++;

  // Generate SVG charts
  const generatePaybackChartSVG = (): string => {
    if (!simulation || projection.length === 0) return '';
    
    const width = 550;
    const height = 140;
    const padding = { top: 20, right: 50, bottom: 30, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const maxCumulative = Math.max(...projection.map(p => p.cumulative), simulation.systemCost * 1.1);
    const xScale = (year: number) => padding.left + ((year - 1) / 24) * chartWidth;
    const yScale = (value: number) => height - padding.bottom - (value / maxCumulative) * chartHeight;
    
    // Generate area path
    const areaPath = projection.map((p, i) => 
      `${i === 0 ? 'M' : 'L'} ${xScale(p.year)} ${yScale(p.cumulative)}`
    ).join(' ') + ` L ${xScale(25)} ${height - padding.bottom} L ${xScale(1)} ${height - padding.bottom} Z`;
    
    // Generate line path
    const linePath = projection.map((p, i) => 
      `${i === 0 ? 'M' : 'L'} ${xScale(p.year)} ${yScale(p.cumulative)}`
    ).join(' ');
    
    const investmentY = yScale(simulation.systemCost);
    const paybackX = paybackYear > 0 ? xScale(paybackYear) : 0;
    
    // Grid lines
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => 
      `<line x1="${padding.left}" y1="${padding.top + (1-pct) * chartHeight}" x2="${width - padding.right}" y2="${padding.top + (1-pct) * chartHeight}" stroke="#e5e7eb" stroke-dasharray="3 3"/>`
    ).join('');
    
    // Y-axis labels
    const yLabels = [0, 0.25, 0.5, 0.75, 1].map(pct => 
      `<text x="${padding.left - 8}" y="${padding.top + (1-pct) * chartHeight + 4}" font-size="9" fill="#6b7280" text-anchor="end">R${(maxCumulative * pct / 1000000).toFixed(1)}M</text>`
    ).join('');
    
    // X-axis labels
    const xLabels = [1, 5, 10, 15, 20, 25].map(year => 
      `<text x="${xScale(year)}" y="${height - padding.bottom + 15}" font-size="9" fill="#6b7280" text-anchor="middle">${year}</text>`
    ).join('');
    
    // Payback marker
    const paybackMarker = paybackYear > 0 ? `
      <line x1="${paybackX}" y1="${padding.top}" x2="${paybackX}" y2="${height - padding.bottom}" stroke="${primaryColor}" stroke-width="2"/>
      <circle cx="${paybackX}" cy="${yScale(projection[paybackYear-1]?.cumulative || 0)}" r="5" fill="${primaryColor}"/>
      <rect x="${paybackX - 35}" y="${padding.top - 5}" width="70" height="18" rx="4" fill="${primaryColor}"/>
      <text x="${paybackX}" y="${padding.top + 8}" font-size="9" fill="white" text-anchor="middle" font-weight="600">Payback: Yr ${paybackYear}</text>
    ` : '';
    
    return `
      <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto;">
        ${gridLines}
        ${yLabels}
        ${xLabels}
        <line x1="${padding.left}" y1="${investmentY}" x2="${width - padding.right}" y2="${investmentY}" stroke="#ef4444" stroke-width="2" stroke-dasharray="6 4"/>
        <text x="${width - padding.right + 4}" y="${investmentY + 4}" font-size="9" fill="#ef4444">Investment</text>
        <path d="${areaPath}" fill="${primaryColor}" fill-opacity="0.15"/>
        <path d="${linePath}" fill="none" stroke="${primaryColor}" stroke-width="2.5"/>
        ${paybackMarker}
        <text x="${width / 2}" y="${height - 5}" font-size="10" fill="#6b7280" text-anchor="middle">Year</text>
      </svg>
    `;
  };

  const generateEnergyFlowDonutSVG = (): string => {
    if (!simulation) return '';
    
    const width = 260;
    const height = 140;
    const centerX = 70;
    const centerY = 70;
    const outerRadius = 55;
    const innerRadius = 35;
    
    const selfConsumption = Math.max(0, simulation.annualSolarGeneration - simulation.annualGridExport);
    const total = selfConsumption + simulation.annualGridImport + simulation.annualGridExport;
    
    if (total === 0) return '';
    
    const data = [
      { name: 'Solar Self-Use', value: selfConsumption, color: primaryColor },
      { name: 'Grid Import', value: simulation.annualGridImport, color: '#ef4444' },
      { name: 'Grid Export', value: simulation.annualGridExport, color: '#3b82f6' },
    ].filter(d => d.value > 0);
    
    const totalConsumption = selfConsumption + simulation.annualGridImport;
    const solarCoverage = totalConsumption > 0 ? ((selfConsumption / totalConsumption) * 100).toFixed(0) : '0';
    
    // Calculate arc paths
    let currentAngle = -Math.PI / 2; // Start at top
    const arcs = data.map(d => {
      const angle = (d.value / total) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;
      
      const x1 = centerX + outerRadius * Math.cos(startAngle);
      const y1 = centerY + outerRadius * Math.sin(startAngle);
      const x2 = centerX + outerRadius * Math.cos(endAngle);
      const y2 = centerY + outerRadius * Math.sin(endAngle);
      const x3 = centerX + innerRadius * Math.cos(endAngle);
      const y3 = centerY + innerRadius * Math.sin(endAngle);
      const x4 = centerX + innerRadius * Math.cos(startAngle);
      const y4 = centerY + innerRadius * Math.sin(startAngle);
      
      const largeArc = angle > Math.PI ? 1 : 0;
      
      return {
        ...d,
        path: `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`,
        percentage: ((d.value / total) * 100).toFixed(0),
      };
    });
    
    // Donut segments
    const segments = arcs.map(arc => 
      `<path d="${arc.path}" fill="${arc.color}" stroke="white" stroke-width="2"/>`
    ).join('');
    
    // Legend - positioned to the right
    const legend = data.map((d, i) => `
      <rect x="145" y="${20 + i * 35}" width="10" height="10" rx="2" fill="${d.color}"/>
      <text x="160" y="${28 + i * 35}" font-size="9" fill="#374151">${d.name}</text>
      <text x="160" y="${40 + i * 35}" font-size="8" fill="#6b7280">${formatNumber(d.value)} kWh</text>
    `).join('');
    
    return `
      <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto;">
        ${segments}
        <text x="${centerX}" y="${centerY - 3}" font-size="16" font-weight="700" fill="${primaryColor}" text-anchor="middle">${solarCoverage}%</text>
        <text x="${centerX}" y="${centerY + 10}" font-size="8" fill="#6b7280" text-anchor="middle">Solar Coverage</text>
        ${legend}
      </svg>
    `;
  };

  const generateMonthlyGenerationChartSVG = (): string => {
    if (!simulation) return '';
    
    const width = 550;
    const height = 120;
    const padding = { top: 20, right: 20, bottom: 35, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Monthly solar generation factors (typical South African pattern)
    // Higher in summer (Oct-Mar), lower in winter (Apr-Sep)
    const monthlyFactors = [
      1.15, 1.10, 1.00, 0.85, 0.75, 0.70,  // Jan-Jun
      0.72, 0.82, 0.95, 1.08, 1.18, 1.20   // Jul-Dec
    ];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Calculate monthly values based on annual generation
    const avgMonthly = simulation.annualSolarGeneration / 12;
    const monthlyValues = monthlyFactors.map(f => Math.round(avgMonthly * f));
    const maxValue = Math.max(...monthlyValues) * 1.1;
    
    const barWidth = (chartWidth / 12) * 0.7;
    const barGap = (chartWidth / 12) * 0.3;
    
    const xScale = (month: number) => padding.left + (month * (chartWidth / 12)) + (barGap / 2);
    const yScale = (value: number) => height - padding.bottom - (value / maxValue) * chartHeight;
    
    // Grid lines
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => 
      `<line x1="${padding.left}" y1="${padding.top + (1-pct) * chartHeight}" x2="${width - padding.right}" y2="${padding.top + (1-pct) * chartHeight}" stroke="#e5e7eb" stroke-dasharray="3 3"/>`
    ).join('');
    
    // Y-axis labels
    const yLabels = [0, 0.25, 0.5, 0.75, 1].map(pct => 
      `<text x="${padding.left - 8}" y="${padding.top + (1-pct) * chartHeight + 4}" font-size="9" fill="#6b7280" text-anchor="end">${Math.round(maxValue * pct / 1000)}k</text>`
    ).join('');
    
    // Bars
    const bars = monthlyValues.map((value, i) => {
      const x = xScale(i);
      const y = yScale(value);
      const barHeight = height - padding.bottom - y;
      const isWinter = i >= 4 && i <= 7;
      const fillColor = isWinter ? '#94a3b8' : primaryColor;
      
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${fillColor}" rx="2"/>
        <text x="${x + barWidth/2}" y="${y - 4}" font-size="8" fill="${template.colors.textSecondary}" text-anchor="middle">${Math.round(value/1000)}k</text>
      `;
    }).join('');
    
    // X-axis labels
    const xLabels = monthNames.map((name, i) => 
      `<text x="${xScale(i) + barWidth/2}" y="${height - padding.bottom + 15}" font-size="9" fill="#6b7280" text-anchor="middle">${name}</text>`
    ).join('');
    
    return `
      <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto;">
        ${gridLines}
        ${yLabels}
        ${bars}
        ${xLabels}
        <text x="${padding.left - 35}" y="${height / 2}" font-size="9" fill="#6b7280" text-anchor="middle" transform="rotate(-90 ${padding.left - 35} ${height / 2})">kWh</text>
      </svg>
    `;
  };

  // Convert logo to base64 if present
  let logoBase64 = '';
  if (branding?.logo_url) {
    try {
      const response = await fetch(branding.logo_url);
      const blob = await response.blob();
      logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Failed to load logo:', e);
    }
  }

  // Generate static map image URL if coordinates available
  let staticMapUrl = '';
  if (project?.latitude && project?.longitude) {
    try {
      const { data, error } = await (await import("@/integrations/supabase/client")).supabase.functions.invoke("get-mapbox-token");
      if (!error && data?.token) {
        const lng = project.longitude;
        const lat = project.latitude;
        const zoom = 15;
        const width = 600;
        const height = 300;
        // Create marker with custom styling
        const marker = `pin-l+${primaryColor.replace('#', '')}(${lng},${lat})`;
        staticMapUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${marker}/${lng},${lat},${zoom}/${width}x${height}@2x?access_token=${data.token}`;
      }
    } catch (e) {
      console.warn('Failed to generate static map URL:', e);
    }
  }

  // Build HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1a1a1a;
      background: #f5f5f5;
    }
    
    .page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      background: white;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      page-break-inside: avoid;
      overflow: hidden;
    }
    
    .page:last-child {
      page-break-after: auto;
    }
    
    .no-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .header {
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .header-logo {
      height: 32px;
      object-fit: contain;
    }
    
    .header-title {
      font-size: 16px;
      font-weight: 700;
    }
    
    .header-subtitle {
      font-size: 11px;
    }
    
    .header-right {
      text-align: right;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .version-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    
    .page-number {
      font-size: 11px;
    }
    
    .content {
      flex: 1;
      padding: ${sectionPadding};
      overflow: hidden;
    }
    
    .footer {
      padding: 12px 24px;
      text-align: center;
      font-size: 11px;
      flex-shrink: 0;
    }
    
    .footer-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: ${headingWeight === 'extrabold' ? '800' : headingWeight === 'bold' ? '700' : '600'};
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .hero-banner {
      padding: 24px;
      border-radius: ${borderRadius};
      margin-bottom: ${sectionGap};
    }
    
    .hero-title {
      font-size: 24px;
      font-weight: ${headingWeight === 'extrabold' ? '800' : '700'};
      margin-bottom: 8px;
    }
    
    .hero-date {
      opacity: 0.8;
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: ${sectionGap};
      margin-bottom: ${sectionGap};
    }
    
    .metric-card {
      text-align: center;
      padding: ${sectionPadding};
      border-radius: ${borderRadius};
      box-shadow: ${boxShadow};
    }
    
    .metric-value {
      font-size: 20px;
      font-weight: ${headingWeight === 'extrabold' ? '800' : '700'};
      margin-bottom: 4px;
    }
    
    .metric-label {
      font-size: 11px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: ${sectionGap};
    }
    
    .info-card {
      padding: ${sectionPadding};
      border-radius: ${borderRadius};
      box-shadow: ${boxShadow};
    }
    
    .info-label {
      font-size: 11px;
      margin-bottom: 4px;
    }
    
    .info-value {
      font-weight: 600;
    }
    
    .spec-table, .projection-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    
    .spec-table th, .spec-table td,
    .projection-table th, .projection-table td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .spec-table th, .projection-table th {
      font-weight: 600;
      border-bottom-width: 2px;
    }
    
    .projection-table td.right, .projection-table th.right {
      text-align: right;
    }
    
    .projection-table tr.payback {
      font-weight: 700;
    }
    
    .terms-section {
      margin-bottom: 20px;
    }
    
    .terms-section h4 {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .terms-section p {
      font-size: 11px;
      line-height: 1.6;
    }
    
    .signature-box {
      padding: 24px;
      border: 1px solid #e5e7eb;
      border-radius: ${borderRadius};
      margin-top: 20px;
    }
    
    .signature-line {
      border-top: 1px solid #1a1a1a;
      width: 200px;
      margin-top: 40px;
      padding-top: 8px;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <!-- Page 1: Cover & Summary -->
  <div class="page">
    <div class="header" style="background-color: ${secondaryColor}; color: ${headerTextColor};">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="header-logo" />` : ''}
        <div>
          <div class="header-title">${branding?.company_name || 'Solar Installation Proposal'}</div>
          <div class="header-subtitle" style="color: ${headerSubtextColor};">${project?.name || 'Project'}</div>
        </div>
      </div>
      <div class="header-right">
        <span class="version-badge" style="background-color: ${primaryColor}; color: white;">v${proposal.version || 1}</span>
        <span class="page-number" style="color: ${headerSubtextColor};">Page 1 of ${pageCount}</span>
      </div>
    </div>
    
    <div class="content">
      <div class="hero-banner" style="background-color: ${primaryColor}; color: white;">
        <div class="hero-title">Solar Installation Proposal</div>
        <div class="hero-date">${formatDate()}</div>
      </div>
      
      ${simulation ? `
      <div class="metrics-grid">
        <div class="metric-card" style="background-color: ${template.colors.cardBg};">
          <div class="metric-value" style="color: ${template.colors.textPrimary};">${simulation.solarCapacity} kWp</div>
          <div class="metric-label" style="color: ${template.colors.textSecondary};">System Size</div>
        </div>
        <div class="metric-card" style="background-color: ${template.colors.cardBg};">
          <div class="metric-value" style="color: ${template.colors.textPrimary};">${formatCurrency(simulation.annualSavings)}</div>
          <div class="metric-label" style="color: ${template.colors.textSecondary};">Annual Savings</div>
        </div>
        <div class="metric-card" style="background-color: ${template.colors.cardBg};">
          <div class="metric-value" style="color: ${template.colors.textPrimary};">${simulation.paybackYears.toFixed(1)} yrs</div>
          <div class="metric-label" style="color: ${template.colors.textSecondary};">Payback Period</div>
        </div>
        <div class="metric-card" style="background-color: ${template.colors.cardBg};">
          <div class="metric-value" style="color: ${template.colors.textPrimary};">${simulation.roiPercentage.toFixed(0)}%</div>
          <div class="metric-label" style="color: ${template.colors.textSecondary};">25-Year ROI</div>
        </div>
      </div>
      ` : ''}
      
      <div class="section-title" style="color: ${primaryColor};">Executive Summary</div>
      <p style="color: ${template.colors.textSecondary}; line-height: 1.7;">
        ${proposal.executive_summary || 
          `This proposal outlines a ${simulation?.solarCapacity || 0} kWp solar PV system installation for ${project?.name}. 
           The system is projected to generate ${formatNumber(simulation?.annualSolarGeneration || 0)} kWh annually, 
           resulting in estimated annual savings of ${formatCurrency(simulation?.annualSavings || 0)} 
           with a payback period of ${(simulation?.paybackYears || 0).toFixed(1)} years.`}
      </p>
    </div>
    
    <div class="footer" style="background-color: ${secondaryColor}; color: ${headerTextColor};">
      <div class="footer-content">
        ${branding?.contact_email ? `<span>${branding.contact_email}</span>` : ''}
        ${branding?.contact_email && branding?.contact_phone ? '<span>•</span>' : ''}
        ${branding?.contact_phone ? `<span>${branding.contact_phone}</span>` : ''}
        ${branding?.website ? '<span>•</span>' : ''}
        ${branding?.website ? `<span>${branding.website}</span>` : ''}
      </div>
    </div>
  </div>

  <!-- Page 2: Site Overview -->
  <div class="page">
    <div class="header" style="background-color: ${secondaryColor}; color: ${headerTextColor};">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="header-logo" />` : ''}
        <div>
          <div class="header-title">${branding?.company_name || 'Solar Installation Proposal'}</div>
          <div class="header-subtitle" style="color: ${headerSubtextColor};">${project?.name || 'Project'}</div>
        </div>
      </div>
      <div class="header-right">
        <span class="version-badge" style="background-color: ${primaryColor}; color: white;">v${proposal.version || 1}</span>
        <span class="page-number" style="color: ${headerSubtextColor};">Page 2 of ${pageCount}</span>
      </div>
    </div>
    
    <div class="content">
      <div class="section-title" style="color: ${primaryColor};">Site Overview</div>
      
      <div class="info-grid" style="margin-bottom: ${sectionGap};">
        <div class="info-card" style="background-color: ${template.colors.cardBg};">
          <div class="info-label" style="color: ${template.colors.textSecondary};">Location</div>
          <div class="info-value" style="color: ${template.colors.textPrimary};">${project?.location || 'Not specified'}</div>
        </div>
        <div class="info-card" style="background-color: ${template.colors.cardBg};">
          <div class="info-label" style="color: ${template.colors.textSecondary};">Total Area</div>
          <div class="info-value" style="color: ${template.colors.textPrimary};">${project?.total_area_sqm ? `${formatNumber(project.total_area_sqm)} m²` : '—'}</div>
        </div>
        <div class="info-card" style="background-color: ${template.colors.cardBg};">
          <div class="info-label" style="color: ${template.colors.textSecondary};">Connection Size</div>
          <div class="info-value" style="color: ${template.colors.textPrimary};">${project?.connection_size_kva ? `${project.connection_size_kva} kVA` : '—'}</div>
        </div>
        <div class="info-card" style="background-color: ${template.colors.cardBg};">
          <div class="info-label" style="color: ${template.colors.textSecondary};">Tariff</div>
          <div class="info-value" style="color: ${template.colors.textPrimary};">${simulation?.tariffName || 'Standard'}</div>
        </div>
      </div>
      
      ${project?.latitude && project?.longitude ? `
      <div class="section-title" style="color: ${primaryColor}; margin-top: 24px;">Site Location</div>
      ${staticMapUrl ? `
      <div style="position: relative; border-radius: ${borderRadius}; overflow: hidden; margin-bottom: 16px; box-shadow: ${boxShadow};">
        <img src="${staticMapUrl}" alt="Site Location Map" style="width: 100%; height: auto; display: block;" />
        <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); padding: 12px 16px;">
          <div style="display: flex; align-items: center; gap: 8px; color: white;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <div>
              <div style="font-size: 12px; font-weight: 600;">${project?.location || project?.name || 'Project Location'}</div>
              <div style="font-size: 10px; opacity: 0.8;">${project.latitude.toFixed(4)}°, ${project.longitude.toFixed(4)}°</div>
            </div>
          </div>
        </div>
      </div>
      ` : `
      <div class="info-grid">
        <div class="info-card" style="background-color: ${template.colors.cardBg};">
          <div class="info-label" style="color: ${template.colors.textSecondary};">Latitude</div>
          <div class="info-value" style="color: ${template.colors.textPrimary};">${project.latitude.toFixed(6)}</div>
        </div>
        <div class="info-card" style="background-color: ${template.colors.cardBg};">
          <div class="info-label" style="color: ${template.colors.textSecondary};">Longitude</div>
          <div class="info-value" style="color: ${template.colors.textPrimary};">${project.longitude.toFixed(6)}</div>
        </div>
      </div>
      `}
      ` : ''}
    </div>
    
    <div class="footer" style="background-color: ${secondaryColor}; color: ${headerTextColor};">
      <div class="footer-content">
        ${branding?.contact_email ? `<span>${branding.contact_email}</span>` : ''}
        ${branding?.contact_email && branding?.contact_phone ? '<span>•</span>' : ''}
        ${branding?.contact_phone ? `<span>${branding.contact_phone}</span>` : ''}
        ${branding?.website ? '<span>•</span>' : ''}
        ${branding?.website ? `<span>${branding.website}</span>` : ''}
      </div>
    </div>
  </div>

  <!-- Page 3: Visual Analysis -->
  ${simulation ? `
  <div class="page">
    <div class="header" style="background-color: ${secondaryColor}; color: ${headerTextColor};">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="header-logo" />` : ''}
        <div>
          <div class="header-title">${branding?.company_name || 'Solar Installation Proposal'}</div>
          <div class="header-subtitle" style="color: ${headerSubtextColor};">${project?.name || 'Project'}</div>
        </div>
      </div>
      <div class="header-right">
        <span class="version-badge" style="background-color: ${primaryColor}; color: white;">v${proposal.version || 1}</span>
        <span class="page-number" style="color: ${headerSubtextColor};">Page 3 of ${pageCount}</span>
      </div>
    </div>
    
    <div class="content" style="padding: 12px 20px;">
      <div class="section-title" style="color: ${primaryColor}; font-size: 14px; margin-bottom: 10px;">Financial Outlook</div>
      
      <div class="no-break" style="background-color: ${template.colors.cardBg}; padding: 10px 14px; border-radius: ${borderRadius}; box-shadow: ${boxShadow}; margin-bottom: 12px;">
        <h4 style="font-size: 11px; font-weight: 600; margin-bottom: 6px; color: ${template.colors.textPrimary};">Cumulative Savings vs Investment</h4>
        ${generatePaybackChartSVG()}
        <p style="font-size: 9px; color: ${template.colors.textSecondary}; margin-top: 4px;">
          Payback occurs when savings exceed the initial investment (red dashed line).
        </p>
      </div>
      
      <div class="no-break" style="background-color: ${template.colors.cardBg}; padding: 10px 14px; border-radius: ${borderRadius}; box-shadow: ${boxShadow}; margin-bottom: 12px;">
        <h4 style="font-size: 11px; font-weight: 600; margin-bottom: 6px; color: ${template.colors.textPrimary};">Expected Monthly Generation</h4>
        ${generateMonthlyGenerationChartSVG()}
        <p style="font-size: 9px; color: ${template.colors.textSecondary}; margin-top: 4px;">
          Summer months (colored) produce more energy than winter months (gray).
        </p>
      </div>
      
      <div class="section-title" style="color: ${primaryColor}; font-size: 14px; margin-bottom: 10px;">Energy Distribution</div>
      
      <div class="no-break" style="display: flex; gap: 12px;">
        <div style="flex: 1; background-color: ${template.colors.cardBg}; padding: 10px 14px; border-radius: ${borderRadius}; box-shadow: ${boxShadow};">
          <h4 style="font-size: 11px; font-weight: 600; margin-bottom: 6px; color: ${template.colors.textPrimary};">Annual Energy Flow</h4>
          ${generateEnergyFlowDonutSVG()}
        </div>
        
        <div style="flex: 1; background-color: ${template.colors.cardBg}; padding: 10px 14px; border-radius: ${borderRadius}; box-shadow: ${boxShadow};">
          <h4 style="font-size: 11px; font-weight: 600; margin-bottom: 6px; color: ${template.colors.textPrimary};">Key Metrics</h4>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; padding: 8px; background: ${primaryColor}10; border-radius: 4px;">
              <span style="font-size: 10px; color: ${template.colors.textSecondary};">Annual Generation</span>
              <span style="font-size: 10px; font-weight: 600; color: ${template.colors.textPrimary};">${formatNumber(simulation.annualSolarGeneration)} kWh</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px; background: ${primaryColor}10; border-radius: 4px;">
              <span style="font-size: 10px; color: ${template.colors.textSecondary};">Grid Import Avoided</span>
              <span style="font-size: 10px; font-weight: 600; color: ${template.colors.textPrimary};">${formatNumber(Math.max(0, simulation.annualSolarGeneration - simulation.annualGridExport))} kWh</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px; background: ${primaryColor}10; border-radius: 4px;">
              <span style="font-size: 10px; color: ${template.colors.textSecondary};">CO₂ Offset (est.)</span>
              <span style="font-size: 10px; font-weight: 600; color: ${template.colors.textPrimary};">${formatNumber(Math.round(simulation.annualSolarGeneration * 0.9))} kg/year</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px; background: ${primaryColor}10; border-radius: 4px;">
              <span style="font-size: 10px; color: ${template.colors.textSecondary};">25-Year Savings</span>
              <span style="font-size: 10px; font-weight: 600; color: ${template.colors.textPrimary};">${formatCurrency(Math.round(projection[24]?.cumulative || 0))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="footer" style="background-color: ${secondaryColor}; color: ${headerTextColor};">
      <div class="footer-content">
        ${branding?.contact_email ? `<span>${branding.contact_email}</span>` : ''}
        ${branding?.contact_email && branding?.contact_phone ? '<span>•</span>' : ''}
        ${branding?.contact_phone ? `<span>${branding.contact_phone}</span>` : ''}
        ${branding?.website ? '<span>•</span>' : ''}
        ${branding?.website ? `<span>${branding.website}</span>` : ''}
      </div>
    </div>
  </div>
  ` : ''}

  ${tenants && tenants.length > 0 ? `
  <!-- Page 4: Load Analysis -->
  <div class="page">
    <div class="header" style="background-color: ${secondaryColor}; color: ${headerTextColor};">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="header-logo" />` : ''}
        <div>
          <div class="header-title">${branding?.company_name || 'Solar Installation Proposal'}</div>
          <div class="header-subtitle" style="color: ${headerSubtextColor};">${project?.name || 'Project'}</div>
        </div>
      </div>
      <div class="header-right">
        <span class="version-badge" style="background-color: ${primaryColor}; color: white;">v${proposal.version || 1}</span>
        <span class="page-number" style="color: ${headerSubtextColor};">Page 4 of ${pageCount}</span>
      </div>
    </div>
    
    <div class="content">
      <div class="section-title" style="color: ${primaryColor};">Load Analysis</div>
      
      <table class="spec-table">
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Area (m²)</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          ${tenants.slice(0, 15).map((tenant: any) => {
            const shopType = shopTypes?.find((st: any) => st.id === tenant.shop_type_id);
            return `
              <tr>
                <td>${tenant.name}</td>
                <td>${formatNumber(tenant.area_sqm)}</td>
                <td>${shopType?.name || '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      ${tenants.length > 15 ? `<p style="margin-top: 8px; font-size: 11px; color: ${template.colors.textSecondary};">+ ${tenants.length - 15} more tenants</p>` : ''}
    </div>
    
    <div class="footer" style="background-color: ${secondaryColor}; color: ${headerTextColor};">
      <div class="footer-content">
        ${branding?.contact_email ? `<span>${branding.contact_email}</span>` : ''}
        ${branding?.contact_email && branding?.contact_phone ? '<span>•</span>' : ''}
        ${branding?.contact_phone ? `<span>${branding.contact_phone}</span>` : ''}
        ${branding?.website ? '<span>•</span>' : ''}
        ${branding?.website ? `<span>${branding.website}</span>` : ''}
      </div>
    </div>
  </div>
  ` : ''}

  <!-- System Specification Page -->
  <div class="page">
    <div class="header" style="background-color: ${secondaryColor}; color: ${headerTextColor};">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="header-logo" />` : ''}
        <div>
          <div class="header-title">${branding?.company_name || 'Solar Installation Proposal'}</div>
          <div class="header-subtitle" style="color: ${headerSubtextColor};">${project?.name || 'Project'}</div>
        </div>
      </div>
      <div class="header-right">
        <span class="version-badge" style="background-color: ${primaryColor}; color: white;">v${proposal.version || 1}</span>
        <span class="page-number" style="color: ${headerSubtextColor};">Page ${tenants && tenants.length > 0 ? 5 : 4} of ${pageCount}</span>
      </div>
    </div>
    
    <div class="content">
      <div class="section-title" style="color: ${primaryColor};">System Specification</div>
      
      <table class="spec-table">
        <tbody>
          <tr>
            <td style="color: ${template.colors.textSecondary};">Solar Capacity</td>
            <td style="font-weight: 600;">${simulation?.solarCapacity || 0} kWp</td>
          </tr>
          <tr>
            <td style="color: ${template.colors.textSecondary};">Battery Capacity</td>
            <td style="font-weight: 600;">${simulation?.batteryCapacity || 0} kWh</td>
          </tr>
          <tr>
            <td style="color: ${template.colors.textSecondary};">Battery Power</td>
            <td style="font-weight: 600;">${simulation?.batteryPower || 0} kW</td>
          </tr>
          <tr>
            <td style="color: ${template.colors.textSecondary};">Annual Solar Generation</td>
            <td style="font-weight: 600;">${formatNumber(simulation?.annualSolarGeneration || 0)} kWh</td>
          </tr>
          <tr>
            <td style="color: ${template.colors.textSecondary};">Annual Grid Import</td>
            <td style="font-weight: 600;">${formatNumber(simulation?.annualGridImport || 0)} kWh</td>
          </tr>
          <tr>
            <td style="color: ${template.colors.textSecondary};">Annual Grid Export</td>
            <td style="font-weight: 600;">${formatNumber(simulation?.annualGridExport || 0)} kWh</td>
          </tr>
        </tbody>
      </table>
      
      <div class="section-title" style="color: ${primaryColor}; margin-top: 32px;">Financial Summary</div>
      
      <table class="spec-table">
        <tbody>
          <tr>
            <td style="color: ${template.colors.textSecondary};">System Cost</td>
            <td style="font-weight: 600;">${formatCurrency(simulation?.systemCost || 0)}</td>
          </tr>
          <tr>
            <td style="color: ${template.colors.textSecondary};">Year 1 Savings</td>
            <td style="font-weight: 600;">${formatCurrency(simulation?.annualSavings || 0)}</td>
          </tr>
          <tr>
            <td style="color: ${template.colors.textSecondary};">Payback Period</td>
            <td style="font-weight: 600;">${(simulation?.paybackYears || 0).toFixed(1)} years</td>
          </tr>
          <tr>
            <td style="color: ${template.colors.textSecondary};">25-Year ROI</td>
            <td style="font-weight: 600;">${(simulation?.roiPercentage || 0).toFixed(0)}%</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div class="footer" style="background-color: ${secondaryColor}; color: ${headerTextColor};">
      <div class="footer-content">
        ${branding?.contact_email ? `<span>${branding.contact_email}</span>` : ''}
        ${branding?.contact_email && branding?.contact_phone ? '<span>•</span>' : ''}
        ${branding?.contact_phone ? `<span>${branding.contact_phone}</span>` : ''}
        ${branding?.website ? '<span>•</span>' : ''}
        ${branding?.website ? `<span>${branding.website}</span>` : ''}
      </div>
    </div>
  </div>

  <!-- Financial Projection Page -->
  <div class="page">
    <div class="header" style="background-color: ${secondaryColor}; color: ${headerTextColor};">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="header-logo" />` : ''}
        <div>
          <div class="header-title">${branding?.company_name || 'Solar Installation Proposal'}</div>
          <div class="header-subtitle" style="color: ${headerSubtextColor};">${project?.name || 'Project'}</div>
        </div>
      </div>
      <div class="header-right">
        <span class="version-badge" style="background-color: ${primaryColor}; color: white;">v${proposal.version || 1}</span>
        <span class="page-number" style="color: ${headerSubtextColor};">Page ${tenants && tenants.length > 0 ? 6 : 5} of ${pageCount}</span>
      </div>
    </div>
    
    <div class="content">
      <div class="section-title" style="color: ${primaryColor};">25-Year Financial Projection</div>
      
      <table class="projection-table">
        <thead>
          <tr>
            <th>Year</th>
            <th class="right">Generation (kWh)</th>
            <th class="right">Annual Savings</th>
            <th class="right">Cumulative Savings</th>
            <th class="right">ROI</th>
          </tr>
        </thead>
        <tbody>
          ${projection.map(row => `
            <tr class="${row.year === paybackYear ? 'payback' : ''}" ${row.year === paybackYear ? `style="background-color: ${primaryColor}15;"` : ''}>
              <td>${row.year}${row.year === paybackYear ? ' ★' : ''}</td>
              <td class="right">${formatNumber(Math.round(row.generation))}</td>
              <td class="right">${formatCurrency(Math.round(row.savings))}</td>
              <td class="right">${formatCurrency(Math.round(row.cumulative))}</td>
              <td class="right">${row.roi.toFixed(0)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <p style="margin-top: 12px; font-size: 10px; color: ${template.colors.textSecondary};">
        ★ Indicates payback year. Projections assume 0.5% annual panel degradation and 8% annual tariff escalation.
      </p>
    </div>
    
    <div class="footer" style="background-color: ${secondaryColor}; color: ${headerTextColor};">
      <div class="footer-content">
        ${branding?.contact_email ? `<span>${branding.contact_email}</span>` : ''}
        ${branding?.contact_email && branding?.contact_phone ? '<span>•</span>' : ''}
        ${branding?.contact_phone ? `<span>${branding.contact_phone}</span>` : ''}
        ${branding?.website ? '<span>•</span>' : ''}
        ${branding?.website ? `<span>${branding.website}</span>` : ''}
      </div>
    </div>
  </div>

  <!-- Terms & Signatures Page -->
  <div class="page">
    <div class="header" style="background-color: ${secondaryColor}; color: ${headerTextColor};">
      <div class="header-left">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="header-logo" />` : ''}
        <div>
          <div class="header-title">${branding?.company_name || 'Solar Installation Proposal'}</div>
          <div class="header-subtitle" style="color: ${headerSubtextColor};">${project?.name || 'Project'}</div>
        </div>
      </div>
      <div class="header-right">
        <span class="version-badge" style="background-color: ${primaryColor}; color: white;">v${proposal.version || 1}</span>
        <span class="page-number" style="color: ${headerSubtextColor};">Page ${pageCount} of ${pageCount}</span>
      </div>
    </div>
    
    <div class="content">
      <div class="section-title" style="color: ${primaryColor};">Terms & Conditions</div>
      
      <div class="terms-section">
        <h4>Assumptions</h4>
        <p style="color: ${template.colors.textSecondary};">
          ${proposal.assumptions || 'Standard installation assumptions apply. System performance estimates are based on local irradiance data and typical meteorological year conditions.'}
        </p>
      </div>
      
      <div class="terms-section">
        <h4>Disclaimers</h4>
        <p style="color: ${template.colors.textSecondary};">
          ${proposal.disclaimers || 'This proposal is based on estimated consumption data and solar irradiance forecasts. Actual performance may vary based on weather conditions, equipment degradation, and other factors.'}
        </p>
      </div>
      
      ${proposal.custom_notes ? `
      <div class="terms-section">
        <h4>Additional Notes</h4>
        <p style="color: ${template.colors.textSecondary};">${proposal.custom_notes}</p>
      </div>
      ` : ''}
      
      <div class="signature-box">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
          <div>
            <div style="font-weight: 600; margin-bottom: 8px;">Prepared By</div>
            <div style="color: ${template.colors.textSecondary}; font-size: 11px;">${proposal.prepared_by || branding?.company_name || '—'}</div>
            <div class="signature-line">Signature & Date</div>
          </div>
          <div>
            <div style="font-weight: 600; margin-bottom: 8px;">Client Acceptance</div>
            <div style="color: ${template.colors.textSecondary}; font-size: 11px;">${project?.client_name || '—'}</div>
            <div class="signature-line">Signature & Date</div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="footer" style="background-color: ${secondaryColor}; color: ${headerTextColor};">
      <div class="footer-content">
        ${branding?.contact_email ? `<span>${branding.contact_email}</span>` : ''}
        ${branding?.contact_email && branding?.contact_phone ? '<span>•</span>' : ''}
        ${branding?.contact_phone ? `<span>${branding.contact_phone}</span>` : ''}
        ${branding?.website ? '<span>•</span>' : ''}
        ${branding?.website ? `<span>${branding.website}</span>` : ''}
      </div>
    </div>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Generate WYSIWYG PDF using standalone HTML generation
 */
export async function generateWYSIWYGPDF(
  options: CaptureOptions,
  filename: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');

    console.log('Generating proposal HTML...');
    const html = await generateProposalHTML(options);

    console.log(`Generated HTML size: ${(new Blob([html]).size / 1024).toFixed(1)} KB`);
    console.log('Sending to PDFShift...');
    
    const { data, error } = await supabase.functions.invoke('generate-pdf', {
      body: {
        type: 'proposal',
        html,
        filename,
        options: {
          landscape: false,
          format: 'A4',
          margin: '0',
        },
      },
    });

    if (error) {
      console.error('PDF generation error:', error);
      return { success: false, error: error.message };
    }

    if (!data.success) {
      console.error('PDF generation failed:', data.error);
      return { success: false, error: data.error };
    }

    // Convert base64 to blob and download
    const byteCharacters = atob(data.pdf);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });

    // Trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`PDF downloaded: ${filename}`);
    return { success: true };
  } catch (error) {
    console.error('PDF generation error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Legacy function for backward compatibility - now deprecated
export async function capturePreviewAsHTML(
  _previewElement: HTMLElement,
  _options: { title?: string; pageWidth?: string; pageMargin?: string } = {}
): Promise<string> {
  console.warn('capturePreviewAsHTML is deprecated. Use generateProposalHTML instead.');
  return '';
}
