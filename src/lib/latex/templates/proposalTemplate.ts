/**
 * Generates a complete .tex document from proposal data.
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
  const { simulation, branding, contentBlocks, proposal, project, tenants, tariffName } = data;

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
      case "executiveSummary":
        return snippets.executiveSummary(simulation, project);
      case "siteOverview":
        return snippets.siteOverview(project, simulation, tariffName);
      case "equipmentSpecs":
        return snippets.equipmentSpecs(simulation);
      case "loadAnalysis":
        return snippets.loadAnalysis(simulation, tenants || [], project);
      case "financialSummary":
        return snippets.financialSummary(simulation);
      case "cashflowTable":
        return snippets.cashflowTable(simulation);
      case "sensitivityAnalysis":
        return snippets.sensitivityAnalysis(simulation);
      case "terms":
        return snippets.termsAndConditions(proposal);
      case "signature":
        return snippets.signatureBlock(proposal, branding);
      default:
        return `\\section{${snippets.esc(block.label)}}\n\nContent for this section is not yet available.\n`;
    }
  }).join("\n\\newpage\n");

  return `\\documentclass[a4paper,11pt]{article}

% ── Packages ──
\\usepackage[top=25mm, bottom=25mm, left=20mm, right=20mm]{geometry}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{booktabs}
\\usepackage{tabularx}
\\usepackage{xcolor}
\\usepackage{graphicx}
\\usepackage{fancyhdr}
\\usepackage{hyperref}
\\usepackage{parskip}

% ── Brand Colors ──
\\definecolor{brandprimary}{RGB}{${primaryRgb}}
\\definecolor{brandsecondary}{RGB}{${secondaryRgb}}

% ── Header / Footer ──
\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0.4pt}
\\fancyhead[L]{\\small\\color{gray}${snippets.esc(branding.company_name || "")}}
\\fancyhead[R]{\\small\\color{gray}${snippets.esc(project?.name || "")}}
\\fancyfoot[C]{\\small\\thepage}
\\fancyfoot[R]{\\small\\color{gray}${snippets.esc(branding.website || "")}}

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
