/**
 * Reusable LaTeX snippet generators for each proposal content block.
 */
import { SimulationData, ProposalBranding, Proposal } from "@/components/proposals/types";

// Escape special LaTeX characters
export function esc(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[&%$#_{}~^]/g, (m) => `\\${m}`);
}

function currency(value: number): string {
  return `R\\,${value.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function num(value: number, decimals = 0): string {
  return value.toLocaleString("en-ZA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ────────────────────── Cover Page ──────────────────────

export function coverPage(
  branding: ProposalBranding,
  project: any,
  simulation: SimulationData,
  proposal: Partial<Proposal>
): string {
  return `
\\begin{titlepage}
\\begin{center}

\\vspace*{2cm}

{\\Huge\\bfseries\\color{brandprimary} Solar Energy Proposal}

\\vspace{0.5cm}

{\\Large\\color{gray} ${esc(project?.name || "Project")}}

\\vspace{2cm}

\\begin{tabular}{rl}
\\textbf{System Size:} & ${num(simulation.solarCapacity)} kWp \\\\
\\textbf{Annual Generation:} & ${num(simulation.annualSolarGeneration)} kWh \\\\
\\textbf{Annual Savings:} & ${currency(simulation.annualSavings)} \\\\
\\textbf{Payback Period:} & ${num(simulation.paybackYears, 1)} years \\\\
\\end{tabular}

\\vspace{2cm}

${branding.company_name ? `{\\Large\\bfseries ${esc(branding.company_name)}}\\\\[0.3cm]` : ""}
${branding.contact_email ? `${esc(branding.contact_email)}\\\\` : ""}
${branding.contact_phone ? `${esc(branding.contact_phone)}\\\\` : ""}
${branding.website ? `${esc(branding.website)}\\\\` : ""}

\\vfill

{\\small Version ${proposal.version || 1} \\quad|\\quad \\today}

\\end{center}
\\end{titlepage}
`;
}

// ────────────────────── Executive Summary ──────────────────────

export function executiveSummary(
  simulation: SimulationData,
  project: any
): string {
  return `
\\section{Executive Summary}

This proposal outlines a ${num(simulation.solarCapacity)} kWp solar photovoltaic system${simulation.batteryCapacity > 0 ? ` with ${num(simulation.batteryCapacity)} kWh battery storage` : ""} for ${esc(project?.name || "the project")}${simulation.location ? `, located at ${esc(simulation.location)}` : ""}.

The proposed system is expected to generate approximately ${num(simulation.annualSolarGeneration)} kWh of clean energy annually, resulting in estimated savings of ${currency(simulation.annualSavings)} per year. The investment of ${currency(simulation.systemCost)} is projected to achieve payback within ${num(simulation.paybackYears, 1)} years, delivering a return on investment of ${num(simulation.roiPercentage, 1)}\\%.

${simulation.npv ? `The Net Present Value (NPV) of the project is ${currency(simulation.npv)}, ` : ""}${simulation.irr ? `with an Internal Rate of Return (IRR) of ${num(simulation.irr, 1)}\\%.` : ""}
`;
}

// ────────────────────── Site Overview ──────────────────────

export function siteOverview(
  project: any,
  simulation: SimulationData,
  tariffName?: string
): string {
  return `
\\section{Site Overview}

\\begin{tabularx}{\\textwidth}{lX}
\\toprule
\\textbf{Parameter} & \\textbf{Value} \\\\
\\midrule
Project Name & ${esc(project?.name)} \\\\
Client & ${esc(project?.client_name)} \\\\
Location & ${esc(project?.location || simulation.location)} \\\\
${project?.latitude ? `Coordinates & ${project.latitude.toFixed(4)}, ${project.longitude?.toFixed(4)} \\\\` : ""}
${project?.total_area_sqm ? `Total Area & ${num(project.total_area_sqm)} m\\textsuperscript{2} \\\\` : ""}
${tariffName ? `Tariff & ${esc(tariffName)} \\\\` : ""}
${project?.connection_size_kva ? `Connection Size & ${num(project.connection_size_kva)} kVA \\\\` : ""}
\\bottomrule
\\end{tabularx}
`;
}

// ────────────────────── Equipment Specifications ──────────────────────

export function equipmentSpecs(simulation: SimulationData): string {
  const specs = simulation.equipmentSpecs;
  return `
\\section{Equipment Specifications}

\\subsection{Solar Panels}
\\begin{tabularx}{\\textwidth}{lX}
\\toprule
\\textbf{Parameter} & \\textbf{Value} \\\\
\\midrule
Total Capacity & ${num(simulation.solarCapacity)} kWp \\\\
${specs?.panelModel ? `Panel Model & ${esc(specs.panelModel)} \\\\` : ""}
${specs?.panelWattage ? `Panel Wattage & ${num(specs.panelWattage)} W \\\\` : ""}
${specs?.panelCount ? `Number of Panels & ${num(specs.panelCount)} \\\\` : ""}
${specs?.panelEfficiency ? `Panel Efficiency & ${num(specs.panelEfficiency, 1)}\\% \\\\` : ""}
${specs?.tiltAngle != null ? `Tilt Angle & ${num(specs.tiltAngle)}\\textdegree \\\\` : ""}
${specs?.azimuth != null ? `Azimuth & ${num(specs.azimuth)}\\textdegree \\\\` : ""}
\\bottomrule
\\end{tabularx}

${simulation.batteryCapacity > 0 ? `
\\subsection{Battery Storage}
\\begin{tabularx}{\\textwidth}{lX}
\\toprule
\\textbf{Parameter} & \\textbf{Value} \\\\
\\midrule
Capacity & ${num(simulation.batteryCapacity)} kWh \\\\
Power & ${num(simulation.batteryPower)} kW \\\\
${specs?.batteryModel ? `Model & ${esc(specs.batteryModel)} \\\\` : ""}
\\bottomrule
\\end{tabularx}
` : ""}
`;
}

// ────────────────────── Load Analysis ──────────────────────

export function loadAnalysis(
  simulation: SimulationData,
  tenants: any[],
  project: any
): string {
  const tenantRows = tenants.map(t => {
    const area = t.area_sqm || 0;
    const type = t.shop_types?.name || "—";
    const kwh = t.monthly_kwh_override || (t.shop_types?.kwh_per_sqm_month || 0) * area;
    return `${esc(t.name)} & ${esc(type)} & ${num(area)} & ${num(kwh)} \\\\`;
  }).join("\n");

  return `
\\section{Load Analysis}

${tenants.length > 0 ? `
\\begin{tabularx}{\\textwidth}{lXrr}
\\toprule
\\textbf{Tenant} & \\textbf{Type} & \\textbf{Area (m²)} & \\textbf{Monthly kWh} \\\\
\\midrule
${tenantRows}
\\bottomrule
\\end{tabularx}
` : "No tenant data available."}
`;
}

// ────────────────────── Financial Summary ──────────────────────

export function financialSummary(simulation: SimulationData): string {
  return `
\\section{Financial Summary}

\\begin{tabularx}{\\textwidth}{lX}
\\toprule
\\textbf{Metric} & \\textbf{Value} \\\\
\\midrule
System Cost & ${currency(simulation.systemCost)} \\\\
Annual Savings & ${currency(simulation.annualSavings)} \\\\
Payback Period & ${num(simulation.paybackYears, 1)} years \\\\
ROI & ${num(simulation.roiPercentage, 1)}\\% \\\\
${simulation.npv ? `Net Present Value (NPV) & ${currency(simulation.npv)} \\\\` : ""}
${simulation.irr ? `Internal Rate of Return (IRR) & ${num(simulation.irr, 1)}\\% \\\\` : ""}
${simulation.lcoe ? `LCOE & R\\,${simulation.lcoe.toFixed(2)}/kWh \\\\` : ""}
${simulation.co2Avoided ? `CO\\textsubscript{2} Avoided & ${num(simulation.co2Avoided)} tonnes/year \\\\` : ""}
\\bottomrule
\\end{tabularx}
`;
}

// ────────────────────── Cashflow Table ──────────────────────

export function cashflowTable(simulation: SimulationData): string {
  if (!simulation.yearlyProjections || simulation.yearlyProjections.length === 0) {
    return `
\\section{20-Year Cashflow Projection}

Detailed yearly projections are not available for this simulation.
`;
  }

  const rows = simulation.yearlyProjections.map(y =>
    `${y.year} & ${num(y.energyYield)} & ${currency(y.totalIncome)} & ${currency(y.totalCost)} & ${currency(y.netCashflow)} & ${currency(y.cumulativeCashflow)} \\\\`
  ).join("\n");

  return `
\\section{20-Year Cashflow Projection}

{\\small
\\begin{tabularx}{\\textwidth}{rrrrrr}
\\toprule
\\textbf{Year} & \\textbf{Yield (kWh)} & \\textbf{Income} & \\textbf{Costs} & \\textbf{Net} & \\textbf{Cumulative} \\\\
\\midrule
${rows}
\\bottomrule
\\end{tabularx}
}
`;
}

// ────────────────────── Sensitivity Analysis ──────────────────────

export function sensitivityAnalysis(simulation: SimulationData): string {
  if (!simulation.sensitivityResults) {
    return `
\\section{Sensitivity Analysis}

Sensitivity analysis data is not available for this simulation.
`;
  }

  const s = simulation.sensitivityResults;
  return `
\\section{Sensitivity Analysis}

\\begin{tabularx}{\\textwidth}{lXXX}
\\toprule
\\textbf{Scenario} & \\textbf{NPV} & \\textbf{IRR} & \\textbf{Payback} \\\\
\\midrule
Best Case & ${currency(s.bestCase.npv)} & ${num(s.bestCase.irr, 1)}\\% & ${num(s.bestCase.payback, 1)} yrs \\\\
Base Case & ${simulation.npv ? currency(simulation.npv) : "—"} & ${simulation.irr ? `${num(simulation.irr, 1)}\\%` : "—"} & ${num(simulation.paybackYears, 1)} yrs \\\\
Worst Case & ${currency(s.worstCase.npv)} & ${num(s.worstCase.irr, 1)}\\% & ${num(s.worstCase.payback, 1)} yrs \\\\
\\bottomrule
\\end{tabularx}

\\textbf{Best Case:} ${esc(s.bestCase.assumptions)}

\\textbf{Worst Case:} ${esc(s.worstCase.assumptions)}
`;
}

// ────────────────────── Terms & Conditions ──────────────────────

export function termsAndConditions(proposal: Partial<Proposal>): string {
  return `
\\section{Terms \\& Conditions}

\\subsection{Assumptions}
${esc(proposal.assumptions) || "Standard industry assumptions apply."}

\\subsection{Disclaimers}
${esc(proposal.disclaimers) || "This proposal is based on estimated data. Actual performance may vary."}

${proposal.custom_notes ? `
\\subsection{Additional Notes}
${esc(proposal.custom_notes)}
` : ""}
`;
}

// ────────────────────── Signature Block ──────────────────────

export function signatureBlock(proposal: Partial<Proposal>, branding: ProposalBranding): string {
  return `
\\section{Authorization}

\\vspace{1cm}

\\begin{tabularx}{\\textwidth}{XX}
\\textbf{Prepared by:} & \\textbf{Client Acceptance:} \\\\[1cm]
\\rule{6cm}{0.4pt} & \\rule{6cm}{0.4pt} \\\\
${esc(branding.company_name)} & Name \\\\[1cm]
\\rule{6cm}{0.4pt} & \\rule{6cm}{0.4pt} \\\\
Date & Date \\\\
\\end{tabularx}
`;
}
