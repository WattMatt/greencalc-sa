import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, Share2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ScenarioConfig, ScenarioResults } from "./ScenarioCard";
import { generateSandboxPDF } from "@/lib/pdfshift";

interface ScenarioData {
  id: "A" | "B" | "C";
  config: ScenarioConfig;
  results?: ScenarioResults;
}

interface DraftReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sandboxName: string;
  scenarios: ScenarioData[];
  clonedFromProject?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-ZA").format(value);
}

export function DraftReportDialog({
  open,
  onOpenChange,
  sandboxName,
  scenarios,
  clonedFromProject,
}: DraftReportDialogProps) {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const generateReportText = () => {
    const lines = [
      "═══════════════════════════════════════════════════════",
      "                     DRAFT REPORT",
      "           ⚠️ FOR INTERNAL REVIEW ONLY ⚠️",
      "═══════════════════════════════════════════════════════",
      "",
      `Sandbox: ${sandboxName}`,
      clonedFromProject ? `Source Project: ${clonedFromProject}` : "Source: Fresh sandbox",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "───────────────────────────────────────────────────────",
      "SCENARIO COMPARISON",
      "───────────────────────────────────────────────────────",
      "",
    ];

    scenarios.forEach((scenario) => {
      lines.push(`[Scenario ${scenario.id}]`);
      lines.push(`  Solar Capacity: ${scenario.config.solarCapacity} kWp`);
      lines.push(`  Battery Storage: ${scenario.config.batteryCapacity} kWh`);
      lines.push(`  DC/AC Ratio: ${(scenario.config.dcAcRatio * 100).toFixed(0)}%`);
      
      if (scenario.results) {
        lines.push("");
        lines.push(`  Results:`);
        lines.push(`    Annual Generation: ${formatNumber(scenario.results.annualGeneration)} kWh`);
        lines.push(`    Self-Consumption: ${formatNumber(scenario.results.selfConsumption)} kWh`);
        lines.push(`    System Cost: ${formatCurrency(scenario.results.systemCost)}`);
        lines.push(`    Annual Savings: ${formatCurrency(scenario.results.annualSavings)}`);
        lines.push(`    Payback Period: ${scenario.results.paybackYears.toFixed(1)} years`);
      } else {
        lines.push("  Results: Not yet calculated");
      }
      lines.push("");
    });

    lines.push("───────────────────────────────────────────────────────");
    lines.push("DISCLAIMER");
    lines.push("───────────────────────────────────────────────────────");
    lines.push("This is a DRAFT report generated from sandbox simulation.");
    lines.push("Figures are estimates only and should not be used for");
    lines.push("final investment decisions without proper verification.");
    lines.push("");
    lines.push("═══════════════════════════════════════════════════════");

    return lines.join("\n");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generateReportText());
    toast.success("Report copied to clipboard");
  };

  const handleDownload = () => {
    const blob = new Blob([generateReportText()], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sandboxName.replace(/\s+/g, "_")}_DRAFT_Report.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const result = await generateSandboxPDF({
        sandboxName,
        clonedFromProject,
        scenarios: scenarios.map(s => ({
          id: s.id,
          config: {
            solarCapacity: s.config.solarCapacity,
            batteryCapacity: s.config.batteryCapacity,
            dcAcRatio: s.config.dcAcRatio,
          },
          results: s.results ? {
            annualGeneration: s.results.annualGeneration,
            selfConsumption: s.results.selfConsumption,
            systemCost: s.results.systemCost,
            annualSavings: s.results.annualSavings,
            paybackYears: s.results.paybackYears,
          } : undefined,
        })),
      });

      if (result.success) {
        toast.success("PDF exported successfully");
      } else {
        toast.error(result.error || "Failed to export PDF");
      }
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Draft Report</DialogTitle>
            <Badge variant="outline" className="border-dashed bg-amber-500/10 text-amber-700 border-amber-500/30">
              DRAFT
            </Badge>
          </div>
          <DialogDescription>
            Preview and share your sandbox analysis (watermarked as draft)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <div className="bg-muted rounded-lg p-4 font-mono text-xs whitespace-pre-wrap relative">
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
              <span className="text-8xl font-bold rotate-[-30deg]">DRAFT</span>
            </div>
            <pre className="relative z-10">{generateReportText()}</pre>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download TXT
          </Button>
          <Button variant="outline" onClick={handleExportPDF} disabled={isExportingPDF}>
            {isExportingPDF ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Export PDF
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
