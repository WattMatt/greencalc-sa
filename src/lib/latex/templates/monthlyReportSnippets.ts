/**
 * LaTeX snippet generators for Monthly Report content blocks.
 * These produce placeholder/skeleton tables matching the monthly report template.
 * Data will be dynamically populated once SCADA integration is wired in.
 */
import { SimulationData } from "@/components/proposals/types";
import { esc } from "./snippets";

// ────────────────────── Executive Summary ──────────────────────

export function executiveSummary(simulation: SimulationData, project: any): string {
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

export function dailyPerformanceLog(): string {
  // Placeholder rows for a 31-day month
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

export function operationalDowntime(): string {
  // Placeholder rows — only days with downtime would typically appear
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

export function financialYieldReport(): string {
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
