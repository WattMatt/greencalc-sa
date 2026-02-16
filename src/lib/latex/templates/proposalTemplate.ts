/**
 * Generates a complete .tex document from proposal data.
 * Matches the Financial Analysis report layout.
 */
import { SimulationData, ProposalBranding, ContentBlock, Proposal } from "@/components/proposals/types";
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

export function generateLatexSource(data: TemplateData): string {
  const { simulation, branding, contentBlocks, proposal, project, tenants } = data;

  const enabled = contentBlocks
    .filter(b => b.enabled)
    .sort((a, b) => a.order - b.order);

  const primaryRgb = hexToRgb(branding.primary_color || "#22c55e");
  const secondaryRgb = hexToRgb(branding.secondary_color || "#0f172a");

  // Build section content
  const sections = enabled.map(block => {
    switch (block.id) {
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
        return `\\section{${snippets.esc(block.label)}}\n\nContent for this section is not yet available.\n`;
    }
  }).join("\n\\newpage\n");

  return `\\documentclass[8pt, a4paper]{article}

% ── Packages ──
\\usepackage[top=3cm, bottom=3.5cm, left=1.5cm, right=1.5cm, headheight=40pt]{geometry}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{helvet}
\\renewcommand{\\familydefault}{\\sfdefault}
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

% ── Brand Colors ──
\\definecolor{brandprimary}{RGB}{${primaryRgb}}
\\definecolor{brandsecondary}{RGB}{${secondaryRgb}}
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
  linkcolor=brandprimary,
  urlcolor=brandprimary,
}

% ── Section styling ──
\\usepackage{titlesec}
\\titleformat{\\section}{\\Large\\bfseries\\color{brandsecondary}}{\\thesection}{1em}{}
\\titleformat{\\subsection}{\\large\\bfseries\\color{brandsecondary}}{\\thesubsection}{1em}{}

\\begin{document}

${sections}

\\end{document}
`;
}
