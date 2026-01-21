import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Table, Loader2, Image } from "lucide-react";
import { toast } from "sonner";
import type { Proposal, SimulationData, ProposalBranding } from "./types";
import { ProposalTemplateId, PROPOSAL_TEMPLATES } from "./templates/types";
import { TemplateSelector } from "./templates/TemplateSelector";
import { generateProposalPDF } from "@/lib/pdfshift";
import {
  PaybackChart,
  EnergyFlowDonut,
  MonthlyGenerationChart,
  PaybackChartRef,
  EnergyFlowDonutRef,
  MonthlyGenerationChartRef,
} from "./charts";

interface ProposalExportProps {
  proposal: Partial<Proposal>;
  project: any;
  simulation?: SimulationData;
  disabled?: boolean;
  selectedTemplate: ProposalTemplateId;
  onTemplateChange: (template: ProposalTemplateId) => void;
}

export function ProposalExport({ proposal, project, simulation, disabled, selectedTemplate, onTemplateChange }: ProposalExportProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [includeCharts, setIncludeCharts] = useState(true);

  // Chart refs for capturing
  const paybackChartRef = useRef<PaybackChartRef>(null);
  const energyFlowRef = useRef<EnergyFlowDonutRef>(null);
  const monthlyGenRef = useRef<MonthlyGenerationChartRef>(null);

  const branding = proposal.branding as ProposalBranding;
  const primaryColor = branding?.primary_color || PROPOSAL_TEMPLATES[selectedTemplate].colors.accentColor;

  // Generate 25-year projection for charts
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
        cumulative: cumulativeSavings,
        roi: ((cumulativeSavings - simulation.systemCost) / simulation.systemCost) * 100,
      });
    }
    return rows;
  };

  // Load logo as base64
  const loadLogoBase64 = async (): Promise<string | undefined> => {
    if (!branding?.logo_url) return undefined;
    try {
      const response = await fetch(branding.logo_url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      return undefined;
    }
  };

  const exportToPDF = async () => {
    setExporting("pdf");
    try {
      // Capture charts if enabled
      let charts: { payback?: string; energyFlow?: string; monthlyGeneration?: string } = {};

      if (includeCharts && simulation) {
        // Wait for charts to render
        await new Promise((resolve) => setTimeout(resolve, 500));

        const [payback, energyFlow, monthlyGen] = await Promise.all([
          paybackChartRef.current?.captureImage(),
          energyFlowRef.current?.captureImage(),
          monthlyGenRef.current?.captureImage(),
        ]);

        charts = {
          payback: payback || undefined,
          energyFlow: energyFlow || undefined,
          monthlyGeneration: monthlyGen || undefined,
        };
      }

      // Generate PDF using PDFShift
      const result = await generateProposalPDF({
        proposal: {
          version: proposal.version,
          executive_summary: proposal.executive_summary || undefined,
          assumptions: proposal.assumptions || undefined,
          disclaimers: proposal.disclaimers || undefined,
          prepared_by: proposal.prepared_by || undefined,
          client_signature: proposal.client_signature || undefined,
        },
        project: {
          name: project?.name,
          location: project?.location,
          total_area_sqm: project?.total_area_sqm,
          connection_size_kva: project?.connection_size_kva,
        },
        simulation: simulation ? {
          solarCapacity: simulation.solarCapacity,
          batteryCapacity: simulation.batteryCapacity,
          batteryPower: simulation.batteryPower,
          annualSolarGeneration: simulation.annualSolarGeneration,
          annualGridImport: simulation.annualGridImport,
          annualGridExport: simulation.annualGridExport,
          annualSavings: simulation.annualSavings,
          paybackYears: simulation.paybackYears,
          roiPercentage: simulation.roiPercentage,
          systemCost: simulation.systemCost,
          tariffName: simulation.tariffName,
        } : undefined,
        branding: branding ? {
          company_name: branding.company_name || undefined,
          logo_url: branding.logo_url || undefined,
          primary_color: branding.primary_color,
          secondary_color: branding.secondary_color,
          contact_email: branding.contact_email || undefined,
          contact_phone: branding.contact_phone || undefined,
          website: branding.website || undefined,
        } : undefined,
        charts,
      });

      if (result.success) {
        toast.success("Proposal exported as PDF");
      } else {
        toast.error(result.error || "Failed to export proposal");
      }
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

      // Build comprehensive CSV content with multiple sections
      const sections: (string | number)[][] = [];

      // Header
      sections.push(["=== SOLAR INSTALLATION PROPOSAL ==="]);
      sections.push([`Company: ${branding?.company_name || "N/A"}`]);
      sections.push([`Project: ${project?.name || "N/A"}`]);
      sections.push([`Version: ${proposal.version || 1}`]);
      sections.push([`Date: ${new Date().toLocaleDateString("en-ZA")}`]);
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
      sections.push(["Year", "Cumulative Savings (R)", "ROI (%)"]);

      projection.forEach((row) => {
        sections.push([row.year, Math.round(row.cumulative), row.roi.toFixed(1)]);
      });

      const csvContent = sections.map((row) => row.join(",")).join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${project?.name || "Proposal"}_v${proposal.version || 1}_Analysis.csv`;
      link.click();

      toast.success("Analysis exported to CSV");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Template Selector */}
      <TemplateSelector
        selectedTemplate={selectedTemplate}
        onSelect={onTemplateChange}
      />

      {/* Export Options */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Export Proposal</CardTitle>
          </div>
          <CardDescription>Download the proposal in different formats</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chart inclusion toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={includeCharts}
                onChange={(e) => setIncludeCharts(e.target.checked)}
                className="rounded border-border"
              />
              <Image className="h-4 w-4 text-muted-foreground" />
              Include charts in PDF
            </label>
          </div>

          {/* Export buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="default"
              onClick={exportToPDF}
              disabled={disabled || exporting !== null}
              className="w-full"
            >
              {exporting === "pdf" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Export PDF
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
              Export Excel
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            PDF includes professional branding, financial charts, and 25-year projections.
          </p>
        </CardContent>
      </Card>

      {/* Hidden charts for capturing */}
      {includeCharts && simulation && (
        <div className="fixed -left-[9999px] top-0">
          <div className="w-[600px]">
            <PaybackChart
              ref={paybackChartRef}
              projection={generateProjection()}
              systemCost={simulation.systemCost}
              primaryColor={primaryColor}
            />
          </div>
          <div className="w-[400px] mt-4">
            <EnergyFlowDonut
              ref={energyFlowRef}
              solarGeneration={simulation.annualSolarGeneration}
              gridImport={simulation.annualGridImport}
              gridExport={simulation.annualGridExport}
              primaryColor={primaryColor}
            />
          </div>
          <div className="w-[400px] mt-4">
            <MonthlyGenerationChart
              ref={monthlyGenRef}
              annualGeneration={simulation.annualSolarGeneration}
              primaryColor={primaryColor}
            />
          </div>
        </div>
      )}
    </div>
  );
}
