import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ProposalTemplate, PROPOSAL_TEMPLATES, ProposalTemplateId } from "./templates/types";
import type { Proposal, SimulationData, ProposalBranding } from "./types";

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

// Convert hex to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

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
  const primary = hexToRgb(primaryColor);
  const secondary = hexToRgb(secondaryColor);
  const textPrimary = hexToRgb(template.colors.textPrimary);
  const textSecondary = hexToRgb(template.colors.textSecondary);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margins = { left: 20, right: 20, top: 20 };
  const contentWidth = pageWidth - margins.left - margins.right;

  // Helper functions
  const setHeadingStyle = (level: 1 | 2 | 3) => {
    doc.setFont(template.typography.headingFont, "bold");
    doc.setFontSize(template.typography.headingSizes[`h${level}`]);
    doc.setTextColor(primary.r, primary.g, primary.b);
  };

  const setBodyStyle = () => {
    doc.setFont(template.typography.bodyFont, "normal");
    doc.setFontSize(template.typography.bodySize);
    doc.setTextColor(textPrimary.r, textPrimary.g, textPrimary.b);
  };

  const setSecondaryStyle = () => {
    doc.setFont(template.typography.bodyFont, "normal");
    doc.setFontSize(template.typography.bodySize - 1);
    doc.setTextColor(textSecondary.r, textSecondary.g, textSecondary.b);
  };

  const addFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 12;

    if (template.layout.headerStyle !== "minimal") {
      doc.setFillColor(secondary.r, secondary.g, secondary.b);
      doc.rect(0, pageHeight - 15, pageWidth, 15, "F");
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setDrawColor(200, 200, 200);
      doc.line(margins.left, footerY - 5, pageWidth - margins.right, footerY - 5);
      doc.setTextColor(textSecondary.r, textSecondary.g, textSecondary.b);
    }

    doc.setFontSize(8);
    const footerText = [
      branding?.contact_email,
      branding?.contact_phone,
      branding?.website,
    ]
      .filter(Boolean)
      .join(" • ");

    if (footerText) {
      doc.text(footerText, pageWidth / 2, footerY, { align: "center" });
    }
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margins.right, footerY, { align: "right" });
  };

  // ========== COVER PAGE ==========
  let yPos = margins.top;

  if (template.layout.headerStyle === "full-width") {
    // Full-width header bar
    doc.setFillColor(secondary.r, secondary.g, secondary.b);
    doc.rect(0, 0, pageWidth, 60, "F");

    // Add accent stripe
    doc.setFillColor(primary.r, primary.g, primary.b);
    doc.rect(0, 60, pageWidth, 4, "F");

    yPos = 25;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont(template.typography.headingFont, "bold");

    // Logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", margins.left, 15, 40, 30);
        doc.text(branding?.company_name || "Solar Proposal", 70, yPos + 5);
      } catch {
        doc.text(branding?.company_name || "Solar Proposal", margins.left, yPos);
      }
    } else {
      doc.text(branding?.company_name || "Solar Proposal", margins.left, yPos);
    }

    doc.setFontSize(14);
    doc.setFont(template.typography.bodyFont, "normal");
    doc.text(`Prepared for: ${project?.name || "Client"}`, margins.left, yPos + 20);

    // Version badge on right
    doc.setFontSize(10);
    doc.text(`Version ${proposal.version || 1}`, pageWidth - margins.right, yPos, { align: "right" });
    doc.text(
      new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }),
      pageWidth - margins.right,
      yPos + 12,
      { align: "right" }
    );

    yPos = 80;
  } else if (template.layout.headerStyle === "centered") {
    // Centered classic header
    doc.setFillColor(secondary.r, secondary.g, secondary.b);
    doc.rect(margins.left - 5, 15, contentWidth + 10, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont(template.typography.headingFont, "bold");
    doc.text(branding?.company_name || "Solar Installation Proposal", pageWidth / 2, 35, { align: "center" });

    doc.setFontSize(12);
    doc.setFont(template.typography.bodyFont, "normal");
    doc.text(`Prepared for: ${project?.name}`, pageWidth / 2, 48, { align: "center" });

    yPos = 70;
  } else {
    // Minimal header
    setHeadingStyle(1);
    doc.text(branding?.company_name || "Solar Proposal", margins.left, yPos);
    yPos += 10;

    setSecondaryStyle();
    doc.text(`Prepared for: ${project?.name}`, margins.left, yPos);
    yPos += 15;

    // Accent line
    doc.setDrawColor(primary.r, primary.g, primary.b);
    doc.setLineWidth(2);
    doc.line(margins.left, yPos, margins.left + 50, yPos);
    yPos += 15;
  }

  // ========== KEY METRICS HIGHLIGHT ==========
  if (simulation) {
    const metricsY = yPos;
    const metricBoxWidth = (contentWidth - 15) / 4;

    const metrics = [
      { label: "System Size", value: `${simulation.solarCapacity} kWp`, icon: "☀" },
      { label: "Annual Savings", value: `R${simulation.annualSavings.toLocaleString()}`, icon: "💰" },
      { label: "Payback", value: `${simulation.paybackYears.toFixed(1)} years`, icon: "⏱" },
      { label: "25-Year ROI", value: `${simulation.roiPercentage.toFixed(0)}%`, icon: "📈" },
    ];

    metrics.forEach((metric, i) => {
      const x = margins.left + i * (metricBoxWidth + 5);

      if (template.layout.useCards) {
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(x, metricsY, metricBoxWidth, 35, 3, 3, "F");

        // Accent top border
        doc.setFillColor(primary.r, primary.g, primary.b);
        doc.rect(x, metricsY, metricBoxWidth, 2, "F");
      }

      setSecondaryStyle();
      doc.text(metric.label, x + metricBoxWidth / 2, metricsY + 12, { align: "center" });

      doc.setFontSize(14);
      doc.setFont(template.typography.headingFont, "bold");
      doc.setTextColor(textPrimary.r, textPrimary.g, textPrimary.b);
      doc.text(metric.value, x + metricBoxWidth / 2, metricsY + 25, { align: "center" });
    });

    yPos = metricsY + 50;
  }

  // ========== EXECUTIVE SUMMARY ==========
  setHeadingStyle(2);
  doc.text("Executive Summary", margins.left, yPos);
  yPos += 8;

  setBodyStyle();
  const summaryText =
    proposal.executive_summary ||
    `This proposal outlines a ${simulation?.solarCapacity || 0} kWp solar PV system installation for ${project?.name}. ` +
      `The system is projected to generate ${(simulation?.annualSolarGeneration || 0).toLocaleString()} kWh annually, ` +
      `resulting in estimated annual savings of R${(simulation?.annualSavings || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ` +
      `with a payback period of ${(simulation?.paybackYears || 0).toFixed(1)} years.`;

  const splitSummary = doc.splitTextToSize(summaryText, contentWidth);
  doc.text(splitSummary, margins.left, yPos);
  yPos += splitSummary.length * 5 + template.layout.sectionSpacing;

  // ========== SITE OVERVIEW ==========
  setHeadingStyle(2);
  doc.text("Site Overview", margins.left, yPos);
  yPos += 8;

  const siteData = [
    ["Location", project?.location || "Not specified"],
    ["Total Area", `${project?.total_area_sqm?.toLocaleString() || "—"} m²`],
    ["Connection Size", `${project?.connection_size_kva || "—"} kVA`],
    ["Tariff", simulation?.tariffName || "Standard"],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: siteData,
    theme: template.layout.tableStyle === "bordered" ? "grid" : "plain",
    styles: {
      fontSize: template.typography.bodySize,
      cellPadding: 4,
      textColor: [textPrimary.r, textPrimary.g, textPrimary.b],
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50 },
      1: { cellWidth: 100 },
    },
    margin: { left: margins.left },
  });

  yPos = (doc as any).lastAutoTable.finalY + template.layout.sectionSpacing;

  // ========== SYSTEM SPECIFICATION ==========
  setHeadingStyle(2);
  doc.text("System Specification", margins.left, yPos);
  yPos += 8;

  const systemData = [
    ["Solar Capacity", `${simulation?.solarCapacity || 0} kWp`],
    ["Battery Storage", `${simulation?.batteryCapacity || 0} kWh`],
    ["Battery Power", `${simulation?.batteryPower || 0} kW`],
    ["Annual Generation", `${(simulation?.annualSolarGeneration || 0).toLocaleString()} kWh/year`],
    ["Grid Import (Annual)", `${(simulation?.annualGridImport || 0).toLocaleString()} kWh`],
    ["Grid Export (Annual)", `${(simulation?.annualGridExport || 0).toLocaleString()} kWh`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: systemData,
    theme: "striped",
    styles: {
      fontSize: template.typography.bodySize,
      cellPadding: 4,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60 },
      1: { cellWidth: 80 },
    },
    margin: { left: margins.left },
    headStyles: { fillColor: [primary.r, primary.g, primary.b] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  yPos = (doc as any).lastAutoTable.finalY + template.layout.sectionSpacing;

  // ========== CHARTS PAGE ==========
  if (charts && Object.values(charts).some(Boolean)) {
    doc.addPage();
    yPos = margins.top;

    setHeadingStyle(1);
    doc.text("Visual Analysis", margins.left, yPos);
    yPos += 15;

    // Payback Chart
    if (charts.payback) {
      try {
        doc.addImage(charts.payback, "PNG", margins.left, yPos, contentWidth, 60);
        yPos += 70;
      } catch (e) {
        console.error("Failed to add payback chart:", e);
      }
    }

    // Energy Flow and Monthly Generation side by side
    if (charts.energyFlow || charts.monthlyGeneration) {
      const chartWidth = (contentWidth - 10) / 2;

      if (charts.energyFlow) {
        try {
          doc.addImage(charts.energyFlow, "PNG", margins.left, yPos, chartWidth, 55);
        } catch (e) {
          console.error("Failed to add energy flow chart:", e);
        }
      }

      if (charts.monthlyGeneration) {
        try {
          doc.addImage(charts.monthlyGeneration, "PNG", margins.left + chartWidth + 10, yPos, chartWidth, 55);
        } catch (e) {
          console.error("Failed to add monthly generation chart:", e);
        }
      }
    }
  }

  // ========== 25-YEAR PROJECTION PAGE ==========
  doc.addPage();
  yPos = margins.top;

  setHeadingStyle(1);
  doc.text("25-Year Financial Projection", margins.left, yPos);
  yPos += 15;

  if (simulation) {
    const projection = generateProjection(simulation);
    const projectionRows = projection.map((row) => [
      row.year.toString(),
      row.generation.toLocaleString(),
      `R ${row.savings.toLocaleString()}`,
      `R ${row.cumulative.toLocaleString()}`,
      `${row.roi.toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Year", "Generation (kWh)", "Annual Savings", "Cumulative Savings", "ROI"]],
      body: projectionRows,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: {
        fillColor: [primary.r, primary.g, primary.b],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { left: margins.left, right: margins.right },
    });
  }

  // ========== ASSUMPTIONS & DISCLAIMERS PAGE ==========
  doc.addPage();
  yPos = margins.top;

  setHeadingStyle(2);
  doc.text("Assumptions", margins.left, yPos);
  yPos += 10;

  setBodyStyle();
  const assumptionsText =
    proposal.assumptions || "• 0.5% annual panel degradation\n• 8% annual tariff escalation\n• Standard weather conditions";
  const splitAssumptions = doc.splitTextToSize(assumptionsText, contentWidth);
  doc.text(splitAssumptions, margins.left, yPos);
  yPos += splitAssumptions.length * 5 + 15;

  if (proposal.disclaimers) {
    setHeadingStyle(2);
    doc.text("Disclaimers", margins.left, yPos);
    yPos += 10;

    setSecondaryStyle();
    const splitDisclaimer = doc.splitTextToSize(proposal.disclaimers, contentWidth);
    doc.text(splitDisclaimer, margins.left, yPos);
    yPos += splitDisclaimer.length * 5 + 15;
  }

  // ========== SIGNATURE SECTION ==========
  yPos = pageHeight - 90;

  doc.setDrawColor(200, 200, 200);
  doc.line(margins.left, yPos, margins.left + 80, yPos);
  doc.line(pageWidth - margins.right - 80, yPos, pageWidth - margins.right, yPos);

  setSecondaryStyle();
  doc.text("Prepared By", margins.left, yPos + 10);
  doc.text("Client Signature", pageWidth - margins.right - 80, yPos + 10);

  if (proposal.prepared_by) {
    setBodyStyle();
    doc.text(proposal.prepared_by, margins.left, yPos - 5);
  }

  if (proposal.client_signature) {
    setBodyStyle();
    doc.text(proposal.client_signature, pageWidth - margins.right - 80, yPos - 5);
  }

  // ========== ADD FOOTERS ==========
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  // Save PDF
  doc.save(`${project?.name || "Proposal"}_v${proposal.version || 1}.pdf`);
}
