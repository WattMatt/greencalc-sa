import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileText, Table, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import type { Proposal, SimulationData } from "./types";

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

  const exportToPDF = async () => {
    setExporting("pdf");
    try {
      const element = document.getElementById("proposal-preview");
      if (!element) {
        toast.error("Preview not found");
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      // Create PDF-like download (using canvas as image for now)
      const link = document.createElement("a");
      link.download = `${project?.name || "Proposal"}_v${proposal.version || 1}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast.success("Proposal exported as image (PDF export requires server-side processing)");
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
      
      // Build CSV content
      const headers = [
        "Year",
        "Generation (kWh)",
        "Grid Import (kWh)",
        "Grid Export (kWh)",
        "Annual Savings (R)",
        "Cumulative Savings (R)",
        "ROI (%)",
      ];

      const rows = projection.map((row) => [
        row.year,
        row.generation,
        row.gridImport,
        row.gridExport,
        row.savings,
        row.cumulative,
        row.roi.toFixed(1),
      ]);

      // Add summary section
      const summary = [
        [],
        ["Summary"],
        ["Project Name", project?.name || ""],
        ["Location", project?.location || ""],
        ["Solar Capacity (kWp)", simulation?.solarCapacity || 0],
        ["Battery Capacity (kWh)", simulation?.batteryCapacity || 0],
        ["System Cost (R)", simulation?.systemCost || 0],
        ["Annual Savings (R)", simulation?.annualSavings || 0],
        ["Payback Period (years)", simulation?.paybackYears || 0],
        [],
        ["25-Year Projection"],
        headers,
        ...rows,
      ];

      const csvContent = summary
        .map((row) => (Array.isArray(row) ? row.join(",") : row))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${project?.name || "Proposal"}_v${proposal.version || 1}_Financial_Analysis.csv`;
      link.click();

      toast.success("Financial analysis exported to CSV");
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

        <p className="text-xs text-muted-foreground text-center">
          PDF includes full visual report • Excel includes 25-year financial projections
        </p>
      </CardContent>
    </Card>
  );
}
