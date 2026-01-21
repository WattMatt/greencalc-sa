// Sandbox Draft Report template for PDFShift
import { COLORS, wrapInDocument, formatCurrency, formatNumber } from './base';

export interface SandboxData {
  sandboxName: string;
  clonedFromProject?: string;
  scenarios: Array<{
    id: 'A' | 'B' | 'C';
    config: {
      solarCapacity: number;
      batteryCapacity: number;
      dcAcRatio: number;
    };
    results?: {
      annualGeneration: number;
      selfConsumption: number;
      systemCost: number;
      annualSavings: number;
      paybackYears: number;
    };
  }>;
}

export function generateSandboxHTML(data: SandboxData): string {
  const { sandboxName, clonedFromProject, scenarios } = data;
  const date = new Date().toLocaleString();

  let html = `
    <div class="draft-watermark">DRAFT</div>
    <div class="page">
      <div class="header-band" style="background: linear-gradient(135deg, ${COLORS.secondary}, #1e293b);">
        <h1>Draft Simulation Report</h1>
        <p style="opacity: 0.9;">⚠️ FOR INTERNAL REVIEW ONLY</p>
      </div>
      <div style="height: 4px; background: ${COLORS.warning}; margin: 0 -15mm 20px -15mm;"></div>
      
      <table style="margin-bottom: 20px;">
        <tr><td style="width: 120px;"><strong>Sandbox</strong></td><td>${sandboxName}</td></tr>
        <tr><td><strong>Source Project</strong></td><td>${clonedFromProject || 'Fresh sandbox'}</td></tr>
        <tr><td><strong>Generated</strong></td><td>${date}</td></tr>
      </table>
      
      <h2>Scenario Comparison</h2>
      
      ${scenarios.map(scenario => `
        <div style="margin: 15px 0; padding: 15px; background: ${COLORS.background}; border-radius: 6px; border-left: 4px solid ${
          scenario.id === 'A' ? COLORS.primary : 
          scenario.id === 'B' ? COLORS.accent : COLORS.warning
        };">
          <h3 style="margin-bottom: 10px;">Scenario ${scenario.id}</h3>
          
          <div class="grid grid-3" style="margin-bottom: 10px;">
            <div>
              <div class="text-xs text-muted">Solar Capacity</div>
              <div class="font-bold">${scenario.config.solarCapacity} kWp</div>
            </div>
            <div>
              <div class="text-xs text-muted">Battery Storage</div>
              <div class="font-bold">${scenario.config.batteryCapacity} kWh</div>
            </div>
            <div>
              <div class="text-xs text-muted">DC/AC Ratio</div>
              <div class="font-bold">${(scenario.config.dcAcRatio * 100).toFixed(0)}%</div>
            </div>
          </div>
          
          ${scenario.results ? `
            <div style="border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px;">
              <div class="text-sm font-semibold" style="margin-bottom: 8px;">Results</div>
              <div class="grid grid-2 gap-2">
                <div>Annual Generation: <strong>${formatNumber(scenario.results.annualGeneration)} kWh</strong></div>
                <div>Self-Consumption: <strong>${formatNumber(scenario.results.selfConsumption)} kWh</strong></div>
                <div>System Cost: <strong>${formatCurrency(scenario.results.systemCost)}</strong></div>
                <div>Annual Savings: <strong>${formatCurrency(scenario.results.annualSavings)}</strong></div>
                <div>Payback Period: <strong>${scenario.results.paybackYears.toFixed(1)} years</strong></div>
              </div>
            </div>
          ` : `
            <div class="text-muted text-sm" style="margin-top: 10px;">Results: Not yet calculated</div>
          `}
        </div>
      `).join('')}
      
      <div style="margin-top: 30px; padding: 15px; background: #fef3c7; border-radius: 6px;">
        <h3 style="color: ${COLORS.warning}; margin-bottom: 8px;">⚠️ Disclaimer</h3>
        <p class="text-sm">
          This is a DRAFT report generated from sandbox simulation. Figures are estimates only 
          and should not be used for final investment decisions without proper verification.
        </p>
      </div>
      
      <div class="page-footer">
        <span>SolarSim Pro - Sandbox Draft</span>
        <span>${date}</span>
      </div>
    </div>
  `;

  return wrapInDocument(html, `${sandboxName} - Draft Report`);
}
