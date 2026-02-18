/**
 * Generates a complete .tex document from proposal data.
 * Matches the Financial Analysis report layout.
 */
import { SimulationData, ProposalBranding, ContentBlock, Proposal, SECTION_BEGIN, SECTION_END } from "@/components/proposals/types";
import { MonthlyReportData } from "@/utils/monthlyReportData";
import * as snippets from "./snippets";
import * as monthlySnippets from "./monthlyReportSnippets";

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export interface TemplateData {
  simulation: SimulationData;
  branding: ProposalBranding;
  contentBlocks: ContentBlock[];
  proposal: Partial<Proposal>;
  project: any;
  tenants: any[];
  tariffName?: string;
  monthlyReportData?: MonthlyReportData;
}

/** Generate content for a single block (no delimiters). */
export function generateBlockContent(
  blockId: string,
  data: TemplateData,
): string {
  const { simulation, branding, proposal, project, tenants } = data;
  switch (blockId) {
    case "cover":
      return snippets.coverPage(branding, project, simulation, proposal);
    case "tableOfContents":
      return snippets.tableOfContents();
    case "adminDetails":
      return snippets.administrativeDetails(project, simulation);
    case "introduction":
      return snippets.introduction(simulation, project);
    case "backgroundMethodology":
      return snippets.backgroundMethodology(simulation, project);
    case "tenderReturnData":
      return snippets.tenderReturnData(simulation, project);
    case "loadAnalysis":
      return snippets.loadAnalysis(simulation, tenants || [], project);
    case "financialEstimates":
      return snippets.financialEstimates(simulation);
    case "financialConclusion":
      return snippets.financialConclusion(simulation);
    case "cashflowTable":
      return snippets.cashflowTable(simulation);
    case "terms":
      return snippets.termsAndConditions(proposal);
    case "signature":
      return snippets.signatureBlock(proposal, branding);
    // Monthly report blocks
    case "executiveSummary":
      return data.monthlyReportData
        ? monthlySnippets.executiveSummary(data.monthlyReportData, data.project)
        : monthlySnippets.executiveSummaryPlaceholder(data.simulation, data.project);
    case "dailyLog":
      return data.monthlyReportData
        ? monthlySnippets.dailyPerformanceLog(data.monthlyReportData)
        : monthlySnippets.dailyPerformanceLogPlaceholder();
    case "operationalDowntime":
      return data.monthlyReportData
        ? monthlySnippets.operationalDowntime(data.monthlyReportData)
        : monthlySnippets.operationalDowntimePlaceholder();
    case "financialYield":
      return data.monthlyReportData
        ? monthlySnippets.financialYieldReport(data.monthlyReportData)
        : monthlySnippets.financialYieldReportPlaceholder();
    default:
      return `\\section{${snippets.esc(blockId)}}\n\nContent for this section is not yet available.\n`;
  }
}

/** Build the LaTeX preamble (everything before \\begin{document}). */
export function generatePreamble(data: TemplateData): string {
  const { branding, proposal, project } = data;
  // Hardcoded titleblue color — branding/template influence disabled for now
  const primaryRgb = "23, 109, 177";

  const projectName = snippets.esc(project?.name || "PROJECT");
  const version = String(proposal.version || 1).padStart(3, "0");

  return `\\documentclass[11pt, a4paper]{article}

% ── Page Layout & Margins ──
\\usepackage[
    a4paper,
    left=25.4mm,
    right=25.4mm,
    bottom=25.4mm,
    top=40mm,
    headheight=40pt,
    headsep=10mm,
    footskip=0mm
]{geometry}

% ── Font Settings ──
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[sfdefault]{carlito}

% ── Packages ──
\\usepackage{booktabs}
\\usepackage{tabularx}
\\usepackage{xcolor}
\\usepackage{graphicx}
\\usepackage{fancyhdr}
\\usepackage{hyperref}
\\usepackage{parskip}
\\usepackage{pdflscape}
\\usepackage{longtable}
\\usepackage{multirow}
\\usepackage{siunitx}
\\usepackage{colortbl}
\\usepackage{array}
\\usepackage{eso-pic}
\\usepackage{tikz}

% ── Brand Colors ──
\\definecolor{titleblue}{RGB}{${primaryRgb}}
\\definecolor{lightgray}{gray}{0.9}
\\definecolor{rowgray}{gray}{0.95}

% ── Custom Column Types ──
\\newcolumntype{L}[1]{>{\\raggedright\\arraybackslash}b{#1}}
\\newcolumntype{C}[1]{>{\\centering\\arraybackslash}b{#1}}
\\newcolumntype{R}[1]{>{\\raggedleft\\arraybackslash}b{#1}}

% ── Helpers ──
\\newcommand{\\negnum}[1]{(#1)}

% ── Header / Footer ──
\\pagestyle{fancy}
\\fancyhf{} % Clear defaults
\\renewcommand{\\headrulewidth}{1pt}
\\renewcommand{\\footrulewidth}{0.5pt}

\\fancyhead[C]{%
    % Outer tabular spans the full text width
    \\begin{tabular*}{\\textwidth}{@{\\extracolsep{\\fill}} l r @{}}
        % --- LEFT SIDE ---
        \\begin{tabular}[b]{@{}c@{}}
            \\text{${projectName}} \\\\
            \\text{SOLAR PV INSTALLATION} \\hspace{0.5em} $\\rightarrow$ \\hspace{0.5em} Financial Analysis
        \\end{tabular} 
        & 
        % --- RIGHT SIDE ---
        \\begin{tabular}[b]{@{}r@{}}
            \\begin{tabular}[b]{@{}r@{}}
                \\today \\\\
                Rev ${version}
            \\end{tabular}
            \\hspace{1em}
            % --- LOGO PLACEHOLDER (TikZ) ---
            \\raisebox{-10pt}{%
                \\begin{tikzpicture}
                    \\node[fill=titleblue, text=white, font=\\bfseries\\large, minimum width=1.6cm, minimum height=0.9cm, inner sep=0pt] (logo) {WM};
                    \\draw[titleblue, thick] (logo.south west) rectangle (logo.north east);
                    \\draw[titleblue, thick] ([yshift=2pt]logo.north west) -- ([yshift=2pt]logo.north east);
                    \\draw[titleblue, thick] ([xshift=-2pt]logo.north west) -- ([xshift=-2pt]logo.south west);
                    \\draw[titleblue, thick] (logo.north west) -- ([xshift=-2pt, yshift=2pt]logo.north west);
                    \\draw[titleblue, thick] (logo.north east) -- ([yshift=2pt]logo.north east);
                \\end{tikzpicture}%
            }
        \\end{tabular}
    \\end{tabular*}
}

% ── Footer Configuration ──
\\fancyfoot{} % Clear defaults
\\renewcommand{\\footrulewidth}{0.5pt}

\\fancyfoot[C]{%
    \\tiny
    \\vspace{5mm}
    
    \\begin{tabular*}{\\textwidth}{@{\\extracolsep{\\fill}} l r @{}}
        \\textbf{Document Number} \\hspace{0.5em} [DOCUMENT\\_NUMBER\\_PLACEHOLDER] & 
        \\textbf{Print date} \\hspace{0.5em} [PRINT\\_DATE\\_PLACEHOLDER] \\hspace{5em} \\thepage
    \\end{tabular*}
    \\\\[1em]
    
    \\centering
    [FILE\\_PATH\\_PLACEHOLDER]
}

% ── Hyperlinks ──
\\hypersetup{
  colorlinks=true,
  linkcolor=black,
  urlcolor=titleblue,
  pdfborder={0 0 0}
}

% ── Section styling ──
\\usepackage{titlesec}
\\titleformat{\\section}{\\Large\\bfseries\\color{titleblue}}{\\thesection}{1em}{}
\\titleformat{\\subsection}{\\large\\bfseries\\color{titleblue}}{\\thesubsection}{1em}{}`;
}

/** Generate a complete .tex document with section delimiters. */
export function generateLatexSource(data: TemplateData): string {
  const { contentBlocks } = data;

  const enabled = contentBlocks
    .filter(b => b.enabled)
    .sort((a, b) => a.order - b.order);

  const sections = enabled.map(block => {
    const content = generateBlockContent(block.id, data);
    return `${SECTION_BEGIN(block.id)}\n${content}\n${SECTION_END(block.id)}`;
  }).join("\n");

  return `${generatePreamble(data)}

\\begin{document}

${sections}

\\end{document}
`;
}
