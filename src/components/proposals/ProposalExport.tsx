import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Table, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Proposal, SimulationData, ProposalBranding } from "./types";

interface ProposalExportProps {
  proposal: Partial<Proposal>;
  project: any;
  simulation?: SimulationData;
  disabled?: boolean;
}

export function ProposalExport({ proposal, project, simulation, disabled }: ProposalExportProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const generateProjection = () => {
    if (!simulation) return [];
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
        gridImport: Math.round(simulation.annualGridImport),
        gridExport: Math.round(simulation.annualGridExport),
        savings: Math.round(yearSavings),
        cumulative: Math.round(cumulativeSavings),
        roi: ((cumulativeSavings - simulation.systemCost) / simulation.systemCost) * 100,
      });
    }
    return rows;
  };

  const generateHourlyData = () => {
    // Generate sample hourly data for appendix (24 hours x 7 days)
    const hourlyData = [];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const solarGen = hour >= 6 && hour <= 18 
          ? Math.sin((hour - 6) * Math.PI / 12) * (simulation?.solarCapacity || 100) * 0.8
          : 0;
        const load = 50 + Math.sin((hour - 8) * Math.PI / 16) * 30 + (day >= 5 ? -10 : 0);
        const netImport = Math.max(0, load - solarGen);
        const netExport = Math.max(0, solarGen - load);
        
        hourlyData.push({
          day: days[day],
          hour: `${hour.toString().padStart(2, '0')}:00`,
          load: load.toFixed(1),
          solar: solarGen.toFixed(1),
          netImport: netImport.toFixed(1),
          netExport: netExport.toFixed(1),
        });
      }
    }
    return hourlyData;
  };

  const exportToPDF = async () => {
    setExporting("pdf");
    try {
      const branding = proposal.branding as ProposalBranding;
      const primaryColor = branding?.primary_color || "#22c55e";
      const secondaryColor = branding?.secondary_color || "#0f172a";
      
      // Convert hex to RGB
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 34, g: 197, b: 94 };
      };

      const primary = hexToRgb(primaryColor);
      const secondary = hexToRgb(secondaryColor);
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;

      // ========== COVER PAGE ==========
      // Header bar
      doc.setFillColor(secondary.r, secondary.g, secondary.b);
      doc.rect(0, 0, pageWidth, 50, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text(branding?.company_name || "Solar Installation Proposal", 20, 30);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Prepared for: ${project?.name || "Client"}`, 20, 42);

      // Version badge
      doc.setFontSize(10);
      doc.text(`Version ${proposal.version || 1}`, pageWidth - 40, 30);
      doc.text(new Date().toLocaleDateString('en-ZA'), pageWidth - 40, 40);

      // Reset text color
      doc.setTextColor(0, 0, 0);
      yPos = 70;

      // ========== EXECUTIVE SUMMARY ==========
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text("Executive Summary", 20, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      
      const summaryText = proposal.executive_summary || 
        `This proposal outlines a ${simulation?.solarCapacity || 0} kWp solar PV system installation for ${project?.name}. ` +
        `The system is projected to generate ${(simulation?.annualSolarGeneration || 0).toLocaleString()} kWh annually, ` +
        `resulting in estimated annual savings of R${(simulation?.annualSavings || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ` +
        `with a payback period of ${(simulation?.paybackYears || 0).toFixed(1)} years.`;
      
      const splitSummary = doc.splitTextToSize(summaryText, pageWidth - 40);
      doc.text(splitSummary, 20, yPos);
      yPos += splitSummary.length * 5 + 15;

      // ========== SITE OVERVIEW ==========
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text("Site Overview", 20, yPos);
      yPos += 10;

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
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 100 },
        },
        margin: { left: 20 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;

      // ========== SYSTEM SPECIFICATION ==========
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text("System Specification", 20, yPos);
      yPos += 10;

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
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 60 },
          1: { cellWidth: 80 },
        },
        margin: { left: 20 },
        headStyles: { fillColor: [primary.r, primary.g, primary.b] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;

      // ========== FINANCIAL SUMMARY ==========
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text("Financial Summary", 20, yPos);
      yPos += 10;

      const financialData = [
        ["System Cost", `R ${(simulation?.systemCost || 0).toLocaleString()}`],
        ["Annual Savings", `R ${(simulation?.annualSavings || 0).toLocaleString()}`],
        ["Payback Period", `${(simulation?.paybackYears || 0).toFixed(1)} years`],
        ["25-Year ROI", `${(simulation?.roiPercentage || 0).toFixed(0)}%`],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [],
        body: financialData,
        theme: 'plain',
        styles: { fontSize: 11, cellPadding: 5 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 80, fontStyle: 'bold' },
        },
        margin: { left: 20 },
      });

      // ========== NEW PAGE - 25-YEAR PROJECTION ==========
      doc.addPage();
      yPos = 20;

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text("25-Year Financial Projection", 20, yPos);
      yPos += 15;

      const projection = generateProjection();
      const projectionRows = projection.map(row => [
        row.year.toString(),
        row.generation.toLocaleString(),
        `R ${row.savings.toLocaleString()}`,
        `R ${row.cumulative.toLocaleString()}`,
        `${row.roi.toFixed(1)}%`,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Year', 'Generation (kWh)', 'Annual Savings', 'Cumulative Savings', 'ROI']],
        body: projectionRows,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { 
          fillColor: [primary.r, primary.g, primary.b],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        margin: { left: 20, right: 20 },
      });

      // ========== NEW PAGE - ASSUMPTIONS & DISCLAIMERS ==========
      doc.addPage();
      yPos = 20;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text("Assumptions", 20, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      
      const assumptionsText = proposal.assumptions || 
        "• 0.5% annual panel degradation\n• 8% annual tariff escalation\n• Standard weather conditions";
      const splitAssumptions = doc.splitTextToSize(assumptionsText, pageWidth - 40);
      doc.text(splitAssumptions, 20, yPos);
      yPos += splitAssumptions.length * 5 + 15;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text("Disclaimers", 20, yPos);
      yPos += 10;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      
      const disclaimerText = proposal.disclaimers || "";
      const splitDisclaimer = doc.splitTextToSize(disclaimerText, pageWidth - 40);
      doc.text(splitDisclaimer, 20, yPos);

      // ========== SIGNATURE SECTION ==========
      yPos = pageHeight - 80;
      
      doc.setDrawColor(200, 200, 200);
      doc.line(20, yPos, 100, yPos);
      doc.line(pageWidth - 100, yPos, pageWidth - 20, yPos);
      
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text("Prepared By", 20, yPos + 10);
      doc.text("Client Signature", pageWidth - 100, yPos + 10);
      
      if (proposal.prepared_by) {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(proposal.prepared_by, 20, yPos - 5);
      }
      
      if (proposal.client_signature) {
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(proposal.client_signature, pageWidth - 100, yPos - 5);
      }

      // ========== FOOTER ==========
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(secondary.r, secondary.g, secondary.b);
        doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
        
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        const footerText = [
          branding?.contact_email,
          branding?.contact_phone,
          branding?.website
        ].filter(Boolean).join(" • ");
        doc.text(footerText, pageWidth / 2, pageHeight - 6, { align: 'center' });
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 25, pageHeight - 6);
      }

      // Save PDF
      doc.save(`${project?.name || "Proposal"}_v${proposal.version || 1}.pdf`);
      toast.success("Proposal exported as PDF");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export proposal");
    } finally {
      setExporting(null);
    }
  };

  const exportToExcel = () => {
    setExporting("excel");
    try {
      const projection = generateProjection();
      const hourlyData = generateHourlyData();
      const branding = proposal.branding as ProposalBranding;
      
      // Build comprehensive CSV content with multiple sections
      const sections = [];

      // Header
      sections.push(["=== SOLAR INSTALLATION PROPOSAL ==="]);
      sections.push([`Company: ${branding?.company_name || "N/A"}`]);
      sections.push([`Project: ${project?.name || "N/A"}`]);
      sections.push([`Version: ${proposal.version || 1}`]);
      sections.push([`Date: ${new Date().toLocaleDateString('en-ZA')}`]);
      sections.push([]);

      // Site Overview
      sections.push(["=== SITE OVERVIEW ==="]);
      sections.push(["Location", project?.location || ""]);
      sections.push(["Total Area (m²)", project?.total_area_sqm || ""]);
      sections.push(["Connection Size (kVA)", project?.connection_size_kva || ""]);
      sections.push(["Tariff", simulation?.tariffName || "Standard"]);
      sections.push([]);

      // System Specification
      sections.push(["=== SYSTEM SPECIFICATION ==="]);
      sections.push(["Solar Capacity (kWp)", simulation?.solarCapacity || 0]);
      sections.push(["Battery Capacity (kWh)", simulation?.batteryCapacity || 0]);
      sections.push(["Battery Power (kW)", simulation?.batteryPower || 0]);
      sections.push(["Annual Generation (kWh)", simulation?.annualSolarGeneration || 0]);
      sections.push(["Annual Grid Import (kWh)", simulation?.annualGridImport || 0]);
      sections.push(["Annual Grid Export (kWh)", simulation?.annualGridExport || 0]);
      sections.push([]);

      // Financial Summary
      sections.push(["=== FINANCIAL SUMMARY ==="]);
      sections.push(["System Cost (R)", simulation?.systemCost || 0]);
      sections.push(["Annual Savings (R)", simulation?.annualSavings || 0]);
      sections.push(["Payback Period (years)", simulation?.paybackYears || 0]);
      sections.push(["25-Year ROI (%)", simulation?.roiPercentage || 0]);
      sections.push([]);

      // 25-Year Projection
      sections.push(["=== 25-YEAR FINANCIAL PROJECTION ==="]);
      sections.push([
        "Year",
        "Generation (kWh)",
        "Grid Import (kWh)",
        "Grid Export (kWh)",
        "Annual Savings (R)",
        "Cumulative Savings (R)",
        "ROI (%)",
      ]);

      projection.forEach((row) => {
        sections.push([
          row.year,
          row.generation,
          row.gridImport,
          row.gridExport,
          row.savings,
          row.cumulative,
          row.roi.toFixed(1),
        ]);
      });
      sections.push([]);

      // Hourly Data Appendix
      sections.push(["=== APPENDIX: TYPICAL WEEK HOURLY DATA ==="]);
      sections.push(["Day", "Hour", "Load (kW)", "Solar (kW)", "Net Import (kW)", "Net Export (kW)"]);
      
      hourlyData.forEach((row) => {
        sections.push([row.day, row.hour, row.load, row.solar, row.netImport, row.netExport]);
      });

      const csvContent = sections
        .map((row) => row.join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${project?.name || "Proposal"}_v${proposal.version || 1}_Complete_Analysis.csv`;
      link.click();

      toast.success("Complete analysis exported to CSV (Excel compatible)");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export");
    } finally {
      setExporting(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Export Proposal</CardTitle>
        </div>
        <CardDescription>
          Download the proposal in different formats
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={exportToPDF}
            disabled={disabled || exporting !== null}
            className="w-full"
          >
            {exporting === "pdf" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Export as PDF
          </Button>
          <Button
            variant="outline"
            onClick={exportToExcel}
            disabled={disabled || exporting !== null}
            className="w-full"
          >
            {exporting === "excel" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Table className="mr-2 h-4 w-4" />
            )}
            Export to Excel
          </Button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            PDF: Professional report with branding, 25-year projection, signatures
          </p>
          <p className="flex items-center gap-1">
            <Table className="h-3 w-3" />
            Excel: Complete data with hourly appendix for detailed analysis
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
