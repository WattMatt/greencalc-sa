import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  FileText, 
  Download, 
  Save,
  Settings,
  Eye
} from "lucide-react";
import { SegmentSelector, defaultSegments, Segment } from "./SegmentSelector";
import { TemplateSelector } from "./TemplateSelector";
import { ReportPreview } from "./ReportPreview";
import { VersionHistory } from "./VersionHistory";
import { InfographicGenerator } from "../infographics";
import { ReportTemplate } from "../types";

interface ReportBuilderProps {
  projectName?: string;
  projectId?: string;
  simulationData?: {
    solarCapacityKwp?: number;
    batteryCapacityKwh?: number;
    annualSavings?: number;
    paybackYears?: number;
    roiPercent?: number;
    co2AvoidedTons?: number;
    dcAcRatio?: number;
  };
  className?: string;
}

export function ReportBuilder({ 
  projectName = "Solar Project",
  projectId,
  simulationData,
  className 
}: ReportBuilderProps) {
  const [reportName, setReportName] = useState(`${projectName} Report`);
  const [segments, setSegments] = useState<Segment[]>(defaultSegments);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate>("executive");
  const [versions, setVersions] = useState<Array<{
    id: string;
    version: number;
    created_at: string;
    generated_by?: string;
    notes?: string;
  }>>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleTemplateSelect = (template: ReportTemplate, templateSegments: string[]) => {
    setSelectedTemplate(template);
    if (template !== "custom" && templateSegments.length > 0) {
      setSegments(segments.map(s => ({
        ...s,
        enabled: templateSegments.includes(s.id)
      })));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Create new version
      const newVersion = {
        id: crypto.randomUUID(),
        version: versions.length + 1,
        created_at: new Date().toISOString(),
        generated_by: "Current User",
        notes: `Saved with ${segments.filter(s => s.enabled).length} segments`
      };
      setVersions([newVersion, ...versions]);
      toast.success(`Report saved as v${newVersion.version}`);
    } catch (error) {
      toast.error("Failed to save report");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    toast.info("Export functionality coming in Phase 5");
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <Input
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              className="text-lg font-semibold border-none p-0 h-auto focus-visible:ring-0"
            />
            <p className="text-sm text-muted-foreground">
              {segments.filter(s => s.enabled).length} segments selected
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="compose" className="space-y-6">
        <TabsList>
          <TabsTrigger value="compose" className="gap-2">
            <Settings className="h-4 w-4" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="infographics" className="gap-2">
            <FileText className="h-4 w-4" />
            Infographics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Templates & Segments */}
            <div className="space-y-6">
              <TemplateSelector
                selectedTemplate={selectedTemplate}
                onTemplateSelect={handleTemplateSelect}
              />
              <SegmentSelector
                segments={segments}
                onSegmentsChange={(newSegments) => {
                  setSegments(newSegments);
                  setSelectedTemplate("custom");
                }}
              />
            </div>

            {/* Middle Column - Preview */}
            <div className="lg:col-span-1">
              <ReportPreview
                segments={segments}
                projectName={projectName}
              />
            </div>

            {/* Right Column - Version History */}
            <div>
              <VersionHistory
                versions={versions}
                currentVersion={versions[0]?.version}
                onView={(v) => toast.info(`Viewing v${v.version}`)}
                onRestore={(v) => toast.success(`Restored to v${v.version}`)}
                onDelete={(v) => {
                  setVersions(versions.filter(ver => ver.id !== v.id));
                  toast.success(`Deleted v${v.version}`);
                }}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <div className="max-w-3xl mx-auto">
            <ReportPreview
              segments={segments}
              projectName={projectName}
              className="min-h-[600px]"
            />
          </div>
        </TabsContent>

        <TabsContent value="infographics">
          <InfographicGenerator
            data={{
              projectName,
              ...simulationData
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
