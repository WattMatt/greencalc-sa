/**
 * Reusable LaTeX snippet generators for each proposal content block.
 * Matches the Financial Analysis report layout.
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

// Load shedding stage yield reduction factors (fraction of Stage 0 yield)
const LOAD_SHEDDING_FACTORS = [1.0, 0.9287, 0.8348, 0.7363, 0.6270, 0.5389, 0.5134, 0.4476, 0.3829];

function getStageYield(baseYield: number, stage: number): number {
  return baseYield * (LOAD_SHEDDING_FACTORS[stage] ?? 1.0);
}

// ────────────────────── Cover Page ──────────────────────

export function coverPage(
  branding: ProposalBranding,
  project: any,
  simulation: SimulationData,
  proposal: Partial<Proposal>
): string {
  const acCapacity = simulation.solarCapacity;
  return `
\\begin{titlepage}
\\begin{center}

\\vspace*{2cm}

{\\Huge \\textbf{${esc(project?.name || "PROJECT")}}}\\\\[1cm]
{\\Huge \\textbf{SOLAR PV INSTALLATION}}\\\\[0.5cm]
{\\Large Financial Analysis}\\\\[0.5cm]
{\\Large ${num(acCapacity)} KWAC}\\\\[3cm]

\\textbf{PREPARED BY:}\\\\[0.5cm]
${branding.company_name ? `\\textbf{${esc(branding.company_name)}}\\\\` : ""}
${branding.address ? `${esc(branding.address)}\\\\` : ""}
${branding.contact_phone ? `Tel: ${esc(branding.contact_phone)}\\\\` : ""}
${branding.contact_email ? `Email: ${esc(branding.contact_email)}\\\\` : ""}

\\vspace{2cm}

\\begin{tabular}{|l|l|}
\\hline
\\textbf{DATE:} & \\today \\\\
\\hline
\\textbf{REVISION:} & Rev ${String(proposal.version || 1).padStart(3, "0")} \\\\
\\hline
\\textbf{AUTHOR:} & ${esc(proposal.prepared_by || "")} \\\\
\\hline
\\end{tabular}

\\end{center}
\\end{titlepage}
`;
}

// ────────────────────── Table of Contents ──────────────────────

export function tableOfContents(): string {
  return `
\\section*{Table of Contents}
\\tableofcontents
\\newpage
`;
}

// ────────────────────── Administrative Details ──────────────────────

export function administrativeDetails(project: any, simulation: SimulationData): string {
  return `
\\section{Administrative Details}
\\textbf{Location:} ${esc(project?.location || simulation.location || "—")}

${project?.client_name ? `\\textbf{Client:} ${esc(project.client_name)}` : ""}
`;
}

// ────────────────────── Introduction ──────────────────────

export function introduction(simulation: SimulationData, project: any): string {
  const acCap = simulation.solarCapacity;
  const hasBattery = simulation.batteryCapacity > 0;
  return `
\\section{Introduction}
This report will estimate the electrical yield, relevant costs, and returns for the proposed ${num(acCap)} kWp AC Solar PV System${hasBattery ? ` with ${num(simulation.batteryCapacity)} kWh battery storage` : ""}. This system will be installed on all possible roofs with the possibility to add additional solar modules at a later date.
`;
}

// ────────────────────── Background & Methodology ──────────────────────

export function backgroundMethodology(simulation: SimulationData, project: any): string {
  const tariffRate = simulation.yearlyProjections?.[0]?.energyRate ?? 0;
  const demandRate = simulation.yearlyProjections?.[0]?.demandRate ?? 0;
  const insuranceCost = simulation.yearlyProjections?.[0]?.insurance ?? 0;
  const replacementCost = simulation.yearlyProjections?.find(y => y.replacementCost > 0)?.replacementCost ?? 0;

  return `
\\section{Background and Methodology}
The following assumptions were made to estimate the proposed solar PV system's electrical yield, relevant costs, and returns.

\\begin{enumerate}
\\item An extrapolation of a previously designed and installed solar PV plant was used to determine this plant's yield guarantees.
\\item The latest available Tariff for the local authority is as follows:
\\end{enumerate}

\\begin{table}[h!]
\\centering
\\begin{tabular}{|l|c|c|c|}
\\hline
\\textbf{TIME OF USE} & \\textbf{High Demand} & \\textbf{Low Demand} & \\textbf{Annual Blended} \\\\
\\textbf{Solar Sun Hours} & \\textbf{JUN-AUG} & \\textbf{SEP-MAY} & \\textbf{Tariff} \\\\ \\hline
Blended & ${currency(tariffRate)} & ${currency(tariffRate)} & ${currency(tariffRate)} \\\\ \\hline
\\textbf{KVA Demand Charge} & & & \\textbf{${currency(demandRate)}} \\\\ \\hline
\\end{tabular}
\\end{table}

\\begin{enumerate}
\\setcounter{enumi}{2}
\\item A Capital Cost (interest rate) of 9.00\\% per annum was assumed.
\\item Based on current NERSA Tariff hikes, a 10\\% per annum annual escalation on electricity prices was also factored in.
\\item An allowance has been made for 10-year mid-life repairs, where some PV equipment will be replaced.
\\item Further inputs are as follows:
\\end{enumerate}

\\begin{table}[h!]
\\centering
\\begin{tabular}{|l|r|l|r|}
\\hline
\\multicolumn{4}{|c|}{\\textbf{FINANCIAL RETURN INPUTS}} \\\\ \\hline
Cost of Capital & 9.00\\% & Blended Tariff Yr 1 & ${currency(tariffRate)} \\\\ \\hline
CPI & 6.00\\% & Electricity kVA cost Year 1 & ${currency(demandRate)} \\\\ \\hline
Electricity Inflation & 10.00\\% & & \\\\ \\hline
Project Duration (yr) & 20 & Insurance Cost Year 1 & ${currency(insuranceCost)} \\\\ \\hline
Adjusted Discount Rate & 15.00\\% & Replacement Cost At Year 10 & ${currency(replacementCost)} \\\\ \\hline
Cost of Capital (LCOE) & 9.00\\% & & \\\\ \\hline
MIRR - Finance rate & 9.00\\% & & \\\\ \\hline
MIRR - Re-investment rate & 10.00\\% & & \\\\ \\hline
\\end{tabular}
\\end{table}
`;
}

// ────────────────────── Tender Return Data ──────────────────────

export function tenderReturnData(simulation: SimulationData, project: any): string {
  const specs = simulation.equipmentSpecs;
  const baseYield = simulation.annualSolarGeneration;
  const dcCapacity = specs?.panelWattage && specs?.panelCount
    ? (specs.panelWattage * specs.panelCount / 1000)
    : simulation.solarCapacity * 1.33;
  const panelArea = specs?.panelCount ? specs.panelCount * 2.7 : 0;
  const lifespanYield = simulation.yearlyProjections
    ? simulation.yearlyProjections.reduce((sum, y) => sum + y.energyYield, 0)
    : baseYield * 20;
  const oAndMYear1 = simulation.yearlyProjections?.[0]?.oAndM ?? 0;

  const stageRows = LOAD_SHEDDING_FACTORS.map((_, i) => {
    const y = getStageYield(baseYield, i);
    return i < 5
      ? `STAGE ${i} & ${num(y, 2)}`
      : `STAGE ${i} & ${num(y, 2)}`;
  });

  // Build two-column load shedding table
  const leftCol = stageRows.slice(0, 5);
  const rightCol = stageRows.slice(5);
  const lsRows = leftCol.map((l, i) => {
    const r = rightCol[i] ? rightCol[i] : " & ";
    return `${l} & ${r} \\\\ \\hline`;
  }).join("\n");

  return `
\\section{Tender Return Data}

\\begin{table}[h!]
\\centering
\\small
\\begin{tabular}{|l|r|}
\\hline
\\textbf{TENDER RETURN DATA INPUTS} & \\textbf{Value} \\\\ \\hline
Total Capital Cost of Project & ${currency(simulation.systemCost)} \\\\ \\hline
Energy Yield Year 1 (kWh) & ${num(baseYield, 2)} \\\\ \\hline
KVA Saving in Year 1 (kVA) & ${num(simulation.demandSavingKva ?? 0, 2)} \\\\ \\hline
Energy Yield over Lifespan (kWh) & ${num(lifespanYield, 2)} \\\\ \\hline
O\\&M Cost Year 1 (ZAR) & ${currency(oAndMYear1)} \\\\ \\hline
${specs?.panelCount ? `Number of Panels (\\#) & ${num(specs.panelCount, 0)} \\\\ \\hline` : ""}
${panelArea > 0 ? `Area Covered by PV Panels (m\\textsuperscript{2}) & ${num(panelArea, 2)} \\\\ \\hline` : ""}
Lifespan (yr) & 20 \\\\ \\hline
kWp (DC) & ${num(dcCapacity, 0)} \\\\ \\hline
kWp (AC) & ${num(simulation.solarCapacity, 0)} \\\\ \\hline
${specs?.panelEfficiency ? `Module Efficiency (\\%) & ${num(specs.panelEfficiency, 2)}\\% \\\\ \\hline` : ""}
\\end{tabular}
\\end{table}

\\textbf{LOAD SHEDDING IMPACT}

\\begin{table}[h!]
\\centering
\\begin{tabular}{|l|r|l|r|}
\\hline
\\textbf{LOAD SHEDDING} & \\textbf{KWH/ANNUM} & \\textbf{LOAD SHEDDING} & \\textbf{KWH/ANNUM} \\\\ \\hline
${lsRows}
\\end{tabular}
\\end{table}
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
\\textbf{Tenant} & \\textbf{Type} & \\textbf{Area (m\\textsuperscript{2})} & \\textbf{Monthly kWh} \\\\
\\midrule
${tenantRows}
\\bottomrule
\\end{tabularx}
` : "No tenant data available."}
`;
}

// ────────────────────── Financial Estimates ──────────────────────

export function financialEstimates(simulation: SimulationData): string {
  const baseYield = simulation.annualSolarGeneration;
  const cost = simulation.systemCost;
  const dcCap = simulation.equipmentSpecs?.panelWattage && simulation.equipmentSpecs?.panelCount
    ? (simulation.equipmentSpecs.panelWattage * simulation.equipmentSpecs.panelCount / 1000)
    : simulation.solarCapacity * 1.33;
  const acCap = simulation.solarCapacity;

  // Calculate per-stage metrics (simplified linear scaling from base)
  function stageMetrics(stage: number) {
    const factor = LOAD_SHEDDING_FACTORS[stage] ?? 1.0;
    const yld = baseYield * factor;
    const zarPerKwh = cost / yld;
    const zarPerWpDc = cost / (dcCap * 1000) * 1000;
    const zarPerWpAc = cost / (acCap * 1000) * 1000;
    const lcoe = (simulation.lcoe ?? 0) / factor;
    const initialYield = (simulation.annualSavings / cost * 100) * factor;
    const irr = (simulation.irr ?? 0) * factor;
    const mirr = (simulation.mirr ?? 0) * factor;
    const payback = simulation.paybackYears / factor;
    const npv = (simulation.npv ?? 0) * factor;
    return { zarPerKwh, zarPerWpDc, zarPerWpAc, lcoe, initialYield, irr, mirr, payback, npv };
  }

  function fmtRow(label: string, stages: number[], getter: (m: ReturnType<typeof stageMetrics>) => string) {
    const cells = stages.map(s => getter(stageMetrics(s))).join(" & ");
    return `${label} & ${cells} \\\\ \\hline`;
  }

  const stagesA = [0, 1, 2, 3, 4];
  const stagesB = [5, 6, 7, 8];

  function makeTable(stages: number[], header: string) {
    const colSpec = stages.map(() => "r").join("|");
    const headerCells = stages.map(s => `\\textbf{STAGE ${s}}`).join(" & ");
    return `
\\begin{table}[h!]
\\centering
\\small
\\begin{tabular}{|l|${colSpec}|}
\\hline
\\textbf{${header}} & ${headerCells} \\\\ \\hline
${fmtRow("ZAR/kWh (1st Year)", stages, m => num(m.zarPerKwh, 2))}
${fmtRow("ZAR/Wp (DC)", stages, m => num(m.zarPerWpDc, 2))}
${fmtRow("ZAR/Wp (AC)", stages, m => num(m.zarPerWpAc, 2))}
${fmtRow("LCOE (ZAR/kWh)", stages, m => num(m.lcoe, 2))}
${fmtRow("Initial Yield", stages, m => `${num(m.initialYield, 2)}\\%`)}
${fmtRow("IRR", stages, m => `${num(m.irr, 2)}\\%`)}
${fmtRow("MIRR", stages, m => `${num(m.mirr, 2)}\\%`)}
${fmtRow("Payback Period", stages, m => num(m.payback, 2))}
${fmtRow("NPV", stages, m => currency(m.npv))}
\\end{tabular}
\\end{table}
`;
  }

  return `
\\section{Financial Estimates}
Based on the inputs above, the various stages of load shedding and their impact have been applied to the energy yield of year 1. Taking this into account, the following financial returns have been calculated for each stage:

${makeTable(stagesA, "FINANCIAL OUTPUTS")}

${makeTable(stagesB, "FINANCIAL OUTPUTS")}

The Net Present Value was calculated using the Cost Of Capital, a 9.00\\% per annum interest rate.
`;
}

// ────────────────────── Financial Conclusion ──────────────────────

export function financialConclusion(simulation: SimulationData): string {
  const factor = LOAD_SHEDDING_FACTORS[2]; // Stage 2 baseline
  const initialYield = (simulation.annualSavings / simulation.systemCost * 100) * factor;
  const irr = (simulation.irr ?? 0) * factor;
  const mirr = (simulation.mirr ?? 0) * factor;
  const payback = simulation.paybackYears / factor;
  const paybackYears = Math.floor(payback);
  const paybackMonths = Math.round((payback - paybackYears) * 12);

  return `
\\section{Financial Conclusion}
From the above load shedding scenarios, we are of the opinion that a load shedding baseline of \\textbf{Stage 2} should be used as a conservative view of the plant's yield. As a result, the following metrics should be considered for this project's financial viability:

\\begin{table}[h!]
\\centering
\\begin{tabular}{|l|l|l|}
\\hline
Initial Yield & : & ${num(initialYield, 2)}\\% \\\\ \\hline
IRR & : & ${num(irr, 2)}\\% \\\\ \\hline
MIRR & : & ${num(mirr, 2)}\\% \\\\ \\hline
Payback Period & : & ${paybackYears} years and ${paybackMonths} months \\\\ \\hline
\\end{tabular}
\\end{table}
`;
}

// ────────────────────── Cashflow Table (Per-Stage Landscape) ──────────────────────

export function cashflowTable(simulation: SimulationData): string {
  if (!simulation.yearlyProjections || simulation.yearlyProjections.length === 0) {
    return `
\\section{Project Cash Flows}

Detailed yearly projections are not available for this simulation.
`;
  }

  function buildStageTable(stage: number): string {
    const factor = LOAD_SHEDDING_FACTORS[stage] ?? 1.0;
    const projections = simulation.yearlyProjections!;

    const rows = projections.map(y => {
      const yld = y.energyYield * factor;
      const energyIncome = y.energyIncome * factor;
      const demandSaving = y.demandSavingKva * factor;
      const demandIncome = y.demandIncome * factor;
      const totalIncome = energyIncome + demandIncome;
      const netCashflow = totalIncome - y.oAndM - y.insurance - y.replacementCost;
      return `${y.year} & ${num(yld)} & ${num(y.energyRate, 2)} & ${currency(energyIncome)} & ${num(demandSaving, 2)} & ${num(y.demandRate, 2)} & ${currency(demandIncome)} & ${currency(totalIncome)} & & \\negnum{${num(y.oAndM)}} & \\negnum{${num(y.insurance)}} & ${y.replacementCost > 0 ? `\\negnum{${num(y.replacementCost)}}` : ""} & ${currency(netCashflow)} & ${num(1 / Math.pow(1.09, y.year), 2)} \\\\`;
    }).join(" \\hline\n");

    // Year 0 row (initial investment)
    const year0 = `0 & & & & & & & & \\negnum{${num(simulation.systemCost)}} & & & & \\negnum{${num(simulation.systemCost)}} & 1.00 \\\\ \\hline`;

    const totalYield = projections.reduce((s, y) => s + y.energyYield * factor, 0);
    const totalEnergyIncome = projections.reduce((s, y) => s + y.energyIncome * factor, 0);
    const totalDemandIncome = projections.reduce((s, y) => s + y.demandIncome * factor, 0);
    const totalIncome = totalEnergyIncome + totalDemandIncome;

    return `
\\subsection*{${stage < 10 ? `7.${stage + 1}` : ""} STAGE ${stage}}

{\\tiny
\\begin{longtable}{|c|r|r|r|r|r|r|r|r|r|r|r|r|r|}
\\hline
\\textbf{Yr} &
\\textbf{\\begin{tabular}{@{}c@{}}Energy\\\\Yield\\\\(kWh)\\end{tabular}} &
\\textbf{\\begin{tabular}{@{}c@{}}Tariff\\\\(R/kWh)\\end{tabular}} &
\\textbf{\\begin{tabular}{@{}c@{}}Income\\\\(kWh)\\end{tabular}} &
\\textbf{\\begin{tabular}{@{}c@{}}Dmd\\\\Sv\\\\(kVA)\\end{tabular}} &
\\textbf{\\begin{tabular}{@{}c@{}}Tariff\\\\(R/kVA)\\end{tabular}} &
\\textbf{\\begin{tabular}{@{}c@{}}Income\\\\(kVA)\\end{tabular}} &
\\textbf{\\begin{tabular}{@{}c@{}}Total\\\\Income\\end{tabular}} &
\\textbf{\\begin{tabular}{@{}c@{}}Proj.\\\\Cost\\end{tabular}} &
\\textbf{\\begin{tabular}{@{}c@{}}O\\&M\\\\Cost\\end{tabular}} &
\\textbf{\\begin{tabular}{@{}c@{}}Ins.\\\\Cost\\end{tabular}} &
\\textbf{\\begin{tabular}{@{}c@{}}Repl.\\end{tabular}} &
\\textbf{\\begin{tabular}{@{}c@{}}Net Cash\\\\Flow\\end{tabular}} &
\\textbf{\\begin{tabular}{@{}c@{}}PV\\\\Fact.\\end{tabular}} \\\\
\\hline
\\endhead
${year0}
${rows}
\\hline
\\multicolumn{14}{|c|}{\\textbf{SUMMARY}} \\\\
\\hline
Totals & ${num(totalYield)} & & ${currency(totalEnergyIncome)} & & & ${currency(totalDemandIncome)} & ${currency(totalIncome)} & \\negnum{${num(simulation.systemCost)}} & & & & \\\\
\\hline
\\end{longtable}
}
`;
  }

  const stages = Array.from({ length: 9 }, (_, i) => i);
  const tables = stages.map(s => buildStageTable(s)).join("\n\\newpage\n");

  return `
\\begin{landscape}
\\section{Project Cash Flows}

${tables}

\\end{landscape}
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
