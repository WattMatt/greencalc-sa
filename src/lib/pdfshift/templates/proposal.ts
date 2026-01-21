// Proposal template for PDFShift
import { COLORS, wrapInDocument, formatCurrency, formatNumber } from './base';

export interface ProposalData {
  proposal: {
    version?: number;
    executive_summary?: string;
    assumptions?: string;
    disclaimers?: string;
    prepared_by?: string;
    client_signature?: string;
  };
  project: {
    name?: string;
    location?: string;
    total_area_sqm?: number;
    connection_size_kva?: number;
  };
  simulation?: {
    solarCapacity: number;
    batteryCapacity: number;
    batteryPower: number;
    annualSolarGeneration: number;
    annualGridImport: number;
    annualGridExport: number;
    annualSavings: number;
    paybackYears: number;
    roiPercentage: number;
    systemCost: number;
    tariffName?: string;
  };
  branding?: {
    company_name?: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    contact_email?: string;
    contact_phone?: string;
    website?: string;
  };
  charts?: {
    payback?: string;
    energyFlow?: string;
    monthlyGeneration?: string;
  };
}

export function generateProposalHTML(data: ProposalData): string {
  const { proposal, project, simulation, branding, charts } = data;
  const primaryColor = branding?.primary_color || COLORS.primary;
  const secondaryColor = branding?.secondary_color || COLORS.secondary;
  const date = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

  // Generate 25-year projection
  const projection = simulation ? generateProjection(simulation) : [];

  let html = '';

  // ========== COVER PAGE ==========
  html += `
    <div class="page">
      <div class="header-band" style="background: ${secondaryColor};">
        <div class="flex-between">
          ${branding?.logo_url ? `<img src="${branding.logo_url}" style="height: 45px;" />` : ''}
          <div class="text-right">
            <div class="text-sm">Version ${proposal.version || 1}</div>
            <div class="text-xs">${date}</div>
          </div>
        </div>
        <h1 style="margin-top: 15px;">${branding?.company_name || 'Solar Proposal'}</h1>
        <p style="opacity: 0.9;">Prepared for: ${project?.name || 'Client'}</p>
      </div>
      <div style="height: 4px; background: ${primaryColor}; margin: 0 -15mm 20px -15mm;"></div>
      
      ${simulation ? `
        <!-- Key Metrics -->
        <div class="grid grid-4" style="margin: 25px 0;">
          <div style="text-align: center;">
            <div class="text-muted text-sm">System Size</div>
            <div style="font-size: 16pt; font-weight: 700; color: ${primaryColor};">${simulation.solarCapacity} kWp</div>
          </div>
          <div style="text-align: center;">
            <div class="text-muted text-sm">Annual Savings</div>
            <div style="font-size: 16pt; font-weight: 700; color: ${primaryColor};">${formatCurrency(simulation.annualSavings)}</div>
          </div>
          <div style="text-align: center;">
            <div class="text-muted text-sm">Payback</div>
            <div style="font-size: 16pt; font-weight: 700; color: ${primaryColor};">${simulation.paybackYears.toFixed(1)} years</div>
          </div>
          <div style="text-align: center;">
            <div class="text-muted text-sm">25-Year ROI</div>
            <div style="font-size: 16pt; font-weight: 700; color: ${primaryColor};">${simulation.roiPercentage.toFixed(0)}%</div>
          </div>
        </div>
      ` : ''}
      
      <!-- Executive Summary -->
      <h2>Executive Summary</h2>
      <p>${proposal.executive_summary || 
        `This proposal outlines a ${simulation?.solarCapacity || 0} kWp solar PV system installation for ${project?.name}. ` +
        `The system is projected to generate ${formatNumber(simulation?.annualSolarGeneration || 0)} kWh annually, ` +
        `resulting in estimated annual savings of ${formatCurrency(simulation?.annualSavings || 0)} ` +
        `with a payback period of ${(simulation?.paybackYears || 0).toFixed(1)} years.`}</p>
      
      <!-- Site Overview -->
      <h2 style="margin-top: 25px;">Site Overview</h2>
      <table>
        <tr><td style="width: 150px;"><strong>Location</strong></td><td>${project?.location || 'Not specified'}</td></tr>
        <tr><td><strong>Total Area</strong></td><td>${project?.total_area_sqm ? formatNumber(project.total_area_sqm) + ' m²' : '—'}</td></tr>
        <tr><td><strong>Connection Size</strong></td><td>${project?.connection_size_kva ? project.connection_size_kva + ' kVA' : '—'}</td></tr>
        <tr><td><strong>Tariff</strong></td><td>${simulation?.tariffName || 'Standard'}</td></tr>
      </table>
      
      <!-- System Specification -->
      <h2 style="margin-top: 25px;">System Specification</h2>
      <table>
        <tr><th colspan="2">Technical Details</th></tr>
        <tr><td><strong>Solar Capacity</strong></td><td>${simulation?.solarCapacity || 0} kWp</td></tr>
        <tr><td><strong>Battery Storage</strong></td><td>${simulation?.batteryCapacity || 0} kWh</td></tr>
        <tr><td><strong>Battery Power</strong></td><td>${simulation?.batteryPower || 0} kW</td></tr>
        <tr><td><strong>Annual Generation</strong></td><td>${formatNumber(simulation?.annualSolarGeneration || 0)} kWh/year</td></tr>
        <tr><td><strong>Grid Import (Annual)</strong></td><td>${formatNumber(simulation?.annualGridImport || 0)} kWh</td></tr>
        <tr><td><strong>Grid Export (Annual)</strong></td><td>${formatNumber(simulation?.annualGridExport || 0)} kWh</td></tr>
      </table>
      
      <div class="page-footer">
        <span>${[branding?.contact_email, branding?.contact_phone, branding?.website].filter(Boolean).join(' • ')}</span>
        <span>Page 1 of 3</span>
      </div>
    </div>
  `;

  // ========== CHARTS PAGE ==========
  if (charts && Object.values(charts).some(Boolean)) {
    html += `
      <div class="page">
        <h1>Visual Analysis</h1>
        ${charts.payback ? `<img src="${charts.payback}" style="width: 100%; margin: 15px 0;" />` : ''}
        ${(charts.energyFlow || charts.monthlyGeneration) ? `
          <div class="grid grid-2">
            ${charts.energyFlow ? `<img src="${charts.energyFlow}" style="width: 100%;" />` : ''}
            ${charts.monthlyGeneration ? `<img src="${charts.monthlyGeneration}" style="width: 100%;" />` : ''}
          </div>
        ` : ''}
        <div class="page-footer">
          <span>${branding?.company_name || ''}</span>
          <span>Page 2 of 3</span>
        </div>
      </div>
    `;
  }

  // ========== 25-YEAR PROJECTION ==========
  html += `
    <div class="page">
      <h1>25-Year Financial Projection</h1>
      <table>
        <tr>
          <th style="background: ${primaryColor};">Year</th>
          <th style="background: ${primaryColor};">Generation (kWh)</th>
          <th style="background: ${primaryColor};">Annual Savings</th>
          <th style="background: ${primaryColor};">Cumulative Savings</th>
          <th style="background: ${primaryColor};">ROI</th>
        </tr>
        ${projection.map(row => `
          <tr>
            <td>${row.year}</td>
            <td>${formatNumber(row.generation)}</td>
            <td>R ${formatNumber(row.savings)}</td>
            <td>R ${formatNumber(row.cumulative)}</td>
            <td>${row.roi.toFixed(1)}%</td>
          </tr>
        `).join('')}
      </table>
      
      <!-- Assumptions -->
      <h2 style="margin-top: 25px;">Assumptions</h2>
      <p class="text-sm">${proposal.assumptions || '• 0.5% annual panel degradation\n• 8% annual tariff escalation\n• Standard weather conditions'}</p>
      
      ${proposal.disclaimers ? `
        <h2 style="margin-top: 15px;">Disclaimers</h2>
        <p class="text-sm text-muted">${proposal.disclaimers}</p>
      ` : ''}
      
      <!-- Signatures -->
      <div class="grid grid-2" style="margin-top: 40px;">
        <div>
          <div class="signature-line"></div>
          <div class="text-sm">${proposal.prepared_by || ''}</div>
          <div class="text-xs text-muted">Prepared By</div>
        </div>
        <div class="text-right">
          <div class="signature-line" style="margin-left: auto;"></div>
          <div class="text-sm">${proposal.client_signature || ''}</div>
          <div class="text-xs text-muted">Client Signature</div>
        </div>
      </div>
      
      <div class="page-footer">
        <span>${branding?.company_name || ''}</span>
        <span>Page 3 of 3</span>
      </div>
    </div>
  `;

  return wrapInDocument(html, `Solar Proposal - ${project?.name || 'Client'}`);
}

function generateProjection(simulation: ProposalData['simulation']) {
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
      generation: Math.round(simulation.annualSolarGeneration * degradationFactor),
      savings: Math.round(yearSavings),
      cumulative: Math.round(cumulativeSavings),
      roi: ((cumulativeSavings - simulation.systemCost) / simulation.systemCost) * 100,
    });
  }
  return rows;
}
