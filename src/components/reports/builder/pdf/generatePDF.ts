import { pdfMake, COLORS, defaultStyles, loadImageAsBase64, formatCurrency, formatNumber } from "@/lib/pdfmake/pdfmakeConfig";
import { ReportSegment, SegmentType } from "../../types";

// Type definitions for pdfmake (inline to avoid module resolution issues)
type Content = any;
type TableCell = any;
type TDocumentDefinitions = any;

interface PDFBranding {
  company_name?: string | null;
  logo_url?: string | null;
  primary_color?: string;
  secondary_color?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  address?: string | null;
  client_logo_url?: string | null;
}

interface PDFGeneratorConfig {
  reportName: string;
  projectName: string;
  simulationData: {
    solarCapacityKwp: number;
    batteryCapacityKwh: number;
    annualSavings: number;
    paybackYears: number;
    roiPercent: number;
    co2AvoidedTons: number;
    dcAcRatio: number;
  };
  projectDetails?: {
    location?: string;
    total_area_sqm?: number;
    connection_size_kva?: number;
    tariffs?: {
      name?: string;
      tariff_type?: string;
      municipalities?: { name?: string };
    };
  };
  branding?: PDFBranding;
  aiNarratives?: Partial<Record<SegmentType, { narrative: string; keyHighlights: string[] }>>;
  aiNarrativeEnabled?: boolean;
  editedNarratives?: Partial<Record<SegmentType, string>>;
}

const SEGMENT_TITLES: Record<SegmentType, string> = {
  executive_summary: "Executive Summary",
  dcac_comparison: "DC/AC Ratio Analysis",
  energy_flow: "Energy Flow Diagram",
  monthly_yield: "Monthly Yield Analysis",
  payback_timeline: "Financial Payback",
  sensitivity_analysis: "Sensitivity Analysis",
  savings_breakdown: "Savings Breakdown",
  environmental_impact: "Environmental Impact",
  engineering_specs: "Engineering Specifications",
  ai_infographics: "AI Infographics",
  tariff_details: "Tariff Analysis",
  sizing_comparison: "Sizing Alternatives",
  custom_notes: "Notes & Annotations",
};

export async function generateProfessionalPDF(
  segments: ReportSegment[],
  config: PDFGeneratorConfig
): Promise<void> {
  const { reportName, projectName, simulationData, projectDetails, branding, aiNarratives, aiNarrativeEnabled, editedNarratives } = config;
  const enabledSegments = segments.filter(s => s.enabled).sort((a, b) => a.order - b.order);

  // Load logos if provided
  let companyLogoData: string | null = null;
  let clientLogoData: string | null = null;
  
  if (branding?.logo_url) {
    companyLogoData = await loadImageAsBase64(branding.logo_url);
  }
  if (branding?.client_logo_url) {
    clientLogoData = await loadImageAsBase64(branding.client_logo_url);
  }

  const getNarrative = (segmentId: SegmentType): string | undefined => {
    if (!aiNarrativeEnabled) return undefined;
    const edited = editedNarratives?.[segmentId];
    if (edited !== undefined) return edited;
    return aiNarratives?.[segmentId]?.narrative;
  };

  const totalPages = enabledSegments.length + 1;

  // Build document content
  const content: Content[] = [];

  // ========== COVER PAGE ==========
  content.push(...buildCoverPage(projectName, simulationData, enabledSegments, branding, companyLogoData, clientLogoData));

  // ========== CONTENT PAGES ==========
  for (let i = 0; i < enabledSegments.length; i++) {
    const segment = enabledSegments[i];
    
    // Page break before each section
    content.push({ text: "", pageBreak: "before" });
    
    // Page header
    content.push({
      canvas: [
        { type: "rect", x: -15, y: -20, w: 595, h: 25, color: COLORS.primary },
      ],
    });
    content.push({
      text: SEGMENT_TITLES[segment.type],
      fontSize: 14,
      bold: true,
      color: COLORS.white,
      margin: [0, -18, 0, 20],
    });

    // Render content based on segment type
    const narrative = getNarrative(segment.type);
    
    switch (segment.type) {
      case "executive_summary":
        content.push(...renderExecutiveSummary(simulationData, projectDetails, narrative));
        break;
      case "tariff_details":
        content.push(...renderTariffDetails(projectDetails, narrative));
        break;
      case "dcac_comparison":
        content.push(...renderDcAcComparison(simulationData, narrative));
        break;
      case "payback_timeline":
        content.push(...renderPaybackTimeline(simulationData, narrative));
        break;
      case "environmental_impact":
        content.push(...renderEnvironmentalImpact(simulationData, narrative));
        break;
      case "monthly_yield":
        content.push(...renderMonthlyYield(simulationData, narrative));
        break;
      case "energy_flow":
        content.push(...renderEnergyFlow(simulationData, narrative));
        break;
      case "sizing_comparison":
        content.push(...renderSizingComparison(simulationData, narrative));
        break;
      case "sensitivity_analysis":
        content.push(...renderSensitivityAnalysis(simulationData, narrative));
        break;
      case "engineering_specs":
        content.push(...renderEngineeringSpecs(simulationData, narrative));
        break;
      default:
        content.push({ text: "Content for this section.", style: "bodyText" });
    }
  }

  // Document definition
  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [15, 20, 15, 25],
    
    info: {
      title: reportName,
      author: branding?.company_name || "SolarSim Pro",
      subject: "Solar Energy Report",
    },

    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        {
          text: branding?.company_name || "Generated by SolarSim Pro",
          fontSize: 7,
          color: COLORS.muted,
          margin: [15, 0, 0, 0],
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          fontSize: 7,
          color: COLORS.muted,
          alignment: "right",
          margin: [0, 0, 15, 0],
        },
      ],
      margin: [0, 5, 0, 0],
    }),

    styles: defaultStyles,
    content,
  };

  pdfMake.createPdf(docDefinition).download(`${reportName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ========== COVER PAGE BUILDER ==========
function buildCoverPage(
  projectName: string,
  data: PDFGeneratorConfig["simulationData"],
  enabledSegments: ReportSegment[],
  branding?: PDFBranding,
  companyLogoData?: string | null,
  clientLogoData?: string | null
): Content[] {
  const content: Content[] = [];

  // Header band
  content.push({
    canvas: [
      { type: "rect", x: -15, y: -20, w: 595, h: 60, color: COLORS.secondary },
    ],
  });

  // Logos and title
  const headerStack: Content[] = [];
  
  if (companyLogoData || clientLogoData) {
    const logoColumns: Content[] = [];
    if (companyLogoData) {
      logoColumns.push({ image: companyLogoData, width: 60, margin: [0, -50, 0, 0] });
    }
    logoColumns.push({ text: "" }); // Spacer
    if (clientLogoData) {
      logoColumns.push({ image: clientLogoData, width: 60, alignment: "right", margin: [0, -50, 0, 0] });
    }
    content.push({ columns: logoColumns });
  }

  content.push({
    text: projectName,
    fontSize: 26,
    bold: true,
    color: COLORS.white,
    margin: [0, companyLogoData || clientLogoData ? -25 : -40, 0, 0],
  });

  content.push({
    text: "Solar Energy Proposal",
    fontSize: 13,
    color: COLORS.white,
    margin: [0, 5, 0, 0],
  });

  content.push({
    text: new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" }),
    fontSize: 9,
    color: COLORS.white,
    alignment: "right",
    margin: [0, -18, 0, 30],
  });

  // Key metrics row
  const metrics = [
    { label: "Solar Capacity", value: `${data.solarCapacityKwp} kWp`, color: COLORS.primary },
    { label: "Battery Storage", value: `${data.batteryCapacityKwh} kWh`, color: COLORS.accent },
    { label: "Annual Savings", value: formatCurrency(data.annualSavings, true), color: COLORS.warning },
  ];

  content.push({
    columns: metrics.map(m => ({
      stack: [
        { text: m.value, fontSize: 18, bold: true, color: m.color },
        { text: m.label, fontSize: 9, color: COLORS.muted, margin: [0, 4, 0, 0] },
      ],
      alignment: "center",
    })),
    margin: [0, 20, 0, 20],
  });

  // ROI and Payback cards
  content.push({
    columns: [
      {
        stack: [
          { text: "Return on Investment", fontSize: 10, bold: true, color: COLORS.secondary },
          { text: `${Math.round(data.roiPercent)}%`, fontSize: 32, bold: true, color: COLORS.primary, margin: [0, 5, 0, 0] },
        ],
        width: "50%",
        margin: [0, 0, 10, 0],
      },
      {
        stack: [
          { text: "Payback Period", fontSize: 10, bold: true, color: COLORS.secondary },
          { text: `${data.paybackYears.toFixed(1)} yrs`, fontSize: 32, bold: true, color: COLORS.primary, margin: [0, 5, 0, 0] },
        ],
        width: "50%",
      },
    ],
    margin: [0, 10, 0, 25],
  });

  // Table of Contents
  content.push({
    text: "Report Contents",
    fontSize: 14,
    bold: true,
    color: COLORS.secondary,
    margin: [0, 10, 0, 10],
  });

  enabledSegments.forEach((segment, index) => {
    content.push({
      columns: [
        { text: (index + 1).toString().padStart(2, "0"), fontSize: 10, color: COLORS.muted, width: 20 },
        { text: SEGMENT_TITLES[segment.type], fontSize: 10, color: COLORS.secondary },
        { text: `Page ${index + 2}`, fontSize: 10, color: COLORS.muted, alignment: "right" },
      ],
      margin: [0, 3, 0, 3],
    });
  });

  return content;
}

// ========== NARRATIVE BOX HELPER ==========
function createNarrativeBox(narrative: string | undefined, title: string): Content[] {
  if (!narrative) return [];

  return [{
    stack: [
      {
        columns: [
          { text: title, fontSize: 9, bold: true, color: COLORS.primaryDark },
          {
            text: "AI-Generated",
            fontSize: 6,
            color: COLORS.primaryDark,
            alignment: "right",
            background: "#dcfce7",
            margin: [4, 2, 4, 2],
          },
        ],
      },
      { text: narrative, fontSize: 9, color: "#3c3c3c", margin: [0, 5, 0, 0], lineHeight: 1.3 },
    ],
    fillColor: COLORS.background,
    margin: [0, 0, 0, 15],
  }];
}

// ========== SECTION RENDERERS ==========
function renderExecutiveSummary(data: PDFGeneratorConfig["simulationData"], projectDetails?: PDFGeneratorConfig["projectDetails"], narrative?: string): Content[] {
  const content: Content[] = [];

  content.push(...createNarrativeBox(narrative, "Executive Summary"));

  // Key metrics grid
  const keyMetrics = [
    { label: "Solar Capacity", value: `${data.solarCapacityKwp}`, unit: "kWp", color: COLORS.primary },
    { label: "Battery Storage", value: `${data.batteryCapacityKwh}`, unit: "kWh", color: COLORS.accent },
    { label: "Annual Savings", value: formatCurrency(data.annualSavings / 1000, false) + "k", unit: "/year", color: COLORS.warning },
    { label: "Payback Period", value: data.paybackYears.toFixed(1), unit: "years", color: COLORS.primaryDark },
  ];

  content.push({
    columns: keyMetrics.map(m => ({
      stack: [
        { text: m.value, fontSize: 16, bold: true, color: COLORS.white },
        { text: m.unit, fontSize: 8, color: COLORS.white },
        { text: m.label, fontSize: 7, color: COLORS.white, margin: [0, 5, 0, 0] },
      ],
      alignment: "center",
      fillColor: m.color,
      margin: [2, 8, 2, 8],
    })),
    margin: [0, 0, 0, 15],
  });

  // Project details table
  const tableData: string[][] = [];
  if (projectDetails?.location) tableData.push(["Location", projectDetails.location]);
  if (projectDetails?.total_area_sqm) tableData.push(["Building Area", `${Number(projectDetails.total_area_sqm).toLocaleString()} m²`]);
  if (projectDetails?.connection_size_kva) tableData.push(["Grid Connection", `${projectDetails.connection_size_kva} kVA`]);
  if (projectDetails?.tariffs?.name) tableData.push(["Tariff", projectDetails.tariffs.name]);
  if (data.dcAcRatio) tableData.push(["DC/AC Ratio", `${data.dcAcRatio.toFixed(2)}:1`]);

  if (tableData.length > 0) {
    content.push({
      table: {
        headerRows: 1,
        widths: [120, "*"],
        body: [
          [
            { text: "Parameter", bold: true, fillColor: COLORS.primary, color: COLORS.white },
            { text: "Value", bold: true, fillColor: COLORS.primary, color: COLORS.white },
          ],
          ...tableData.map((row, idx) => [
            { text: row[0], fillColor: idx % 2 === 0 ? "#f8fafc" : "#ffffff" },
            { text: row[1], fillColor: idx % 2 === 0 ? "#f8fafc" : "#ffffff" },
          ]),
        ],
      },
      layout: "lightHorizontalLines",
      fontSize: 9,
    });
  }

  return content;
}

function renderTariffDetails(projectDetails?: PDFGeneratorConfig["projectDetails"], narrative?: string): Content[] {
  const content: Content[] = [];

  content.push(...createNarrativeBox(narrative, "Tariff Overview"));

  content.push({
    text: "Time-of-Use Rate Periods (Weekday)",
    fontSize: 12,
    bold: true,
    color: COLORS.secondary,
    margin: [0, 0, 0, 10],
  });

  // TOU Period cards
  const periods = [
    { name: "Peak", hours: "06:00-08:00, 18:00-21:00", color: COLORS.danger, desc: "Highest rates" },
    { name: "Standard", hours: "08:00-18:00, 21:00-22:00", color: COLORS.warning, desc: "Mid-tier rates" },
    { name: "Off-Peak", hours: "22:00-06:00", color: COLORS.primary, desc: "Lowest rates" },
  ];

  content.push({
    columns: periods.map(p => ({
      stack: [
        { text: p.name, fontSize: 12, bold: true, color: COLORS.white },
        { text: p.hours, fontSize: 8, color: COLORS.white, margin: [0, 5, 0, 0] },
        { text: p.desc, fontSize: 8, color: COLORS.white },
      ],
      fillColor: p.color,
      margin: [5, 10, 5, 10],
      alignment: "center",
    })),
    margin: [0, 0, 0, 20],
  });

  // Seasonal Calendar
  content.push({
    text: "Seasonal Calendar",
    fontSize: 12,
    bold: true,
    color: COLORS.secondary,
    margin: [0, 10, 0, 10],
  });

  const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  content.push({
    table: {
      widths: Array(12).fill("*"),
      body: [
        months.map((m, i) => ({
          text: m,
          alignment: "center",
          bold: true,
          color: COLORS.white,
          fillColor: i >= 5 && i <= 7 ? COLORS.danger : COLORS.primary,
          margin: [0, 5, 0, 5],
        })),
      ],
    },
    layout: "noBorders",
    margin: [0, 0, 0, 15],
  });

  // Legend
  content.push({
    columns: [
      { canvas: [{ type: "rect", x: 0, y: 0, w: 12, h: 8, color: COLORS.danger }] },
      { text: "High Demand Season (Winter)", fontSize: 8, color: COLORS.muted, margin: [5, 0, 20, 0] },
      { canvas: [{ type: "rect", x: 0, y: 0, w: 12, h: 8, color: COLORS.primary }] },
      { text: "Low Demand Season (Summer)", fontSize: 8, color: COLORS.muted, margin: [5, 0, 0, 0] },
    ],
  });

  return content;
}

function renderDcAcComparison(data: PDFGeneratorConfig["simulationData"], narrative?: string): Content[] {
  const content: Content[] = [];
  const ratio = data.dcAcRatio || 1.3;

  content.push(...createNarrativeBox(narrative, "DC/AC Analysis Overview"));

  content.push({
    text: "DC/AC Oversizing Comparison",
    fontSize: 12,
    bold: true,
    color: COLORS.secondary,
    margin: [0, 0, 0, 10],
  });

  const calcYield = (r: number) => Math.round((1 + (r - 1) * 0.6) * 100);
  const scenarios = [
    { ratio: 1.0, label: "Conservative", yield: calcYield(1.0), color: COLORS.muted },
    { ratio: ratio, label: "Current Design", yield: calcYield(ratio), color: COLORS.primary, isCurrent: true },
    { ratio: 1.5, label: "Aggressive", yield: calcYield(1.5), color: COLORS.warning },
  ];

  content.push({
    columns: scenarios.map(s => ({
      stack: [
        { text: `${s.ratio.toFixed(2)}:1`, fontSize: 16, bold: true, color: s.color, alignment: "center" },
        { text: s.label, fontSize: 9, color: COLORS.muted, alignment: "center", margin: [0, 5, 0, 0] },
        { text: `${s.yield}%`, fontSize: 20, bold: true, color: s.color, alignment: "center", margin: [0, 10, 0, 0] },
        { text: "yield", fontSize: 8, color: COLORS.muted, alignment: "center" },
      ],
      fillColor: s.isCurrent ? "#f0fdf4" : "#fafafa",
      margin: [5, 10, 5, 10],
    })),
    margin: [0, 0, 0, 20],
  });

  // Energy gain highlight
  const gainPct = calcYield(ratio) - calcYield(1.0);
  content.push({
    stack: [
      { text: `Energy Gain vs 1:1 Baseline: +${gainPct}%`, fontSize: 10, bold: true, color: "#166534" },
      { text: "Additional energy captured during morning and evening hours", fontSize: 9, color: "#166534", margin: [0, 5, 0, 0] },
    ],
    fillColor: "#dcfce7",
    margin: [10, 10, 10, 10],
  });

  return content;
}

function renderPaybackTimeline(data: PDFGeneratorConfig["simulationData"], narrative?: string): Content[] {
  const content: Content[] = [];
  const payback = data.paybackYears;
  const annualSave = data.annualSavings;
  const systemCost = data.solarCapacityKwp * 12000 + data.batteryCapacityKwh * 6000;
  const total25yr = annualSave * 25 - systemCost;

  content.push(...createNarrativeBox(narrative, "Financial Analysis"));

  content.push({
    text: "Investment Summary",
    fontSize: 12,
    bold: true,
    color: COLORS.secondary,
    margin: [0, 0, 0, 10],
  });

  const finMetrics = [
    { label: "Initial Investment", value: `-${formatCurrency(systemCost, true)}`, color: COLORS.danger },
    { label: "Payback Period", value: `${payback.toFixed(1)} Years`, color: COLORS.warning },
    { label: "25-Year Net Returns", value: `+${formatCurrency(total25yr, true)}`, color: COLORS.primary },
  ];

  content.push({
    columns: finMetrics.map(m => ({
      stack: [
        { text: m.value, fontSize: 14, bold: true, color: COLORS.white },
        { text: m.label, fontSize: 8, color: COLORS.white, margin: [0, 5, 0, 0] },
      ],
      fillColor: m.color,
      alignment: "center",
      margin: [5, 10, 5, 10],
    })),
    margin: [0, 0, 0, 20],
  });

  // Cash flow table
  content.push({
    text: "Projected Cash Flow",
    fontSize: 11,
    bold: true,
    color: COLORS.secondary,
    margin: [0, 10, 0, 10],
  });

  const tableBody: TableCell[][] = [
    [
      { text: "Year", bold: true, fillColor: COLORS.primary, color: COLORS.white },
      { text: "Annual Savings", bold: true, fillColor: COLORS.primary, color: COLORS.white },
      { text: "Cumulative", bold: true, fillColor: COLORS.primary, color: COLORS.white },
      { text: "Net Position", bold: true, fillColor: COLORS.primary, color: COLORS.white },
    ],
  ];

  for (let yr = 1; yr <= 10; yr++) {
    const cumSavings = annualSave * yr;
    const netPosition = cumSavings - systemCost;
    const bgColor = yr % 2 === 0 ? "#f8fafc" : "#ffffff";
    tableBody.push([
      { text: `Year ${yr}`, fillColor: bgColor },
      { text: formatCurrency(annualSave / 1000, false) + "k", fillColor: bgColor, alignment: "center" },
      { text: formatCurrency(cumSavings / 1000, false) + "k", fillColor: bgColor, alignment: "center" },
      {
        text: netPosition >= 0 ? `+${formatCurrency(netPosition / 1000, false)}k` : `-${formatCurrency(Math.abs(netPosition) / 1000, false)}k`,
        fillColor: bgColor,
        alignment: "center",
        color: netPosition >= 0 ? COLORS.primary : COLORS.danger,
      },
    ]);
  }

  content.push({
    table: {
      headerRows: 1,
      widths: ["auto", "*", "*", "*"],
      body: tableBody,
    },
    layout: "lightHorizontalLines",
    fontSize: 8,
  });

  return content;
}

function renderEnvironmentalImpact(data: PDFGeneratorConfig["simulationData"], narrative?: string): Content[] {
  const content: Content[] = [];
  const co2 = data.co2AvoidedTons;
  const treesEquiv = Math.round(co2 * 45);
  const lifetime25 = co2 * 25;

  content.push(...createNarrativeBox(narrative, "Environmental Benefits"));

  content.push({
    text: "Annual Environmental Impact",
    fontSize: 12,
    bold: true,
    color: COLORS.secondary,
    margin: [0, 0, 0, 10],
  });

  content.push({
    columns: [
      {
        stack: [
          { text: `${Math.round(co2)}`, fontSize: 36, bold: true, color: COLORS.primary },
          { text: "tonnes CO₂/year", fontSize: 10, color: COLORS.muted },
        ],
        fillColor: "#dcfce7",
        alignment: "center",
        margin: [15, 15, 15, 15],
        width: "50%",
      },
      {
        stack: [
          { text: `${treesEquiv.toLocaleString()}`, fontSize: 28, bold: true, color: COLORS.primary },
          { text: "trees equivalent", fontSize: 10, color: COLORS.muted },
        ],
        fillColor: "#f0fdf4",
        alignment: "center",
        margin: [15, 15, 15, 15],
        width: "50%",
      },
    ],
    margin: [0, 0, 0, 20],
  });

  // 25-year impact table
  content.push({
    text: "25-Year Lifetime Impact",
    fontSize: 12,
    bold: true,
    color: COLORS.secondary,
    margin: [0, 10, 0, 10],
  });

  content.push({
    table: {
      headerRows: 1,
      widths: ["*", "*"],
      body: [
        [
          { text: "Metric", bold: true, fillColor: COLORS.primary, color: COLORS.white },
          { text: "Value", bold: true, fillColor: COLORS.primary, color: COLORS.white },
        ],
        [{ text: "CO₂ Avoided" }, { text: `${Math.round(lifetime25 / 1000).toLocaleString()}k tonnes` }],
        [{ text: "Trees Equivalent", fillColor: "#f8fafc" }, { text: `${Math.round(lifetime25 * 45 / 1000).toLocaleString()}k trees`, fillColor: "#f8fafc" }],
        [{ text: "Cars Removed" }, { text: `${Math.round(lifetime25 / 4).toLocaleString()} cars/year` }],
      ],
    },
    layout: "lightHorizontalLines",
    fontSize: 10,
  });

  return content;
}

function renderMonthlyYield(data: PDFGeneratorConfig["simulationData"], narrative?: string): Content[] {
  const content: Content[] = [];

  content.push(...createNarrativeBox(narrative, "Generation Profile"));

  const monthlyFactors = [1.1, 1.05, 0.95, 0.85, 0.75, 0.7, 0.72, 0.8, 0.9, 1.0, 1.05, 1.1];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const annualKwh = data.solarCapacityKwp * 1600;
  const avgMonthly = annualKwh / 12;
  const monthlyGen = monthlyFactors.map(f => avgMonthly * f);

  content.push({
    text: "12-Month Solar Generation Forecast",
    fontSize: 12,
    bold: true,
    color: COLORS.secondary,
    margin: [0, 0, 0, 10],
  });

  content.push({
    table: {
      widths: Array(12).fill("*"),
      body: [
        monthNames.map(m => ({ text: m, bold: true, fillColor: COLORS.primary, color: COLORS.white, alignment: "center", fontSize: 8 })),
        monthlyGen.map(g => ({ text: `${Math.round(g / 1000)}k`, alignment: "center", fontSize: 8 })),
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 20],
  });

  // Summary stats
  content.push({
    columns: [
      {
        stack: [
          { text: `${Math.round(annualKwh / 1000)} MWh`, fontSize: 12, bold: true, color: COLORS.primary },
          { text: "Annual Generation", fontSize: 8, color: COLORS.muted },
        ],
        fillColor: "#f0fdf4",
        alignment: "center",
        margin: [10, 10, 10, 10],
      },
      {
        stack: [
          { text: `${Math.round(avgMonthly / 1000)} MWh`, fontSize: 12, bold: true, color: COLORS.primary },
          { text: "Monthly Average", fontSize: 8, color: COLORS.muted },
        ],
        fillColor: "#f0fdf4",
        alignment: "center",
        margin: [10, 10, 10, 10],
      },
      {
        stack: [
          { text: "1,600 kWh/kWp", fontSize: 12, bold: true, color: COLORS.primary },
          { text: "Specific Yield", fontSize: 8, color: COLORS.muted },
        ],
        fillColor: "#f0fdf4",
        alignment: "center",
        margin: [10, 10, 10, 10],
      },
    ],
  });

  return content;
}

function renderEnergyFlow(data: PDFGeneratorConfig["simulationData"], narrative?: string): Content[] {
  const content: Content[] = [];

  const annualGen = data.solarCapacityKwp * 1600;
  const selfConsume = annualGen * 0.65;
  const gridExport = annualGen * 0.35;
  const gridImport = annualGen * 0.15;

  content.push(...createNarrativeBox(narrative, "Energy Distribution"));

  content.push({
    text: "System Energy Distribution",
    fontSize: 12,
    bold: true,
    color: COLORS.secondary,
    margin: [0, 0, 0, 10],
  });

  content.push({
    table: {
      headerRows: 1,
      widths: ["*", "*", "auto"],
      body: [
        [
          { text: "Energy Flow", bold: true, fillColor: COLORS.primary, color: COLORS.white },
          { text: "Annual Volume", bold: true, fillColor: COLORS.primary, color: COLORS.white },
          { text: "Percentage", bold: true, fillColor: COLORS.primary, color: COLORS.white },
        ],
        [{ text: "Solar Generation" }, { text: `${Math.round(annualGen / 1000)} MWh/year` }, { text: "100%" }],
        [{ text: "Self-Consumption", fillColor: "#f8fafc" }, { text: `${Math.round(selfConsume / 1000)} MWh/year`, fillColor: "#f8fafc" }, { text: "65%", fillColor: "#f8fafc" }],
        [{ text: "Grid Export" }, { text: `${Math.round(gridExport / 1000)} MWh/year` }, { text: "35%" }],
        [{ text: "Grid Import", fillColor: "#f8fafc" }, { text: `${Math.round(gridImport / 1000)} MWh/year`, fillColor: "#f8fafc" }, { text: "-", fillColor: "#f8fafc" }],
      ],
    },
    layout: "lightHorizontalLines",
    fontSize: 10,
  });

  return content;
}

function renderSizingComparison(data: PDFGeneratorConfig["simulationData"], narrative?: string): Content[] {
  const content: Content[] = [];

  content.push(...createNarrativeBox(narrative, "Sizing Analysis"));

  content.push({
    text: "System Sizing Alternatives",
    fontSize: 12,
    bold: true,
    color: COLORS.secondary,
    margin: [0, 0, 0, 10],
  });

  const costPerKwp = 12000;
  const batteryPerKwh = 6000;

  const scenarios = [
    { name: "Conservative", factor: 0.7, batFactor: 0.5 },
    { name: "Current Design", factor: 1.0, batFactor: 1.0, isCurrent: true },
    { name: "Aggressive", factor: 1.35, batFactor: 2.0 },
  ].map(s => {
    const solarKwp = Math.round(data.solarCapacityKwp * s.factor);
    const batteryKwh = Math.round(data.batteryCapacityKwh * s.batFactor);
    const systemCost = solarKwp * costPerKwp + batteryKwh * batteryPerKwh;
    const annualSavings = Math.round(data.annualSavings * s.factor);
    const paybackYears = systemCost / annualSavings;
    const roi25yr = ((annualSavings * 25 - systemCost) / systemCost) * 100;

    return { ...s, solarKwp, batteryKwh, systemCost, annualSavings, paybackYears, roi25yr };
  });

  content.push({
    table: {
      headerRows: 1,
      widths: ["*", "*", "*", "*"],
      body: [
        [
          { text: "Metric", bold: true, fillColor: COLORS.primary, color: COLORS.white },
          { text: "Conservative", bold: true, fillColor: COLORS.primary, color: COLORS.white },
          { text: "Current Design", bold: true, fillColor: COLORS.primary, color: COLORS.white },
          { text: "Aggressive", bold: true, fillColor: COLORS.primary, color: COLORS.white },
        ],
        ["Solar Capacity", `${scenarios[0].solarKwp} kWp`, { text: `${scenarios[1].solarKwp} kWp`, fillColor: "#f0fdf4" }, `${scenarios[2].solarKwp} kWp`],
        ["Battery Storage", `${scenarios[0].batteryKwh} kWh`, { text: `${scenarios[1].batteryKwh} kWh`, fillColor: "#f0fdf4" }, `${scenarios[2].batteryKwh} kWh`],
        ["System Cost", formatCurrency(scenarios[0].systemCost / 1000, false) + "k", { text: formatCurrency(scenarios[1].systemCost / 1000, false) + "k", fillColor: "#f0fdf4" }, formatCurrency(scenarios[2].systemCost / 1000, false) + "k"],
        ["Annual Savings", formatCurrency(scenarios[0].annualSavings / 1000, false) + "k", { text: formatCurrency(scenarios[1].annualSavings / 1000, false) + "k", fillColor: "#f0fdf4" }, formatCurrency(scenarios[2].annualSavings / 1000, false) + "k"],
        ["Payback Period", `${scenarios[0].paybackYears.toFixed(1)} yrs`, { text: `${scenarios[1].paybackYears.toFixed(1)} yrs`, fillColor: "#f0fdf4" }, `${scenarios[2].paybackYears.toFixed(1)} yrs`],
        ["25-Year ROI", `${Math.round(scenarios[0].roi25yr)}%`, { text: `${Math.round(scenarios[1].roi25yr)}%`, fillColor: "#f0fdf4" }, `${Math.round(scenarios[2].roi25yr)}%`],
      ],
    },
    layout: "lightHorizontalLines",
    fontSize: 9,
  });

  return content;
}

function renderSensitivityAnalysis(data: PDFGeneratorConfig["simulationData"], narrative?: string): Content[] {
  const content: Content[] = [];

  const systemCost = data.solarCapacityKwp * 12000 + data.batteryCapacityKwh * 6000;
  const basePayback = data.paybackYears;

  content.push(...createNarrativeBox(narrative, "Risk Analysis"));

  content.push({
    text: "Sensitivity Analysis - Payback Scenarios",
    fontSize: 12,
    bold: true,
    color: COLORS.secondary,
    margin: [0, 0, 0, 10],
  });

  // Tariff escalation impact
  const escRates = [0, 5, 10, 15, 20];
  const escData = escRates.map(rate => {
    if (rate === 0) return [rate + "%", basePayback.toFixed(1) + " yrs"];
    let cumSavings = 0;
    let year = 0;
    let annualSave = data.annualSavings;
    while (cumSavings < systemCost && year < 25) {
      year++;
      cumSavings += annualSave;
      annualSave *= (1 + rate / 100);
    }
    const payback = year + (systemCost - (cumSavings - annualSave)) / annualSave;
    return [rate + "%", payback.toFixed(1) + " yrs"];
  });

  content.push({
    table: {
      headerRows: 1,
      widths: ["*", "*"],
      body: [
        [
          { text: "Tariff Escalation Rate", bold: true, fillColor: COLORS.primary, color: COLORS.white },
          { text: "Payback Period", bold: true, fillColor: COLORS.primary, color: COLORS.white },
        ],
        ...escData.map((row, idx) => [
          { text: row[0], fillColor: idx % 2 === 0 ? "#f8fafc" : "#ffffff" },
          { text: row[1], fillColor: idx % 2 === 0 ? "#f8fafc" : "#ffffff" },
        ]),
      ],
    },
    layout: "lightHorizontalLines",
    fontSize: 9,
    margin: [0, 0, 0, 15],
  });

  // System cost variation
  const costVars = [-20, -10, 0, 10, 20];
  const costData = costVars.map(pct => {
    const adjustedCost = systemCost * (1 + pct / 100);
    const payback = adjustedCost / data.annualSavings;
    return [pct === 0 ? "Base" : (pct > 0 ? "+" : "") + pct + "%", payback.toFixed(1) + " yrs"];
  });

  content.push({
    table: {
      headerRows: 1,
      widths: ["*", "*"],
      body: [
        [
          { text: "System Cost Variation", bold: true, fillColor: COLORS.accent, color: COLORS.white },
          { text: "Payback Period", bold: true, fillColor: COLORS.accent, color: COLORS.white },
        ],
        ...costData.map((row, idx) => [
          { text: row[0], fillColor: idx % 2 === 0 ? "#f8fafc" : "#ffffff" },
          { text: row[1], fillColor: idx % 2 === 0 ? "#f8fafc" : "#ffffff" },
        ]),
      ],
    },
    layout: "lightHorizontalLines",
    fontSize: 9,
  });

  return content;
}

function renderEngineeringSpecs(data: PDFGeneratorConfig["simulationData"], narrative?: string): Content[] {
  const content: Content[] = [];

  content.push(...createNarrativeBox(narrative, "Technical Overview"));

  content.push({
    text: "Technical Specifications",
    fontSize: 12,
    bold: true,
    color: COLORS.secondary,
    margin: [0, 0, 0, 10],
  });

  const inverterSize = Math.round(data.solarCapacityKwp / (data.dcAcRatio || 1.3));

  content.push({
    table: {
      headerRows: 1,
      widths: ["*", "*", "*"],
      body: [
        [
          { text: "Component", bold: true, fillColor: COLORS.primary, color: COLORS.white },
          { text: "Specification", bold: true, fillColor: COLORS.primary, color: COLORS.white },
          { text: "Notes", bold: true, fillColor: COLORS.primary, color: COLORS.white },
        ],
        [{ text: "PV Array Size" }, { text: `${data.solarCapacityKwp} kWp` }, { text: "Total DC capacity" }],
        [{ text: "DC/AC Ratio", fillColor: "#f8fafc" }, { text: `${(data.dcAcRatio || 1.3).toFixed(2)}:1`, fillColor: "#f8fafc" }, { text: "Oversizing factor", fillColor: "#f8fafc" }],
        [{ text: "Inverter Capacity" }, { text: `${inverterSize} kW` }, { text: "Total AC capacity" }],
        [{ text: "Battery Storage", fillColor: "#f8fafc" }, { text: `${data.batteryCapacityKwh} kWh`, fillColor: "#f8fafc" }, { text: "Usable capacity", fillColor: "#f8fafc" }],
        [{ text: "Expected PR" }, { text: "80-82%" }, { text: "Performance ratio" }],
        [{ text: "Specific Yield", fillColor: "#f8fafc" }, { text: "~1,600 kWh/kWp/yr", fillColor: "#f8fafc" }, { text: "South Africa average", fillColor: "#f8fafc" }],
        [{ text: "System Lifetime" }, { text: "20 years" }, { text: "Warranty period" }],
      ],
    },
    layout: "lightHorizontalLines",
    fontSize: 9,
  });

  return content;
}
