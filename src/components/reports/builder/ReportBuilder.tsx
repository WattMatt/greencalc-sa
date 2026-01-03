import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Download,
  Save,
  Settings,
  Eye,
  CheckSquare,
  Image
} from "lucide-react";
import { SegmentSelector, defaultSegments, Segment } from "./SegmentSelector";
import { TemplateSelector } from "./TemplateSelector";
import { ReportPreview } from "./ReportPreview";
import { ReportExport } from "./ReportExport";
import { VersionHistory } from "./VersionHistory";
import { InfographicGenerator } from "../infographics";
import { ReportTemplate, ReportData, ReportSegment } from "../types";
import { useReportSelection } from "@/hooks/useReportSelection";

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
  simulationData: initialSimulationData,
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

  // Hook for workflow-selected items
  const { selectedItems } = useReportSelection();

  // Sync segments with selected items from workflow
  useEffect(() => {
    if (selectedItems.length > 0) {
      setSegments(prev => prev.map(seg => {
        // If this segment type corresponds to any selected item, enable it
        const hasSelection = selectedItems.some(item => item.segmentType === seg.id);
        if (hasSelection) {
          return { ...seg, enabled: true };
        }
        return seg;
      }));

      // If we have custom selections, switch template to custom
      setSelectedTemplate("custom");
    }
  }, [selectedItems]);

  // Fetch latest simulation if not provided
  const { data: latestSimulation } = useQuery({
    queryKey: ["latest-simulation", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("project_simulations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!projectId && !initialSimulationData,
  });

  // Merge provided data with fetched data
  const simulationData = useMemo(() => {
    if (initialSimulationData) return initialSimulationData;
    if (!latestSimulation) return undefined;

    const results = latestSimulation.results_json as any;
    const pvConfig = results?.pvConfig || {};

    return {
      solarCapacityKwp: latestSimulation.solar_capacity_kwp || 0,
      batteryCapacityKwh: latestSimulation.battery_capacity_kwh || 0,
      annualSavings: latestSimulation.annual_solar_savings || 0,
      paybackYears: latestSimulation.payback_years || 0,
      roiPercent: latestSimulation.roi_percentage || 0,
      co2AvoidedTons: (latestSimulation.solar_capacity_kwp || 0) * 1.2,
      dcAcRatio: pvConfig.dcAcRatio || 1.3,
    };
  }, [initialSimulationData, latestSimulation]);

  // Build ReportData for export
  const reportData: ReportData = useMemo(() => {
    const solarKwp = simulationData?.solarCapacityKwp || 100;
    const batteryKwh = simulationData?.batteryCapacityKwh || 50;
    const annualGeneration = solarKwp * 1600; // Approximate kWh/kWp
    const annualConsumption = annualGeneration * 1.3;
    const selfConsumption = annualGeneration * 0.75;
    const annualSavings = simulationData?.annualSavings || solarKwp * 2500;
    const systemCost = solarKwp * 12000 + batteryKwh * 8000;
    const paybackYears = simulationData?.paybackYears || systemCost / annualSavings;
    const dcAcRatio = simulationData?.dcAcRatio || 1.3;

    return {
      project: {
        name: projectName,
        location: null,
        total_area_sqm: 0,
        connection_size_kva: null,
        tenant_count: 0,
      },
      simulation: {
        solar_capacity_kwp: solarKwp,
        battery_capacity_kwh: batteryKwh,
        battery_power_kw: batteryKwh / 2,
        dc_ac_ratio: dcAcRatio,
        annual_solar_generation_kwh: annualGeneration,
        annual_consumption_kwh: annualConsumption,
        self_consumption_kwh: selfConsumption,
        grid_import_kwh: annualConsumption - selfConsumption,
        grid_export_kwh: annualGeneration - selfConsumption,
      },
      kpis: {
        specific_yield: 1600,
        performance_ratio: 82,
        capacity_factor: 18.3,
        lcoe: 0.85,
        self_consumption_rate: 75,
        solar_coverage: 58,
        grid_independence: 65,
        peak_shaving_kw: solarKwp * 0.8,
      },
      dcAcAnalysis: {
        baseline_annual_kwh: annualGeneration / dcAcRatio,
        oversized_annual_kwh: annualGeneration,
        clipping_loss_kwh: annualGeneration * 0.02,
        additional_capture_kwh: annualGeneration * 0.12,
        net_gain_kwh: annualGeneration * 0.10,
        net_gain_percent: 10,
        clipping_percent: 2,
        hourly_comparison: Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          baseline_kw: h >= 6 && h <= 18 ? Math.sin((h - 6) * Math.PI / 12) * solarKwp / dcAcRatio : 0,
          oversized_dc_kw: h >= 6 && h <= 18 ? Math.sin((h - 6) * Math.PI / 12) * solarKwp : 0,
          oversized_ac_kw: h >= 6 && h <= 18 ? Math.min(Math.sin((h - 6) * Math.PI / 12) * solarKwp, solarKwp / dcAcRatio) : 0,
          clipping_kw: h >= 10 && h <= 14 ? Math.max(0, Math.sin((h - 6) * Math.PI / 12) * solarKwp - solarKwp / dcAcRatio) : 0,
        })),
        monthly_comparison: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => ({
          month,
          baseline_kwh: annualGeneration / dcAcRatio / 12,
          oversized_kwh: annualGeneration / 12,
          gain_kwh: annualGeneration * 0.10 / 12,
          gain_percent: 10,
        })),
      },
      financials: {
        system_cost: systemCost,
        annual_grid_cost_baseline: annualConsumption * 2.5,
        annual_grid_cost_with_solar: (annualConsumption - selfConsumption) * 2.5,
        annual_savings: annualSavings,
        payback_years: paybackYears,
        roi_percent: simulationData?.roiPercent || (annualSavings * 25 / systemCost - 1) * 100,
        npv: annualSavings * 15 - systemCost,
        irr: 18,
        yearly_cashflows: Array.from({ length: 25 }, (_, i) => ({
          year: i + 1,
          cumulative_savings: annualSavings * (i + 1),
          cumulative_cost: systemCost,
          net_position: annualSavings * (i + 1) - systemCost,
        })),
      },
      environmental: {
        co2_avoided_tons: simulationData?.co2AvoidedTons || solarKwp * 1.2,
        trees_equivalent: solarKwp * 50,
        car_miles_avoided: solarKwp * 3000,
        homes_powered_equivalent: solarKwp / 5,
        grid_emission_factor: 0.92,
      },
    };
  }, [projectName, simulationData]);

  // Convert segments to ReportSegment format for export
  const reportSegments: ReportSegment[] = useMemo(() => {
    return segments.map((s, i) => ({
      id: s.id,
      type: s.id as any,
      enabled: s.enabled,
      order: i,
    }));
  }, [segments]);

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

  const [activeTab, setActiveTab] = useState("compose");

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
              {selectedItems.length > 0 && ` (${selectedItems.length} from workflow)`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setActiveTab("export")}>
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
            <Image className="h-4 w-4" />
            Infographics
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Download className="h-4 w-4" />
            Export
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

              {selectedItems.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-green-600" />
                      Workflow Selections
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2">
                    {selectedItems.map(item => (
                      <div key={item.id} className="flex items-center gap-2 text-muted-foreground">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        {item.label}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Middle Column - Preview */}
            <div className="lg:col-span-1">
              <ReportPreview
                segments={segments}
                projectName={projectName}
                simulationData={simulationData}
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
              simulationData={simulationData}
              className="min-h-[600px]"
            />
          </div>
        </TabsContent>

        <TabsContent value="infographics">
          <InfographicGenerator
            projectId={projectId}
            data={{
              projectName,
              ...simulationData
            }}
          />
        </TabsContent>

        <TabsContent value="export">
          <ReportExport
            reportName={reportName}
            segments={reportSegments}
            reportData={reportData}
            projectId={projectId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
