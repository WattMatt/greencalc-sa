/**
 * Generates a complete .tex document from proposal data.
 * Matches the Financial Analysis report layout.
 */
import { SimulationData, ProposalBranding, ContentBlock, Proposal, SECTION_BEGIN, SECTION_END } from "@/components/proposals/types";
import * as snippets from "./snippets";

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
    default:
      return `\\section{${snippets.esc(blockId)}}\n\nContent for this section is not yet available.\n`;
  }
}

/** Build the LaTeX preamble (everything before \\begin{document}). */
export function generatePreamble(data: TemplateData): string {
  const { branding, proposal, project } = data;
  // Hardcoded titleblue color — branding/template influence disabled for now
  const primaryRgb = "23, 100, 166";

  return `\\documentclass[11pt, a4paper]{article}

% ── Page Layout & Margins ──
\\usepackage[top=25.4mm, bottom=25.4mm, left=25.4mm, right=25.4mm, headheight=40pt]{geometry}

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

% ── Helpers ──
\\newcommand{\\negnum}[1]{(#1)}

% ── Header / Footer ──
\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{1pt}
\\renewcommand{\\footrulewidth}{0.5pt}
\\lhead{\\textbf{${snippets.esc(project?.name || "PROJECT")}}\\\\SOLAR PV INSTALLATION}
\\rhead{Financial Analysis\\\\\\today\\\\Rev ${String(proposal.version || 1).padStart(3, "0")}}
\\rfoot{\\thepage}

% ── Hyperlinks ──
\\hypersetup{
  colorlinks=true,
  linkcolor=titleblue,
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
  }).join("\n\\newpage\n");

  return `${generatePreamble(data)}

\\begin{document}

${sections}

\\end{document}
`;
}
