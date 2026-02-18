/**
 * LaTeX snippet generators for Monthly Report content blocks.
 * When MonthlyReportData is provided, real values are injected.
 * Otherwise, placeholder output is generated for preview.
 */
import { SimulationData } from "@/components/proposals/types";
import { esc } from "./snippets";
import { MonthlyReportData } from "@/utils/monthlyReportData";

// ── Formatting helpers ──

function fmtNum(val: number): string {
  return val.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtRand(val: number): string {
  return `R ${fmtNum(val)}`;
}

function fmtPct(actual: number, guarantee: number): string {
  if (guarantee === 0) return "—";
  const pct = ((actual - guarantee) / guarantee) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}\\%`;
}

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ────────────────────── Executive Summary ──────────────────────

export function executiveSummary(data: MonthlyReportData, project: any): string {
  const projectName = esc(project?.name || "PROJECT");
  const monthYear = `${MONTH_NAMES[data.month]} ${data.year}`;

  const actualKwh = fmtNum(data.totals.meteredGeneration);
  const guaranteeKwh = fmtNum(data.totals.yieldGuarantee);
  const theoKwh = fmtNum(data.totals.theoreticalGeneration);
  const actualVar = fmtPct(data.totals.meteredGeneration, data.totals.yieldGuarantee);
  const theoVar = fmtPct(data.totals.theoreticalGeneration, data.totals.yieldGuarantee);

  return `
\\section{Executive Summary}

\\subsection{Installed Equipment}
\\renewcommand{\\arraystretch}{1.2}
\\setlength{\\extrarowheight}{3pt}

\\begin{table}[h!]
    \\centering
    \\small
    \\begin{tabular}{|L{40mm}|C{35mm}|C{35mm}|C{35mm}|}
        \\hline
        \\rowcolor{titleblue}
        \\textbf{\\color{white} ITEM} &
        \\textbf{\\color{white} MODULES} &
        \\textbf{\\color{white} INVERTERS} &
        \\textbf{\\color{white} INVERTERS} \\\\ \\hline
        \\textbf{Manufacturer} & [MODULE\\_MFR] & [INV\\_MFR\\_1] & [INV\\_MFR\\_2] \\\\ \\hline
        \\textbf{Specification} & [MODULE\\_SPEC] & [INV\\_SPEC\\_1] & [INV\\_SPEC\\_2] \\\\ \\hline
        \\textbf{Quantity} & [MODULE\\_QTY] & [INV\\_QTY\\_1] & [INV\\_QTY\\_2] \\\\ \\hline
        \\textbf{Total Power} & [DC\\_POWER] kWp (DC) & [AC\\_POWER\\_1] kW (AC) & [AC\\_POWER\\_2] kW (AC) \\\\ \\hline
        \\rowcolor{rowgray}
        \\textbf{Combined Power} &
        \\textbf{[TOTAL\\_DC] kWp (DC)} &
        \\multicolumn{2}{c|}{\\textbf{[TOTAL\\_AC] kW (AC)}} \\\\ \\hline
    \\end{tabular}
\\end{table}

\\subsection{Monthly Energy Generation (${esc(monthYear)})}
\\begin{table}[h!]
    \\centering
    \\small
    \\begin{tabular}{|L{40mm}|R{35mm}|R{35mm}|R{35mm}|}
        \\hline
        \\rowcolor{titleblue}
        \\textbf{\\color{white} METRIC} &
        \\textbf{\\color{white} ACTUAL (kWh)} &
        \\textbf{\\color{white} GUARANTEE (kWh)} &
        \\textbf{\\color{white} VARIANCE} \\\\ \\hline
        \\textbf{Actual Production} & ${actualKwh} & ${guaranteeKwh} & \\textbf{${actualVar}} \\\\ \\hline
        \\textbf{Theoretical Production} & ${theoKwh} & ${guaranteeKwh} & \\textbf{${theoVar}} \\\\ \\hline
    \\end{tabular}
\\end{table}

\\subsection{Yearly Energy Generation (Year ${data.year})}
\\begin{table}[h!]
    \\centering
    \\small
    \\begin{tabular}{|L{40mm}|R{35mm}|R{35mm}|R{35mm}|}
        \\hline
        \\rowcolor{titleblue}
        \\textbf{\\color{white} PERIOD} &
        \\textbf{\\color{white} ACTUAL (kWh)} &
        \\textbf{\\color{white} GUARANTEE (kWh)} &
        \\textbf{\\color{white} VARIANCE} \\\\ \\hline
        \\textbf{Year ${data.year} - Thus Far} & ${actualKwh} & ${guaranteeKwh} & \\textbf{${actualVar}} \\\\ \\hline
        \\textbf{Year ${data.year} - Total} & ${actualKwh} & ${guaranteeKwh} & \\textbf{${actualVar}} \\\\ \\hline
        \\rowcolor{titleblue}
        \\textbf{\\color{white} THEORETICAL} &
        \\textbf{\\color{white} THEORETICAL (kWh)} &
        \\textbf{\\color{white} GUARANTEE (kWh)} &
        \\textbf{\\color{white} VARIANCE} \\\\ \\hline
        \\textbf{Year ${data.year} - Thus Far} & ${theoKwh} & ${guaranteeKwh} & \\textbf{${theoVar}} \\\\ \\hline
        \\textbf{Year ${data.year} - Total} & ${theoKwh} & ${guaranteeKwh} & \\textbf{${theoVar}} \\\\ \\hline
    \\end{tabular}
\\end{table}
`;
}

/** Placeholder version when no data is available */
export function executiveSummaryPlaceholder(simulation: SimulationData, project: any): string {
  const projectName = esc(project?.name || "PROJECT");

  return `
\\section{Executive Summary}

\\subsection{Installed Equipment}
\\renewcommand{\\arraystretch}{1.2}
\\setlength{\\extrarowheight}{3pt}

\\begin{table}[h!]
    \\centering
    \\small
    \\begin{tabular}{|L{40mm}|C{35mm}|C{35mm}|C{35mm}|}
        \\hline
        \\rowcolor{titleblue}
        \\textbf{\\color{white} ITEM} &
        \\textbf{\\color{white} MODULES} &
        \\textbf{\\color{white} INVERTERS} &
        \\textbf{\\color{white} INVERTERS} \\\\ \\hline
        \\textbf{Manufacturer} & [MODULE\\_MFR] & [INV\\_MFR\\_1] & [INV\\_MFR\\_2] \\\\ \\hline
        \\textbf{Specification} & [MODULE\\_SPEC] & [INV\\_SPEC\\_1] & [INV\\_SPEC\\_2] \\\\ \\hline
        \\textbf{Quantity} & [MODULE\\_QTY] & [INV\\_QTY\\_1] & [INV\\_QTY\\_2] \\\\ \\hline
        \\textbf{Total Power} & [DC\\_POWER] kWp (DC) & [AC\\_POWER\\_1] kW (AC) & [AC\\_POWER\\_2] kW (AC) \\\\ \\hline
        \\rowcolor{rowgray}
        \\textbf{Combined Power} &
        \\textbf{[TOTAL\\_DC] kWp (DC)} &
        \\multicolumn{2}{c|}{\\textbf{[TOTAL\\_AC] kW (AC)}} \\\\ \\hline
    \\end{tabular}
\\end{table}

\\subsection{Monthly Energy Generation ([MONTH\\_YEAR])}
\\begin{table}[h!]
    \\centering
    \\small
    \\begin{tabular}{|L{40mm}|R{35mm}|R{35mm}|R{35mm}|}
        \\hline
        \\rowcolor{titleblue}
        \\textbf{\\color{white} METRIC} &
        \\textbf{\\color{white} ACTUAL (kWh)} &
        \\textbf{\\color{white} GUARANTEE (kWh)} &
        \\textbf{\\color{white} VARIANCE} \\\\ \\hline
        \\textbf{Actual Production} & [ACTUAL\\_KWH] & [GUARANTEE\\_KWH] & \\textbf{[ACTUAL\\_VAR]\\%} \\\\ \\hline
        \\textbf{Theoretical Production} & [THEO\\_KWH] & [GUARANTEE\\_KWH] & \\textbf{[THEO\\_VAR]\\%} \\\\ \\hline
    \\end{tabular}
\\end{table}

\\subsection{Yearly Energy Generation (Year [YEAR\\_NUM])}
\\begin{table}[h!]
    \\centering
    \\small
    \\begin{tabular}{|L{40mm}|R{35mm}|R{35mm}|R{35mm}|}
        \\hline
        \\rowcolor{titleblue}
        \\textbf{\\color{white} PERIOD} &
        \\textbf{\\color{white} ACTUAL (kWh)} &
        \\textbf{\\color{white} GUARANTEE (kWh)} &
        \\textbf{\\color{white} VARIANCE} \\\\ \\hline
        \\textbf{Year [YEAR\\_NUM] - Thus Far} & [YTD\\_ACTUAL] & [YTD\\_GUARANTEE] & \\textbf{[YTD\\_VAR]\\%} \\\\ \\hline
        \\textbf{Year [YEAR\\_NUM] - Total} & [YTD\\_ACTUAL] & [ANNUAL\\_GUARANTEE] & \\textbf{[ANNUAL\\_VAR]\\%} \\\\ \\hline
        \\rowcolor{titleblue}
        \\textbf{\\color{white} THEORETICAL} &
        \\textbf{\\color{white} THEORETICAL (kWh)} &
        \\textbf{\\color{white} GUARANTEE (kWh)} &
        \\textbf{\\color{white} VARIANCE} \\\\ \\hline
        \\textbf{Year [YEAR\\_NUM] - Thus Far} & [YTD\\_THEO] & [YTD\\_GUARANTEE] & \\textbf{[YTD\\_THEO\\_VAR]\\%} \\\\ \\hline
        \\textbf{Year [YEAR\\_NUM] - Total} & [YTD\\_THEO] & [ANNUAL\\_GUARANTEE] & \\textbf{[ANNUAL\\_THEO\\_VAR]\\%} \\\\ \\hline
    \\end{tabular}
\\end{table}
`;
}

// ────────────────────── Daily Performance Log ──────────────────────

export function dailyPerformanceLog(data: MonthlyReportData): string {
  const rows = data.dailyRows.map(r => {
    return `    ${r.day} & ${fmtNum(r.yieldGuarantee)} & ${fmtNum(r.meteredGeneration)} & ${fmtNum(r.downtimeEnergy)} & ${fmtNum(r.theoreticalGeneration)} & ${fmtNum(r.meteredGeneration)} & ${fmtNum(r.surplusDeficit)} \\\\ \\hline`;
  }).join("\n");

  const t = data.totals;

  return `
\\section{Daily Performance Log}
\\renewcommand{\\arraystretch}{1.1}
\\setlength{\\extrarowheight}{1pt}

\\begin{longtable}{|C{10mm}|R{20mm}|R{20mm}|R{20mm}|R{20mm}|R{20mm}|R{25mm}|}
    \\hline
    \\rowcolor{titleblue}
    \\textbf{\\color{white} Day} &
    \\textbf{\\color{white} Yield\\newline Guarantee} &
    \\textbf{\\color{white} Metered} &
    \\textbf{\\color{white} Down\\newline Time} &
    \\textbf{\\color{white} Theoretical} &
    \\textbf{\\color{white} Realised\\newline Cons.} &
    \\textbf{\\color{white} Surplus / \\newline Deficit} \\\\ \\hline
    \\endfirsthead
    \\hline
    \\rowcolor{titleblue} \\textbf{\\color{white} Day} & \\textbf{\\color{white} Guarantee} & \\textbf{\\color{white} Metered} & \\textbf{\\color{white} Down} & \\textbf{\\color{white} Theo} & \\textbf{\\color{white} Cons.} & \\textbf{\\color{white} Var} \\\\ \\hline
    \\endhead

${rows}
    \\rowcolor{rowgray} \\textbf{Total} & \\textbf{${fmtNum(t.yieldGuarantee)}} & \\textbf{${fmtNum(t.meteredGeneration)}} & \\textbf{${fmtNum(t.downtimeEnergy)}} & \\textbf{${fmtNum(t.theoreticalGeneration)}} & \\textbf{${fmtNum(t.meteredGeneration)}} & \\textbf{${fmtNum(t.surplusDeficit)}} \\\\ \\hline
\\end{longtable}
`;
}

export function dailyPerformanceLogPlaceholder(): string {
  const rows = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    return `    ${day} & [GUARANTEE] & [METERED] & [DOWNTIME] & [THEO] & [CONS] & [VAR] \\\\ \\hline`;
  }).join("\n");

  return `
\\section{Daily Performance Log}
\\renewcommand{\\arraystretch}{1.1}
\\setlength{\\extrarowheight}{1pt}

\\begin{longtable}{|C{10mm}|R{20mm}|R{20mm}|R{20mm}|R{20mm}|R{20mm}|R{25mm}|}
    \\hline
    \\rowcolor{titleblue}
    \\textbf{\\color{white} Day} &
    \\textbf{\\color{white} Yield\\newline Guarantee} &
    \\textbf{\\color{white} Metered} &
    \\textbf{\\color{white} Down\\newline Time} &
    \\textbf{\\color{white} Theoretical} &
    \\textbf{\\color{white} Realised\\newline Cons.} &
    \\textbf{\\color{white} Surplus / \\newline Deficit} \\\\ \\hline
    \\endfirsthead
    \\hline
    \\rowcolor{titleblue} \\textbf{\\color{white} Day} & \\textbf{\\color{white} Guarantee} & \\textbf{\\color{white} Metered} & \\textbf{\\color{white} Down} & \\textbf{\\color{white} Theo} & \\textbf{\\color{white} Cons.} & \\textbf{\\color{white} Var} \\\\ \\hline
    \\endhead

${rows}
    \\rowcolor{rowgray} \\textbf{Total} & \\textbf{[TOTAL\\_GUARANTEE]} & \\textbf{[TOTAL\\_METERED]} & \\textbf{[TOTAL\\_DOWNTIME]} & \\textbf{[TOTAL\\_THEO]} & \\textbf{[TOTAL\\_CONS]} & \\textbf{[TOTAL\\_VAR]} \\\\ \\hline
\\end{longtable}
`;
}

// ────────────────────── Operational Downtime ──────────────────────

export function operationalDowntime(data: MonthlyReportData): string {
  // Dynamic columns based on source labels
  const srcCount = data.sourceLabels.length;
  const sortedSources = Array.from(data.sourceDisplayNames.entries())
    .sort(([, a], [, b]) => a.localeCompare(b, undefined, { numeric: true }));
  const sourceKeys = sortedSources.map(([key]) => key);
  const labels = sortedSources.map(([, label]) => label);

  // If no sources, use placeholder columns
  if (srcCount === 0) {
    return operationalDowntimePlaceholder();
  }

  const srcColDef = sourceKeys.map(() => "R{20mm}").join("|");
  const headerLabels = labels.map(l => `\\textbf{\\color{white} ${esc(l)}}`).join(" &\n        ");
  const contHeaderLabels = labels.map(l => `\\textbf{\\color{white} ${esc(l)}}`).join(" & ");

  const rows = Array.from({ length: data.totalDays }, (_, i) => {
    const day = i + 1;
    const totalDt = data.dailyRows[i]?.downtimeSlots ?? 0;
    const comment = data.comments.get(day) || "-";
    const srcCells = sourceKeys.map(src => {
      const sd = data.sourceDayMap.get(`${day}-${src}`);
      return sd ? String(sd.downtimeSlots) : "0";
    }).join(" & ");
    return `    ${day} & ${totalDt} & ${srcCells} & ${esc(comment)} \\\\ \\hline`;
  }).join("\n");

  // Totals
  const totalDt = data.totals.downtimeSlots;
  const srcTotalCells = sourceKeys.map(src => {
    const st = data.sourceTotals.get(src);
    return st ? String(st.downtimeSlots) : "0";
  }).join("} & \\textbf{");

  return `
\\section{Operational Downtime Details}

\\begin{longtable}{|C{10mm}|R{20mm}|${srcColDef}|L{50mm}|}
    \\hline
    \\rowcolor{titleblue}
    \\textbf{\\color{white} Day} &
    \\textbf{\\color{white} Down Time} &
        ${headerLabels} &
    \\textbf{\\color{white} Comment} \\\\ \\hline
    \\endfirsthead
    \\hline
    \\rowcolor{titleblue} \\textbf{\\color{white} Day} & \\textbf{\\color{white} Down Time} & ${contHeaderLabels} & \\textbf{\\color{white} Comment} \\\\ \\hline
    \\endhead

${rows}
    \\rowcolor{rowgray} \\textbf{Total} & \\textbf{${totalDt}} & \\textbf{${srcTotalCells}} & \\textbf{-} \\\\ \\hline
\\end{longtable}
`;
}

export function operationalDowntimePlaceholder(): string {
  const rows = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    return `    ${day} & 0 & 0 & 0 & - \\\\ \\hline`;
  }).join("\n");

  return `
\\section{Operational Downtime Details}

\\begin{longtable}{|C{10mm}|R{20mm}|R{20mm}|R{20mm}|L{50mm}|}
    \\hline
    \\rowcolor{titleblue}
    \\textbf{\\color{white} Day} &
    \\textbf{\\color{white} Down Time} &
    \\textbf{\\color{white} Tie-In 1} &
    \\textbf{\\color{white} Tie-In 2} &
    \\textbf{\\color{white} Comment} \\\\ \\hline
    \\endfirsthead
    \\hline
    \\rowcolor{titleblue} \\textbf{\\color{white} Day} & \\textbf{\\color{white} Down Time} & \\textbf{\\color{white} Tie-In 1} & \\textbf{\\color{white} Tie-In 2} & \\textbf{\\color{white} Comment} \\\\ \\hline
    \\endhead

${rows}
    \\rowcolor{rowgray} \\textbf{Total} & \\textbf{[TOTAL\\_DOWNTIME]} & \\textbf{[TOTAL\\_TIE1]} & \\textbf{[TOTAL\\_TIE2]} & \\textbf{-} \\\\ \\hline
\\end{longtable}
`;
}

// ────────────────────── Financial Yield Report ──────────────────────

export function financialYieldReport(data: MonthlyReportData): string {
  const rate = data.tariffRate;

  const rows = data.dailyRows.map(r => {
    return `    ${r.day} & ${fmtRand(r.yieldGuarantee * rate)} & ${fmtRand(r.meteredGeneration * rate)} & ${fmtRand(r.downtimeEnergy * rate)} & ${fmtRand(r.theoreticalGeneration * rate)} & ${fmtRand(r.surplusDeficit * rate)} \\\\ \\hline`;
  }).join("\n");

  const t = data.totals;

  return `
\\section{Financial Yield Report}

\\begin{longtable}{|C{10mm}|R{25mm}|R{25mm}|R{25mm}|R{25mm}|R{25mm}|}
    \\hline
    \\rowcolor{titleblue}
    \\textbf{\\color{white} Day} &
    \\textbf{\\color{white} Yield\\newline Guarantee (R)} &
    \\textbf{\\color{white} Metered\\newline Gen (R)} &
    \\textbf{\\color{white} Down Time\\newline Loss (R)} &
    \\textbf{\\color{white} Theoretical\\newline Gen (R)} &
    \\textbf{\\color{white} Surplus / \\newline Deficit (R)} \\\\ \\hline
    \\endfirsthead
    \\hline
    \\rowcolor{titleblue} \\textbf{\\color{white} Day} & \\textbf{\\color{white} Guarantee (R)} & \\textbf{\\color{white} Metered (R)} & \\textbf{\\color{white} Down (R)} & \\textbf{\\color{white} Theo (R)} & \\textbf{\\color{white} Var (R)} \\\\ \\hline
    \\endhead

${rows}
    \\rowcolor{rowgray} \\textbf{Total} & \\textbf{${fmtRand(t.yieldGuarantee * rate)}} & \\textbf{${fmtRand(t.meteredGeneration * rate)}} & \\textbf{${fmtRand(t.downtimeEnergy * rate)}} & \\textbf{${fmtRand(t.theoreticalGeneration * rate)}} & \\textbf{${fmtRand(t.surplusDeficit * rate)}} \\\\ \\hline
\\end{longtable}
`;
}

export function financialYieldReportPlaceholder(): string {
  const rows = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    return `    ${day} & R [GUARANTEE] & R [METERED] & R [DOWNTIME] & R [THEO] & R [VAR] \\\\ \\hline`;
  }).join("\n");

  return `
\\section{Financial Yield Report}

\\begin{longtable}{|C{10mm}|R{25mm}|R{25mm}|R{25mm}|R{25mm}|R{25mm}|}
    \\hline
    \\rowcolor{titleblue}
    \\textbf{\\color{white} Day} &
    \\textbf{\\color{white} Yield\\newline Guarantee (R)} &
    \\textbf{\\color{white} Metered\\newline Gen (R)} &
    \\textbf{\\color{white} Down Time\\newline Loss (R)} &
    \\textbf{\\color{white} Theoretical\\newline Gen (R)} &
    \\textbf{\\color{white} Surplus / \\newline Deficit (R)} \\\\ \\hline
    \\endfirsthead
    \\hline
    \\rowcolor{titleblue} \\textbf{\\color{white} Day} & \\textbf{\\color{white} Guarantee (R)} & \\textbf{\\color{white} Metered (R)} & \\textbf{\\color{white} Down (R)} & \\textbf{\\color{white} Theo (R)} & \\textbf{\\color{white} Var (R)} \\\\ \\hline
    \\endhead

${rows}
    \\rowcolor{rowgray} \\textbf{Total} & \\textbf{R [TOTAL\\_GUARANTEE]} & \\textbf{R [TOTAL\\_METERED]} & \\textbf{R [TOTAL\\_DOWNTIME]} & \\textbf{R [TOTAL\\_THEO]} & \\textbf{R [TOTAL\\_VAR]} \\\\ \\hline
\\end{longtable}
`;
}
