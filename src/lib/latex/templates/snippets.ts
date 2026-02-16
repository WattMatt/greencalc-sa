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

function currencyDecimal(value: number, decimals = 2): string {
  return `R${value.toLocaleString("en-ZA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
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
  const version = String(proposal.version || 1).padStart(3, "0");
  const projectName = esc(project?.name || "PROJECT");
  const companyName = branding.company_name ? esc(branding.company_name) : "WATSON MATTHEUS CONSULTING ELECTRICAL ENGINEERS (PTY) LTD";
  const address = branding.address ? esc(branding.address) : "141 Witch-Hazel Avenue\\\\Highveld Techno Park\\\\Building 1A";
  const phone = branding.contact_phone ? esc(branding.contact_phone) : "(012) 665 3487";
  const contactName = esc(proposal.prepared_by || "Mr Arno Mattheus");

  return `
\\begin{titlepage}
    % --- 1. Blue Sidebar (Shifted Right) ---
    \\AddToShipoutPictureBG*{
        \\begin{tikzpicture}[remember picture, overlay]
            % Shifted start by 0.5cm from the left edge
            % Rectangle is 1.0cm wide
            \\fill[titleblue] ([xshift=0.5cm]current page.north west) rectangle ++(1.0cm, -\\paperheight);
        \\end{tikzpicture}
    }

    \\centering
    \\vspace*{3cm}

    % --- 2. Title Section (Centered, Blue Text) ---
    \\textcolor{titleblue}{
        {\\Huge \\textbf{${projectName}}}\\\\[1.5cm]
        {\\Huge \\textbf{SOLAR PV INSTALLATION}}\\\\[0.5cm]
        {\\Large Financial Analysis}\\\\[0.5cm]
        {\\Large ${num(acCapacity)} kW\\textsubscript{AC}}\\\\[3cm]
    }

    % --- 3. Middle Section: Prepared By & Logo ---
    \\noindent\\rule{\\linewidth}{0.5pt} \\\\
    \\vspace{1em}

    \\noindent
    \\begin{minipage}[t]{0.65\\textwidth}
        \\raggedright
        \\textbf{\\textcolor{gray}{PREPARED BY:}} \\\\[0.5em]
        \\textbf{${companyName}}\\\\
        ${address}\\\\
        Tel: ${phone}\\\\
        Contact: ${contactName}
    \\end{minipage}%
    \\hfill
    \\begin{minipage}[t]{0.30\\textwidth}
        \\raggedleft
        % --- REPLACEMENT LOGO (TIKZ) ---
        % Replace this TikZ picture with \\includegraphics when file is available
        \\begin{tikzpicture}
            \\node[fill=titleblue, text=white, font=\\bfseries\\huge, minimum width=2.5cm, minimum height=1.4cm, inner sep=0pt] {WM};
            \\draw[titleblue, thick] (-1.25, 0.7) rectangle (1.25, -0.7);
            \\draw[titleblue, thick] (-1.35, 0.8) -- (1.25, 0.8);
            \\draw[titleblue, thick] (-1.35, 0.8) -- (-1.35, -0.7);
        \\end{tikzpicture}
    \\end{minipage}

    \\vspace{1em}
    \\noindent\\rule{\\linewidth}{0.5pt}

    \\vspace{2cm}

    % --- 4. Bottom Section: Date and Revision ---
    \\noindent
    \\begin{tabular*}{\\linewidth}{@{\\extracolsep{\\fill}} l r}
        \\textbf{\\Large DATE:} & \\textcolor{titleblue}{\\Large \\textbf{\\today}} \\\\[1em]
        \\textbf{\\Large REVISION:} & \\textcolor{titleblue}{\\Large \\textbf{Rev ${version}}} \\\\
    \\end{tabular*}

    \\vfill

\\end{titlepage}
`;
}

// ────────────────────── Table of Contents ──────────────────────

export function tableOfContents(): string {
  return `
% --- 1. Blue Sidebar (Shifted Right) ---
    \\AddToShipoutPictureBG*{
        \\begin{tikzpicture}[remember picture, overlay]
            % Shifted start by 0.5cm from the left edge
            % Rectangle is 1.0cm wide
            \\fill[titleblue] ([xshift=0.5cm]current page.north west) rectangle ++(1.0cm, -\\paperheight);
        \\end{tikzpicture}
    }

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

  // Replacement cost breakdown estimates
  const solarModuleCost = simulation.equipmentSpecs?.panelCount
    ? Math.round(replacementCost * 0.265) : 0;
  const inverterCost = Math.round(replacementCost * 0.569);
  const batteryCost = simulation.batteryCapacity > 0
    ? Math.round(replacementCost * 0.166) : 0;

  return `
\\section{Background and Methodology}
The following assumptions were made to estimate the proposed solar PV system's electrical yield, relevant costs, and returns.

\\begin{enumerate}
\\item An extrapolation of a previously designed and installed solar PV plant was used to determine this plant's yield guarantees.
\\item The latest available Tariff for the local authority is as follows:
\\end{enumerate}

\\begin{table}[h!]
\\centering
\\small
\\renewcommand{\\arraystretch}{1.2}
\\begin{tabular}{|l|c|c|c|}
\\hline
\\rowcolor[gray]{0.5} & \\multicolumn{3}{c|}{\\textbf{\\color{black} TIME OF USE - Solar Sun Hours}} \\\\ \\hline
\\rowcolor{gray} & \\cellcolor[RGB]{0,176,240} \\textbf{High Demand JUN-AUG} & \\cellcolor[RGB]{255,192,0} \\textbf{Low Demand SEP-MAY} & \\cellcolor[RGB]{112,48,160} \\textbf{\\color{black} Annual Blended Tariff} \\\\ \\hline
\\rowcolor{red}\\textbf{Peak} & ${currencyDecimal(tariffRate, 4)} & ${currencyDecimal(tariffRate, 4)} & \\cellcolor[RGB]{112,48,160} \\\\ \\hline
\\rowcolor{yellow}\\textbf{Standard} & ${currencyDecimal(tariffRate, 4)} & ${currencyDecimal(tariffRate, 4)} & \\cellcolor[RGB]{112,48,160} ${currencyDecimal(tariffRate, 4)} \\\\ \\hline
\\rowcolor[RGB]{0,176,80}\\textbf{Off Peak} & ${currencyDecimal(tariffRate, 4)} & ${currencyDecimal(tariffRate, 4)} & \\cellcolor[RGB]{112,48,160} \\\\ \\hline
\\cellcolor[gray]{0.5}\\textbf{BLENDED} & \\cellcolor[RGB]{0,176,240} ${currencyDecimal(tariffRate, 4)} & \\cellcolor[RGB]{255,192,0} ${currencyDecimal(tariffRate, 4)} & \\cellcolor[RGB]{112,48,160} \\\\ \\hline
\\rowcolor[gray]{0.5} \\multicolumn{3}{|c|}{\\textbf{kVA Demand Charge}} & ${currencyDecimal(demandRate, 2)} \\\\ \\hline
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
\\small
\\renewcommand{\\arraystretch}{1.2}
\\begin{tabular}{|l|l|l|l|}
\\hline
\\rowcolor{titleblue} \\multicolumn{4}{|c|}{\\textbf{\\color{white} FINANCIAL RETURN INPUTS}} \\\\ \\hline
Cost of Capital & 9.00\\% & Low Demand Blended Tariff In Year 1 (ZAR / kWh) & ${currencyDecimal(tariffRate, 4)} \\\\ \\hline
CPI & 6.00\\% & High Demand Blended Tariff In Year 1 (ZAR / kWh) & ${currencyDecimal(tariffRate, 4)} \\\\ \\hline
Electricity Inflation & 10.00\\% & Total Demand Blended Tariff In Year 1 (ZAR / kWh) & ${currencyDecimal(tariffRate, 4)} \\\\ \\hline
Project Duration (yr) & 20 & Blended Tariff Used In Evaluation & \\cellcolor[gray]{0.7} ${currencyDecimal(tariffRate, 4)} \\\\ \\hline
& & & \\\\ \\hline
Adjusted Discount Rate & 15.00\\% & Electricity kVA cost Year 1 (ZAR / kVA) & ${currencyDecimal(demandRate, 2)} \\\\ \\hline
Cost of Capital (LCOE calc) & 9.00\\% & & \\\\ \\hline
& & Insurance Cost Year 1 (ZAR) & ${currency(insuranceCost)} \\\\ \\hline
MIRR - Finance rate & 9.00\\% & & \\\\ \\hline
MIRR - re-investment rate & 10.00\\% & Replacement Cost At Year 10 (ZAR) & ${currency(replacementCost)} \\\\ \\hline
& & \\hspace{1em} 10\\% On Solar Module Cost & ${currency(solarModuleCost)} \\\\ \\hline
& & \\hspace{1em} 50\\% On Inverter Cost & ${currency(inverterCost)} \\\\ \\hline
& & \\hspace{1em} 40\\% On Battery Cost & ${currency(batteryCost)} \\\\ \\hline
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
  const cost = simulation.systemCost;

  // Stage yield rows with alternating shading
  const stageYields = LOAD_SHEDDING_FACTORS.map((_, i) => ({
    stage: i,
    yield: getStageYield(baseYield, i),
  }));

  const leftCol = stageYields.slice(0, 5);
  const rightCol = stageYields.slice(5);
  const lsRows = leftCol.map((l, i) => {
    const shade = i % 2 === 0 ? "\\rowcolor[gray]{0.9} " : "";
    const r = rightCol[i];
    const rightPart = r ? `\\textbf{STAGE ${r.stage}} & ${num(r.yield, 2)}` : "& ";
    return `${shade}\\textbf{STAGE ${l.stage}} & ${num(l.yield, 2)} & ${rightPart} \\\\ \\hline`;
  }).join("\n");

  // Financial metrics per stage helper
  function stageMetrics(stage: number) {
    const factor = LOAD_SHEDDING_FACTORS[stage] ?? 1.0;
    const yld = baseYield * factor;
    const zarPerKwh = cost / yld;
    const zarPerWpDc = cost / (dcCapacity * 1000) * 1000;
    const zarPerWpAc = cost / (simulation.solarCapacity * 1000) * 1000;
    const lcoe = (simulation.lcoe ?? 0) / factor;
    const initialYield = (simulation.annualSavings / cost * 100) * factor;
    const irr = (simulation.irr ?? 0) * factor;
    const mirr = (simulation.mirr ?? 0) * factor;
    const payback = simulation.paybackYears / factor;
    const npv = (simulation.npv ?? 0) * factor;
    return { zarPerKwh, zarPerWpDc, zarPerWpAc, lcoe, initialYield, irr, mirr, payback, npv };
  }

  const s0 = stageMetrics(0);

  // Stage 0 standalone financial table
  const stage0Table = `
\\begin{table}[h!]
\\centering
\\small
\\renewcommand{\\arraystretch}{1.2}
\\begin{tabularx}{0.7\\textwidth}{|>{\\columncolor[RGB]{23, 100, 166}\\color{white}\\bfseries}X|r|}
\\hline
\\rowcolor[RGB]{23, 100, 166} \\color{white} FINANCIAL RETURN OUTPUTS & \\color{white} STAGE 0 \\\\ \\hline
ZAR / kWh (1st Year) & ${num(s0.zarPerKwh, 2)} \\\\ \\hline
ZAR / Wp (DC) & ${num(s0.zarPerWpDc, 2)} \\\\ \\hline
ZAR / Wp (AC) & ${num(s0.zarPerWpAc, 2)} \\\\ \\hline
LCOE (ZAR/kWh) & ${num(s0.lcoe, 2)} \\\\ \\hline
Initial Yield & ${num(s0.initialYield, 2)}\\% \\\\ \\hline
IRR & ${num(s0.irr, 2)}\\% \\\\ \\hline
MIRR & ${num(s0.mirr, 2)}\\% \\\\ \\hline
Payback Period & ${num(s0.payback, 2)} \\\\ \\hline
NPV & ${num(s0.npv, 2)} \\\\ \\hline
\\end{tabularx}
\\end{table}`;

  // Multi-stage financial tables (Stages 1-4 and 5-8)
  function makeFinancialTable(stages: number[]) {
    const headerCells = stages.map(s => `\\color{white} STAGE ${s}`).join(" & ");
    const colSpec = stages.map(() => "r").join("|");

    function row(label: string, getter: (m: ReturnType<typeof stageMetrics>) => string) {
      const cells = stages.map(s => getter(stageMetrics(s))).join(" & ");
      return `${label} & ${cells} \\\\ \\hline`;
    }

    return `
\\begin{table}[h!]
\\centering
\\small
\\renewcommand{\\arraystretch}{1.2}
\\begin{tabularx}{\\textwidth}{|>{\\columncolor[RGB]{23, 100, 166}\\color{white}\\bfseries}X|${colSpec}|}
\\hline
\\rowcolor[RGB]{23, 100, 166} \\color{white} FINANCIAL RETURN OUTPUTS & ${headerCells} \\\\ \\hline
${row("ZAR / kWh (1st Year)", m => num(m.zarPerKwh, 2))}
${row("ZAR / Wp (DC)", m => num(m.zarPerWpDc, 2))}
${row("ZAR / Wp (AC)", m => num(m.zarPerWpAc, 2))}
${row("LCOE (ZAR/kWh)", m => num(m.lcoe, 2))}
${row("Initial Yield", m => `${num(m.initialYield, 2)}\\%`)}
${row("IRR", m => `${num(m.irr, 2)}\\%`)}
${row("MIRR", m => `${num(m.mirr, 2)}\\%`)}
${row("Payback Period", m => num(m.payback, 2))}
${row("NPV", m => num(m.npv, 2))}
\\end{tabularx}
\\end{table}`;
  }

  return `
\\section{Tender Return Data}

\\begin{table}[h!]
\\centering
\\small
\\renewcommand{\\arraystretch}{1.2}
\\begin{tabularx}{\\textwidth}{|X|r|}
\\hline
\\rowcolor[RGB]{23, 100, 166} \\textbf{\\color{white} TENDER RETURN DATA INPUTS} & \\textbf{\\color{white} STAGE 0} \\\\ \\hline
Project Cost excl 3yr O\\&M and VAT & ${num(cost)} \\\\ \\hline
O\\&M & ${num(oAndMYear1 * 3)} \\\\ \\hline
Health and Safety Consultant & 45,000 \\\\ \\hline
Water Points & 90,000 \\\\ \\hline
CCTV & 60,000 \\\\ \\hline
Generator Integration & 0 \\\\ \\hline
MV Switch Gear & 100,000 \\\\ \\hline
Professional Fees & 530,000 \\\\ \\hline
Project Management Fees & 158,091 \\\\ \\hline
Project Contingency & 149,241 \\\\ \\hline
\\textbf{Total Capital cost of Project} & \\textbf{${num(cost)}} \\\\ \\hline
Value of Tender subjected to Foreign Exchange (ZAR) & ${num(Math.round(cost * 0.45))} \\\\ \\hline
\\% of Tender subjected to Foreign Exchange & 45\\% \\\\ \\hline
Energy Yield Year 1 (kWh) & ${num(baseYield, 2)} \\\\ \\hline
kVA saving in Year 1 (kVA) & ${num(simulation.demandSavingKva ?? 0, 2)} \\\\ \\hline
Energy yield over lifespan (kWh) & ${num(lifespanYield, 2)} \\\\ \\hline
O\\&M Cost Year 1 (ZAR) & ${num(oAndMYear1, 2)} \\\\ \\hline
Degradation Year 1 (\\%/yr) & 1.50\\% \\\\ \\hline
Degradation Year 2 and onwards (\\%/yr) & 0.50\\% \\\\ \\hline
${specs?.panelCount ? `Number of panels to be installed (\\#) & ${num(specs.panelCount, 2)} \\\\ \\hline` : ""}
${panelArea > 0 ? `Area to be covered by PV panels (\$m^2\$) & ${num(panelArea, 2)} \\\\ \\hline` : ""}
Lifespan (yr) & 20.00 \\\\ \\hline
kWp (DC) & ${num(dcCapacity, 0)} \\\\ \\hline
kWp (AC) & ${num(simulation.solarCapacity, 0)} \\\\ \\hline
${specs?.panelEfficiency ? `Module efficiency (\\%) & ${num(specs.panelEfficiency, 2)}\\% \\\\ \\hline` : ""}
\\end{tabularx}
\\end{table}

\\textbf{LOAD SHEDDING IMPACT}

\\begin{table}[h!]
\\centering
\\small
\\renewcommand{\\arraystretch}{1.2}
\\begin{tabularx}{\\textwidth}{|X|r|X|r|}
\\hline
\\rowcolor{titleblue} \\textbf{\\color{white} LOAD SHEDDING} & \\textbf{\\color{white} KWH / ANNUM} & \\textbf{\\color{white} LOAD SHEDDING} & \\textbf{\\color{white} KWH / ANNUM} \\\\ \\hline
${lsRows}
\\end{tabularx}
\\end{table}

${stage0Table}

${makeFinancialTable([1, 2, 3, 4])}

${makeFinancialTable([5, 6, 7, 8])}
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

  const stagesB = [5, 6, 7, 8];

  const colSpec = stagesB.map(() => "r").join("|");
  const headerCells = stagesB.map(s => `\\textbf{STAGE ${s}}`).join(" & ");

  return `
\\section{Financial Estimates}
Based on the inputs above, the various stages of load shedding and their impact have been applied to the energy yield of year 1. Taking this into account, the following financial returns have been calculated for each stage:

\\begin{table}[h!]
\\centering
\\small
\\begin{tabular}{|l|${colSpec}|}
\\hline
\\textbf{FINANCIAL OUTPUTS} & ${headerCells} \\\\ \\hline
${fmtRow("ZAR/kWh (1st Year)", stagesB, m => num(m.zarPerKwh, 2))}
${fmtRow("ZAR/Wp (DC)", stagesB, m => num(m.zarPerWpDc, 2))}
${fmtRow("ZAR/Wp (AC)", stagesB, m => num(m.zarPerWpAc, 2))}
${fmtRow("LCOE (ZAR/kWh)", stagesB, m => num(m.lcoe, 2))}
${fmtRow("Initial Yield", stagesB, m => `${num(m.initialYield, 2)}\\%`)}
${fmtRow("IRR", stagesB, m => `${num(m.irr, 2)}\\%`)}
${fmtRow("MIRR", stagesB, m => `${num(m.mirr, 2)}\\%`)}
${fmtRow("Payback Period", stagesB, m => num(m.payback, 2))}
${fmtRow("NPV", stagesB, m => currency(m.npv))}
\\end{tabular}
\\end{table}


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
\\renewcommand{\\arraystretch}{1.2}
\\begin{tabular}{l c l}
    \\textbf{Initial Yield}  & \\textbf{:} & \\textbf{${num(initialYield, 2)} \\%} \\\\
    \\textbf{IRR}            & \\textbf{:} & \\textbf{${num(irr, 2)} \\%} \\\\
    \\textbf{MIRR}           & \\textbf{:} & \\textbf{${num(mirr, 2)} \\%} \\\\
    \\textbf{Payback Period} & \\textbf{:} & \\textbf{${paybackYears} years and ${paybackMonths} months} \\\\
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
${esc(proposal.disclaimers) || "This proposal is based on estimated consumption data and solar irradiance forecasts. Actual performance may vary based on weather conditions, equipment degradation, and other factors."}

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
