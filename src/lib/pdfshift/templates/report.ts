// Report template for PDFShift
import { COLORS, wrapInDocument, formatCurrency, formatNumber } from './base';

export interface ReportData {
  reportName: string;
  projectName: string;
  simulationData: {
    solarCapacityKwp: number;
    batteryCapacityKwh: number;
    annualSavings: number;
    paybackYears: number;
    roiPercent: number;
    co2AvoidedTons: number;
    dcAcRatio: number;
  };
  projectDetails?: {
    location?: string;
    total_area_sqm?: number;
    connection_size_kva?: number;
    tariffs?: {
      name?: string;
      tariff_type?: string;
      municipalities?: { name?: string };
    };
  };
  branding?: {
    company_name?: string | null;
    logo_url?: string | null;
    primary_color?: string;
    contact_email?: string | null;
    contact_phone?: string | null;
    website?: string | null;
  };
  segments: Array<{ type: string; enabled: boolean; order: number }>;
  aiNarratives?: Record<string, { narrative: string }>;
}

const SEGMENT_TITLES: Record<string, string> = {
  executive_summary: "Executive Summary",
  dcac_comparison: "DC/AC Ratio Analysis",
  energy_flow: "Energy Flow Diagram",
  monthly_yield: "Monthly Yield Analysis",
  payback_timeline: "Financial Payback",
  sensitivity_analysis: "Sensitivity Analysis",
  savings_breakdown: "Savings Breakdown",
  environmental_impact: "Environmental Impact",
  engineering_specs: "Engineering Specifications",
  tariff_details: "Tariff Analysis",
  sizing_comparison: "Sizing Alternatives",
};

export function generateReportHTML(data: ReportData): string {
  const { reportName, projectName, simulationData, projectDetails, branding, segments, aiNarratives } = data;
  const enabledSegments = segments.filter(s => s.enabled).sort((a, b) => a.order - b.order);
  const date = new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });

  let html = '';

  // ========== COVER PAGE ==========
  html += `
    <div class="page">
      <div class="header-band">
        <div class="flex-between">
          ${branding?.logo_url ? `<img src="${branding.logo_url}" style="height: 50px;" />` : ''}
          <div class="text-right">
            <div class="text-sm">${date}</div>
          </div>
        </div>
        <h1 style="margin-top: 15px;">${projectName}</h1>
        <p style="opacity: 0.9;">Solar Energy Report</p>
      </div>
      <div class="header-band-accent"></div>
      
      <!-- Key Metrics -->
      <div class="grid grid-3" style="margin: 25px 0;">
        <div class="metric-card primary">
          <div class="metric-value">${simulationData.solarCapacityKwp}<span class="metric-unit"> kWp</span></div>
          <div class="metric-label">Solar Capacity</div>
        </div>
        <div class="metric-card accent">
          <div class="metric-value">${simulationData.batteryCapacityKwh}<span class="metric-unit"> kWh</span></div>
          <div class="metric-label">Battery Storage</div>
        </div>
        <div class="metric-card warning">
          <div class="metric-value">${formatCurrency(simulationData.annualSavings, true)}</div>
          <div class="metric-label">Annual Savings</div>
        </div>
      </div>
      
      <!-- ROI and Payback -->
      <div class="grid grid-2" style="margin: 20px 0;">
        <div style="padding: 20px; background: ${COLORS.background}; border-radius: 6px;">
          <div class="text-muted text-sm">Return on Investment</div>
          <div style="font-size: 32pt; font-weight: 700; color: ${COLORS.primary};">${Math.round(simulationData.roiPercent)}%</div>
        </div>
        <div style="padding: 20px; background: ${COLORS.background}; border-radius: 6px;">
          <div class="text-muted text-sm">Payback Period</div>
          <div style="font-size: 32pt; font-weight: 700; color: ${COLORS.primary};">${simulationData.paybackYears.toFixed(1)} yrs</div>
        </div>
      </div>
      
      <!-- Table of Contents -->
      <h3 style="margin-top: 30px;">Report Contents</h3>
      <table style="margin-top: 10px;">
        ${enabledSegments.map((seg, idx) => `
          <tr>
            <td style="width: 30px; color: ${COLORS.muted};">${String(idx + 1).padStart(2, '0')}</td>
            <td>${SEGMENT_TITLES[seg.type] || seg.type}</td>
            <td class="text-right text-muted">Page ${idx + 2}</td>
          </tr>
        `).join('')}
      </table>
      
      <div class="page-footer">
        <span>${branding?.company_name || 'SolarSim Pro'}</span>
        <span>Page 1 of ${enabledSegments.length + 1}</span>
      </div>
    </div>
  `;

  // ========== CONTENT PAGES ==========
  enabledSegments.forEach((segment, idx) => {
    const narrative = aiNarratives?.[segment.type]?.narrative;
    html += `
      <div class="page">
        <div class="section-header">${SEGMENT_TITLES[segment.type] || segment.type}</div>
        ${renderSegmentContent(segment.type, simulationData, projectDetails, narrative)}
        <div class="page-footer">
          <span>${branding?.company_name || 'SolarSim Pro'}</span>
          <span>Page ${idx + 2} of ${enabledSegments.length + 1}</span>
        </div>
      </div>
    `;
  });

  return wrapInDocument(html, reportName);
}

function renderNarrativeBox(narrative: string | undefined, title: string): string {
  if (!narrative) return '';
  return `
    <div class="narrative-box">
      <div class="narrative-header">
        <span class="narrative-title">${title}</span>
        <span class="ai-badge">AI-Generated</span>
      </div>
      <p>${narrative}</p>
    </div>
  `;
}

function renderSegmentContent(
  type: string,
  data: ReportData['simulationData'],
  projectDetails?: ReportData['projectDetails'],
  narrative?: string
): string {
  switch (type) {
    case 'executive_summary':
      return `
        ${renderNarrativeBox(narrative, 'Executive Summary')}
        <div class="grid grid-4" style="margin: 15px 0;">
          <div class="metric-card primary">
            <div class="metric-value">${data.solarCapacityKwp}</div>
            <div class="metric-unit">kWp</div>
            <div class="metric-label">Solar Capacity</div>
          </div>
          <div class="metric-card accent">
            <div class="metric-value">${data.batteryCapacityKwh}</div>
            <div class="metric-unit">kWh</div>
            <div class="metric-label">Battery Storage</div>
          </div>
          <div class="metric-card warning">
            <div class="metric-value">${formatCurrency(data.annualSavings / 1000)}k</div>
            <div class="metric-unit">/year</div>
            <div class="metric-label">Annual Savings</div>
          </div>
          <div class="metric-card" style="background: ${COLORS.primaryDark}; color: white;">
            <div class="metric-value">${data.paybackYears.toFixed(1)}</div>
            <div class="metric-unit">years</div>
            <div class="metric-label">Payback Period</div>
          </div>
        </div>
        ${projectDetails ? `
          <table style="margin-top: 20px;">
            <tr><th colspan="2">Project Details</th></tr>
            ${projectDetails.location ? `<tr><td><strong>Location</strong></td><td>${projectDetails.location}</td></tr>` : ''}
            ${projectDetails.total_area_sqm ? `<tr><td><strong>Building Area</strong></td><td>${formatNumber(projectDetails.total_area_sqm)} m²</td></tr>` : ''}
            ${projectDetails.connection_size_kva ? `<tr><td><strong>Grid Connection</strong></td><td>${projectDetails.connection_size_kva} kVA</td></tr>` : ''}
            ${projectDetails.tariffs?.name ? `<tr><td><strong>Tariff</strong></td><td>${projectDetails.tariffs.name}</td></tr>` : ''}
            ${data.dcAcRatio ? `<tr><td><strong>DC/AC Ratio</strong></td><td>${data.dcAcRatio.toFixed(2)}:1</td></tr>` : ''}
          </table>
        ` : ''}
      `;

    case 'tariff_details':
      return `
        ${renderNarrativeBox(narrative, 'Tariff Overview')}
        <h3>Time-of-Use Rate Periods (Weekday)</h3>
        <div class="grid grid-3" style="margin: 15px 0;">
          <div class="tou-card tou-peak">
            <div class="font-bold">Peak</div>
            <div class="text-sm">06:00-08:00, 18:00-21:00</div>
            <div class="text-xs">Highest rates</div>
          </div>
          <div class="tou-card tou-standard">
            <div class="font-bold">Standard</div>
            <div class="text-sm">08:00-18:00, 21:00-22:00</div>
            <div class="text-xs">Mid-tier rates</div>
          </div>
          <div class="tou-card tou-offpeak">
            <div class="font-bold">Off-Peak</div>
            <div class="text-sm">22:00-06:00</div>
            <div class="text-xs">Lowest rates</div>
          </div>
        </div>
        <h3 style="margin-top: 20px;">Seasonal Calendar</h3>
        <div class="month-grid">
          ${['J','F','M','A','M','J','J','A','S','O','N','D'].map((m, i) => 
            `<div class="month-cell ${i >= 5 && i <= 7 ? 'month-high' : 'month-low'}">${m}</div>`
          ).join('')}
        </div>
        <div style="margin-top: 10px; font-size: 8pt; color: ${COLORS.muted};">
          <span style="display: inline-block; width: 12px; height: 8px; background: ${COLORS.danger}; margin-right: 5px;"></span> High Demand (Winter)
          <span style="display: inline-block; width: 12px; height: 8px; background: ${COLORS.primary}; margin-left: 20px; margin-right: 5px;"></span> Low Demand (Summer)
        </div>
      `;

    case 'dcac_comparison':
      const calcYield = (r: number) => Math.round((1 + (r - 1) * 0.6) * 100);
      const ratio = data.dcAcRatio || 1.3;
      return `
        ${renderNarrativeBox(narrative, 'DC/AC Analysis Overview')}
        <h3>DC/AC Oversizing Comparison</h3>
        <div class="grid grid-3" style="margin: 15px 0;">
          <div class="metric-card">
            <div class="metric-value" style="color: ${COLORS.muted};">1.00:1</div>
            <div class="metric-label">Conservative</div>
            <div style="margin-top: 10px; font-size: 12pt; color: ${COLORS.muted};">${calcYield(1.0)}% yield</div>
          </div>
          <div class="metric-card primary">
            <div class="metric-value">${ratio.toFixed(2)}:1</div>
            <div class="metric-label">Current Design</div>
            <div style="margin-top: 10px; font-size: 12pt;">${calcYield(ratio)}% yield</div>
          </div>
          <div class="metric-card" style="background: ${COLORS.warning}; color: white;">
            <div class="metric-value">1.50:1</div>
            <div class="metric-label">Aggressive</div>
            <div style="margin-top: 10px; font-size: 12pt;">${calcYield(1.5)}% yield</div>
          </div>
        </div>
        <p class="text-muted text-sm" style="margin-top: 15px;">
          Higher DC/AC ratios increase energy harvest during low-light conditions but may result in clipping during peak sun hours.
        </p>
      `;

    case 'environmental_impact':
      return `
        ${renderNarrativeBox(narrative, 'Environmental Impact Overview')}
        <div class="grid grid-2" style="margin: 20px 0;">
          <div class="metric-card primary" style="padding: 25px;">
            <div class="metric-value" style="font-size: 36pt;">${data.co2AvoidedTons.toFixed(1)}</div>
            <div class="metric-unit">tons CO₂ avoided per year</div>
          </div>
          <div>
            <h3>Environmental Equivalents</h3>
            <table>
              <tr><td>🌳 Trees equivalent</td><td class="text-right font-bold">${Math.round(data.co2AvoidedTons * 16.5)} trees</td></tr>
              <tr><td>🚗 Cars off road</td><td class="text-right font-bold">${(data.co2AvoidedTons / 4.6).toFixed(1)} cars/year</td></tr>
              <tr><td>🏠 Homes powered</td><td class="text-right font-bold">${Math.round(data.solarCapacityKwp * 1.5)} homes</td></tr>
            </table>
          </div>
        </div>
      `;

    case 'payback_timeline':
      return `
        ${renderNarrativeBox(narrative, 'Financial Overview')}
        <div class="grid grid-3" style="margin: 20px 0;">
          <div class="metric-card primary">
            <div class="metric-value">${data.paybackYears.toFixed(1)}</div>
            <div class="metric-unit">years</div>
            <div class="metric-label">Payback Period</div>
          </div>
          <div class="metric-card accent">
            <div class="metric-value">${Math.round(data.roiPercent)}%</div>
            <div class="metric-label">20-Year ROI</div>
          </div>
          <div class="metric-card warning">
            <div class="metric-value">${formatCurrency(data.annualSavings, true)}</div>
            <div class="metric-label">Annual Savings</div>
          </div>
        </div>
      `;

    case 'engineering_specs':
      return `
        ${renderNarrativeBox(narrative, 'Technical Specifications')}
        <table>
          <tr><th colspan="2">System Configuration</th></tr>
          <tr><td><strong>Solar Array</strong></td><td>${data.solarCapacityKwp} kWp</td></tr>
          <tr><td><strong>Battery Storage</strong></td><td>${data.batteryCapacityKwh} kWh</td></tr>
          <tr><td><strong>DC/AC Ratio</strong></td><td>${data.dcAcRatio.toFixed(2)}:1</td></tr>
          <tr><td><strong>Estimated Annual Yield</strong></td><td>${formatNumber(data.solarCapacityKwp * 1650)} kWh</td></tr>
        </table>
      `;

    default:
      return `<p>Content for ${type}</p>`;
  }
}
