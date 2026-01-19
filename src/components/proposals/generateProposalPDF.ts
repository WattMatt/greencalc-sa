import { pdfMake, COLORS, defaultStyles, formatCurrency, formatNumber } from "@/lib/pdfmake/pdfmakeConfig";
import { ProposalTemplate, PROPOSAL_TEMPLATES, ProposalTemplateId } from "./templates/types";
import type { Proposal, SimulationData, ProposalBranding } from "./types";

// Type definitions for pdfmake
type Content = any;
type TableCell = any;
type TDocumentDefinitions = any;

interface GeneratePDFOptions {
  proposal: Partial<Proposal>;
  project: any;
  simulation?: SimulationData;
  template: ProposalTemplateId;
  charts?: {
    payback?: string;
    energyFlow?: string;
    monthlyGeneration?: string;
  };
  logoBase64?: string;
}

// Generate 25-year projection
const generateProjection = (simulation: SimulationData) => {
  const rows = [];
  let cumulativeSavings = 0;
  const annualDegradation = 0.005;
  const tariffEscalation = 0.08;

  for (let year = 1; year <= 25; year++) {
    const degradationFactor = Math.pow(1 - annualDegradation, year - 1);
    const escalationFactor = Math.pow(1 + tariffEscalation, year - 1);
    const yearSavings = simulation.annualSavings * degradationFactor * escalationFactor;
    cumulativeSavings += yearSavings;

    rows.push({
      year,
      generation: Math.round(simulation.annualSolarGeneration * degradationFactor),
      savings: Math.round(yearSavings),
      cumulative: Math.round(cumulativeSavings),
      roi: ((cumulativeSavings - simulation.systemCost) / simulation.systemCost) * 100,
    });
  }
  return rows;
};

export async function generateProposalPDF(options: GeneratePDFOptions): Promise<void> {
  const { proposal, project, simulation, template: templateId, charts, logoBase64 } = options;
  const template = PROPOSAL_TEMPLATES[templateId];
  const branding = proposal.branding as ProposalBranding;

  // Use branding colors or template defaults
  const primaryColor = branding?.primary_color || template.colors.accentColor;
  const secondaryColor = branding?.secondary_color || template.colors.headerBg;

  // Build document definition
  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [20, 20, 20, 40],
    
    // Document metadata
    info: {
      title: `Solar Proposal - ${project?.name || "Client"}`,
      author: branding?.company_name || "Solar Provider",
      subject: "Solar Installation Proposal",
    },

    // Footer on every page
    footer: (currentPage, pageCount) => ({
      columns: [
        {
          text: [
            branding?.contact_email || "",
            branding?.contact_email && branding?.contact_phone ? " • " : "",
            branding?.contact_phone || "",
            (branding?.contact_email || branding?.contact_phone) && branding?.website ? " • " : "",
            branding?.website || "",
          ].join(""),
          fontSize: 7,
          color: COLORS.muted,
          margin: [20, 10, 0, 0],
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          fontSize: 7,
          color: COLORS.muted,
          alignment: "right",
          margin: [0, 10, 20, 0],
        },
      ],
    }),

    // Styles
    styles: {
      ...defaultStyles,
      coverTitle: {
        fontSize: 26,
        bold: true,
        color: COLORS.white,
      },
      coverSubtitle: {
        fontSize: 14,
        color: COLORS.white,
      },
    },

    // Content
    content: buildProposalContent(proposal, project, simulation, template, branding, primaryColor, secondaryColor, charts, logoBase64),
  };

  // Generate and download PDF
  pdfMake.createPdf(docDefinition).download(`${project?.name || "Proposal"}_v${proposal.version || 1}.pdf`);
}

function buildProposalContent(
  proposal: Partial<Proposal>,
  project: any,
  simulation: SimulationData | undefined,
  template: ProposalTemplate,
  branding: ProposalBranding | undefined,
  primaryColor: string,
  secondaryColor: string,
  charts?: GeneratePDFOptions["charts"],
  logoBase64?: string
): Content[] {
  const content: Content[] = [];

  // ========== COVER PAGE ==========
  // Header background
  content.push({
    canvas: [
      {
        type: "rect",
        x: -20,
        y: -20,
        w: 595,
        h: 70,
        color: secondaryColor,
      },
      {
        type: "rect",
        x: -20,
        y: 50,
        w: 595,
        h: 4,
        color: primaryColor,
      },
    ],
  });

  // Logo and title
  if (logoBase64) {
    content.push({
      columns: [
        {
          image: logoBase64,
          width: 50,
          margin: [0, -50, 0, 0],
        },
        {
          stack: [
            { text: branding?.company_name || "Solar Proposal", style: "coverTitle", margin: [10, -45, 0, 0] },
            { text: `Prepared for: ${project?.name || "Client"}`, style: "coverSubtitle", margin: [10, 5, 0, 0] },
          ],
        },
      ],
    });
  } else {
    content.push({
      stack: [
        { text: branding?.company_name || "Solar Proposal", style: "coverTitle", margin: [0, -45, 0, 0] },
        { text: `Prepared for: ${project?.name || "Client"}`, style: "coverSubtitle", margin: [0, 5, 0, 0] },
      ],
    });
  }

  // Version and date
  content.push({
    columns: [
      { text: "" },
      {
        stack: [
          { text: `Version ${proposal.version || 1}`, fontSize: 10, color: COLORS.white, alignment: "right", margin: [0, -60, 0, 0] },
          {
            text: new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }),
            fontSize: 9,
            color: COLORS.white,
            alignment: "right",
            margin: [0, 2, 0, 0],
          },
        ],
      },
    ],
    margin: [0, 0, 0, 40],
  });

  // ========== KEY METRICS ==========
  if (simulation) {
    const metrics = [
      { label: "System Size", value: `${simulation.solarCapacity} kWp` },
      { label: "Annual Savings", value: formatCurrency(simulation.annualSavings) },
      { label: "Payback", value: `${simulation.paybackYears.toFixed(1)} years` },
      { label: "25-Year ROI", value: `${simulation.roiPercentage.toFixed(0)}%` },
    ];

    content.push({
      columns: metrics.map((metric) => ({
        stack: [
          { text: metric.label, fontSize: 9, color: COLORS.muted, margin: [0, 0, 0, 4] },
          { text: metric.value, fontSize: 14, bold: true, color: primaryColor },
        ],
        alignment: "center",
        margin: [0, 0, 0, 20] as [number, number, number, number],
      })),
      margin: [0, 20, 0, 20],
    });
  }

  // ========== EXECUTIVE SUMMARY ==========
  content.push({ text: "Executive Summary", style: "sectionTitle" });

  const summaryText =
    proposal.executive_summary ||
    `This proposal outlines a ${simulation?.solarCapacity || 0} kWp solar PV system installation for ${project?.name}. ` +
      `The system is projected to generate ${formatNumber(simulation?.annualSolarGeneration || 0)} kWh annually, ` +
      `resulting in estimated annual savings of ${formatCurrency(simulation?.annualSavings || 0)} ` +
      `with a payback period of ${(simulation?.paybackYears || 0).toFixed(1)} years.`;

  content.push({
    text: summaryText,
    style: "bodyText",
    margin: [0, 0, 0, 15],
  });

  // ========== SITE OVERVIEW ==========
  content.push({ text: "Site Overview", style: "sectionTitle" });

  content.push({
    table: {
      widths: [120, "*"],
      body: [
        [
          { text: "Location", bold: true, color: COLORS.secondary },
          { text: project?.location || "Not specified", color: COLORS.secondary },
        ],
        [
          { text: "Total Area", bold: true, color: COLORS.secondary },
          { text: `${project?.total_area_sqm?.toLocaleString() || "—"} m²`, color: COLORS.secondary },
        ],
        [
          { text: "Connection Size", bold: true, color: COLORS.secondary },
          { text: `${project?.connection_size_kva || "—"} kVA`, color: COLORS.secondary },
        ],
        [
          { text: "Tariff", bold: true, color: COLORS.secondary },
          { text: simulation?.tariffName || "Standard", color: COLORS.secondary },
        ],
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 15],
  });

  // ========== SYSTEM SPECIFICATION ==========
  content.push({ text: "System Specification", style: "sectionTitle" });

  content.push({
    table: {
      widths: [150, "*"],
      body: [
        [
          { text: "Solar Capacity", bold: true, fillColor: "#f8fafc" },
          { text: `${simulation?.solarCapacity || 0} kWp`, fillColor: "#f8fafc" },
        ],
        [
          { text: "Battery Storage", bold: true },
          { text: `${simulation?.batteryCapacity || 0} kWh` },
        ],
        [
          { text: "Battery Power", bold: true, fillColor: "#f8fafc" },
          { text: `${simulation?.batteryPower || 0} kW`, fillColor: "#f8fafc" },
        ],
        [
          { text: "Annual Generation", bold: true },
          { text: `${formatNumber(simulation?.annualSolarGeneration || 0)} kWh/year` },
        ],
        [
          { text: "Grid Import (Annual)", bold: true, fillColor: "#f8fafc" },
          { text: `${formatNumber(simulation?.annualGridImport || 0)} kWh`, fillColor: "#f8fafc" },
        ],
        [
          { text: "Grid Export (Annual)", bold: true },
          { text: `${formatNumber(simulation?.annualGridExport || 0)} kWh` },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => "#e5e7eb",
    },
    margin: [0, 0, 0, 15],
  });

  // ========== CHARTS PAGE ==========
  if (charts && Object.values(charts).some(Boolean)) {
    content.push({ text: "", pageBreak: "before" });
    content.push({ text: "Visual Analysis", style: "header", margin: [0, 0, 0, 15] });

    if (charts.payback) {
      content.push({
        image: charts.payback,
        width: 500,
        margin: [0, 0, 0, 15],
      });
    }

    if (charts.energyFlow || charts.monthlyGeneration) {
      const chartColumns: Content[] = [];
      if (charts.energyFlow) {
        chartColumns.push({
          image: charts.energyFlow,
          width: 250,
        });
      }
      if (charts.monthlyGeneration) {
        chartColumns.push({
          image: charts.monthlyGeneration,
          width: 250,
        });
      }
      content.push({ columns: chartColumns, margin: [0, 0, 0, 15] });
    }
  }

  // ========== 25-YEAR PROJECTION ==========
  content.push({ text: "", pageBreak: "before" });
  content.push({ text: "25-Year Financial Projection", style: "header", margin: [0, 0, 0, 15] });

  if (simulation) {
    const projection = generateProjection(simulation);
    const tableBody: TableCell[][] = [
      [
        { text: "Year", bold: true, fillColor: primaryColor, color: COLORS.white },
        { text: "Generation (kWh)", bold: true, fillColor: primaryColor, color: COLORS.white },
        { text: "Annual Savings", bold: true, fillColor: primaryColor, color: COLORS.white },
        { text: "Cumulative Savings", bold: true, fillColor: primaryColor, color: COLORS.white },
        { text: "ROI", bold: true, fillColor: primaryColor, color: COLORS.white },
      ],
    ];

    projection.forEach((row, idx) => {
      const bgColor = idx % 2 === 0 ? "#fafafa" : "#ffffff";
      tableBody.push([
        { text: row.year.toString(), fillColor: bgColor },
        { text: formatNumber(row.generation), fillColor: bgColor },
        { text: `R ${formatNumber(row.savings)}`, fillColor: bgColor },
        { text: `R ${formatNumber(row.cumulative)}`, fillColor: bgColor },
        { text: `${row.roi.toFixed(1)}%`, fillColor: bgColor },
      ]);
    });

    content.push({
      table: {
        headerRows: 1,
        widths: ["auto", "*", "*", "*", "auto"],
        body: tableBody,
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => "#e5e7eb",
        vLineColor: () => "#e5e7eb",
      },
      fontSize: 8,
      margin: [0, 0, 0, 15],
    });
  }

  // ========== ASSUMPTIONS & DISCLAIMERS ==========
  content.push({ text: "", pageBreak: "before" });
  content.push({ text: "Assumptions", style: "sectionTitle" });

  const assumptionsText =
    proposal.assumptions || "• 0.5% annual panel degradation\n• 8% annual tariff escalation\n• Standard weather conditions";

  content.push({
    text: assumptionsText,
    style: "bodyText",
    margin: [0, 0, 0, 15],
  });

  if (proposal.disclaimers) {
    content.push({ text: "Disclaimers", style: "sectionTitle" });
    content.push({
      text: proposal.disclaimers,
      fontSize: 9,
      color: COLORS.muted,
      margin: [0, 0, 0, 15],
    });
  }

  // ========== SIGNATURE SECTION ==========
  content.push({ text: "", margin: [0, 40, 0, 0] });
  
  content.push({
    columns: [
      {
        stack: [
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5, lineColor: "#cccccc" }] },
          { text: proposal.prepared_by || "", fontSize: 10, margin: [0, 5, 0, 0] },
          { text: "Prepared By", fontSize: 8, color: COLORS.muted, margin: [0, 5, 0, 0] },
        ],
      },
      {
        stack: [
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.5, lineColor: "#cccccc" }] },
          { text: proposal.client_signature || "", fontSize: 10, margin: [0, 5, 0, 0] },
          { text: "Client Signature", fontSize: 8, color: COLORS.muted, margin: [0, 5, 0, 0] },
        ],
        alignment: "right",
      },
    ],
  });

  return content;
}
