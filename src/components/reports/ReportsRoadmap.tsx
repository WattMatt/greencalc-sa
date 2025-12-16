import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  FileText, 
  Database, 
  BarChart3, 
  Sparkles, 
  Layout, 
  Download, 
  Cloud,
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  Palette,
  Copy
} from "lucide-react";
import { DcAcRatioChart } from "./charts";
import { calculateDcAcAnalysis } from "./calculations";
import { InfographicGenerator } from "./infographics";
import { ReportBuilder, ReportExport } from "./builder";
import { ReportAnalyticsDashboard } from "./analytics";

interface Phase {
  id: number;
  name: string;
  description: string;
  icon: React.ElementType;
  status: "completed" | "in-progress" | "upcoming";
  progress: number;
  deliverables: string[];
}

const phases: Phase[] = [
  {
    id: 0,
    name: "Wireframes & Validation",
    description: "UI mockups and design approval",
    icon: Palette,
    status: "completed",
    progress: 100,
    deliverables: [
      "Report Builder layout wireframe",
      "Segment selector mockup",
      "Chart layout options",
      "Infographic card designs",
      "Export flow mockup",
      "Version history UI"
    ]
  },
  {
    id: 1,
    name: "Database & Types",
    description: "Schema and TypeScript interfaces",
    icon: Database,
    status: "completed",
    progress: 100,
    deliverables: [
      "report_configs table",
      "report_versions table",
      "TypeScript interfaces",
      "KPI calculation utilities"
    ]
  },
  {
    id: 2,
    name: "Chart Components",
    description: "Core visualization charts",
    icon: BarChart3,
    status: "completed",
    progress: 100,
    deliverables: [
      "DC/AC Ratio Comparison Chart",
      "Energy Flow Sankey Diagram",
      "Monthly Yield Chart",
      "Payback Timeline Chart"
    ]
  },
  {
    id: 3,
    name: "AI Infographics",
    description: "AI-generated visual summaries",
    icon: Sparkles,
    status: "completed",
    progress: 100,
    deliverables: [
      "Executive Summary Illustration",
      "System Overview Graphic",
      "Savings Breakdown Visual",
      "Environmental Impact Card",
      "Engineering Specs Panel"
    ]
  },
  {
    id: 4,
    name: "Builder UI",
    description: "Report composition interface",
    icon: Layout,
    status: "completed",
    progress: 100,
    deliverables: [
      "Segment Selector Panel",
      "Template Presets",
      "Live Preview Panel",
      "Version History UI"
    ]
  },
  {
    id: 5,
    name: "PDF/Excel Export",
    description: "Native document exports",
    icon: Download,
    status: "completed",
    progress: 100,
    deliverables: [
      "PDF with cover page",
      "Table of contents",
      "Excel workbook export",
      "Chart embedding"
    ]
  },
  {
    id: 6,
    name: "Google Integration",
    description: "Docs, Slides, Sheets export",
    icon: Cloud,
    status: "completed",
    progress: 100,
    deliverables: [
      "Service account authentication",
      "Google Sheets export",
      "Multi-sheet workbook",
      "Automatic formatting"
    ]
  },
  {
    id: 7,
    name: "Polish & Analytics",
    description: "Final refinements",
    icon: CheckCircle2,
    status: "completed",
    progress: 100,
    deliverables: [
      "Performance optimization",
      "Usage analytics dashboard",
      "Error handling improvements",
      "Export tracking"
    ]
  }
];

const wireframes = {
  builder: `┌─────────────────────────────────────────────────────────────────┐
│  Report Builder                    [Templates ▼] [Export ▼]     │
├──────────────────┬──────────────────────────────────────────────┤
│  SEGMENTS        │  PREVIEW                                     │
│  ─────────────   │  ┌────────────────────────────────────────┐  │
│  ☑ Executive     │  │                                        │  │
│    Summary       │  │     [Executive Summary Card]           │  │
│  ☑ DC/AC Chart   │  │                                        │  │
│  ☑ Energy Flow   │  │     ┌──────────┐  ┌──────────┐        │  │
│  ☐ Monthly Yield │  │     │ DC/AC    │  │ Sankey   │        │  │
│  ☑ Payback       │  │     │ Chart    │  │ Diagram  │        │  │
│  ☐ Env. Impact   │  │     └──────────┘  └──────────┘        │  │
│  ☑ Tech Specs    │  │                                        │  │
│                  │  │     [Financial Summary]                │  │
│  [+ Add Custom]  │  │                                        │  │
│                  │  └────────────────────────────────────────┘  │
│  ─────────────   │                                              │
│  VERSIONS        │  Page 1 of 4    [◀] [▶]    [Zoom: 100%]     │
│  v3 (current)    │                                              │
│  v2 - Jun 10     │                                              │
│  v1 - Jun 8      │                                              │
└──────────────────┴──────────────────────────────────────────────┘`,
  executive: `┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  [AI Illustration: Solar panels on building]            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  PROJECT NAME                           Prepared: 15 Jun 2025   │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │  R 2.4M   │  │   5.2     │  │   18%     │  │  1,240    │   │
│  │  Annual   │  │  Years    │  │   ROI     │  │  Tons CO2 │   │
│  │  Savings  │  │  Payback  │  │           │  │  Avoided  │   │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘   │
│                                                                 │
│  System: 500 kWp DC │ 385 kVA AC │ 200 kWh Battery            │
└─────────────────────────────────────────────────────────────────┘`,
  dcac: `┌─────────────────────────────────────────────────────────────────┐
│  DC/AC Ratio Analysis: 1:1 vs 1.3:1 Oversizing                 │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │              [Hourly Production Chart]                  │   │
│  │         Showing baseline, oversized, clipping           │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  KEY FINDINGS                                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │   +12.4%    │ │   -2.1%     │ │   +10.3%    │              │
│  │  Additional │ │  Clipping   │ │    NET      │              │
│  │  DC Capture │ │   Losses    │ │    GAIN     │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
│                                                                 │
│  💡 Recommendation: 1.3:1 oversizing delivers 10.3% more       │
│     energy annually with minimal clipping impact.              │
└─────────────────────────────────────────────────────────────────┘`,
  export: `┌─────────────────────────────────────────────┐
│  Export Report                          [X] │
├─────────────────────────────────────────────┤
│                                             │
│  FORMAT                                     │
│  ○ PDF Document                             │
│  ○ Excel Workbook                           │
│  ○ Google Docs                              │
│  ○ Google Slides                            │
│  ○ Google Sheets                            │
│                                             │
│  OPTIONS                                    │
│  ☑ Include cover page                       │
│  ☑ Include table of contents                │
│  ☐ High resolution charts (larger file)     │
│                                             │
│  ─────────────────────────────────────────  │
│  Estimated size: ~4.2 MB                    │
│                                             │
│        [Cancel]        [Export]             │
└─────────────────────────────────────────────┘`
};

function ChartDemo() {
  const [solarCapacity, setSolarCapacity] = useState(100);
  const [dcAcRatio, setDcAcRatio] = useState(1.3);

  const analysis = useMemo(
    () => calculateDcAcAnalysis(solarCapacity, dcAcRatio),
    [solarCapacity, dcAcRatio]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Live Chart Demo
        </CardTitle>
        <CardDescription>
          Interactive DC/AC ratio analysis - adjust parameters to see real-time changes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Solar Capacity (AC)</Label>
                <span className="text-sm text-muted-foreground">{solarCapacity} kW</span>
              </div>
              <Slider
                value={[solarCapacity]}
                onValueChange={([v]) => setSolarCapacity(v)}
                min={50}
                max={500}
                step={10}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>DC/AC Ratio</Label>
                <span className="text-sm text-muted-foreground">{dcAcRatio.toFixed(2)}:1</span>
              </div>
              <Slider
                value={[dcAcRatio * 100]}
                onValueChange={([v]) => setDcAcRatio(v / 100)}
                min={100}
                max={150}
                step={5}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-2xl font-bold text-primary">
                {(solarCapacity * dcAcRatio).toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground">kWp DC Capacity</p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-2xl font-bold text-chart-1">
                +{analysis.net_gain_percent}%
              </p>
              <p className="text-xs text-muted-foreground">Net Energy Gain</p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-2xl font-bold text-destructive">
                {analysis.clipping_percent}%
              </p>
              <p className="text-xs text-muted-foreground">Clipping Loss</p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-2xl font-bold">
                {analysis.oversized_annual_kwh.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">kWh/year</p>
            </div>
          </div>
        </div>
        <DcAcRatioChart analysis={analysis} dcAcRatio={dcAcRatio} />
      </CardContent>
    </Card>
  );
}

export function ReportsRoadmap() {
  const [selectedPhase, setSelectedPhase] = useState<Phase>(phases[0]);
  
  const completedPhases = phases.filter(p => p.status === "completed").length;
  const totalProgress = Math.round((completedPhases / phases.length) * 100);

  const getStatusIcon = (status: Phase["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in-progress":
        return <Clock className="h-4 w-4 text-amber-500" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: Phase["status"]) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500">Complete</Badge>;
      case "in-progress":
        return <Badge variant="default" className="bg-amber-500">In Progress</Badge>;
      default:
        return <Badge variant="outline">Upcoming</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Report Builder
          </h2>
          <p className="text-sm text-muted-foreground">
            Visual-first reporting system with DC/AC analysis, infographics, and KPIs
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{totalProgress}%</div>
          <div className="text-xs text-muted-foreground">Overall Progress</div>
        </div>
      </div>

      {/* Progress Bar */}
      <Progress value={totalProgress} className="h-2" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Phase List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Development Phases</CardTitle>
            <CardDescription>8 phases • {completedPhases} complete</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="space-y-1 p-4 pt-0">
                {phases.map((phase) => (
                  <button
                    key={phase.id}
                    onClick={() => setSelectedPhase(phase)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                      selectedPhase.id === phase.id
                        ? "bg-accent"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {getStatusIcon(phase.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Phase {phase.id}</span>
                      </div>
                      <div className="font-medium text-sm truncate">{phase.name}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Phase Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <selectedPhase.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    Phase {selectedPhase.id}: {selectedPhase.name}
                  </CardTitle>
                  <CardDescription>{selectedPhase.description}</CardDescription>
                </div>
              </div>
              {getStatusBadge(selectedPhase.status)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Deliverables</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedPhase.deliverables.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Circle className="h-2 w-2 text-muted-foreground" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPhase.status !== "completed" && (
                <div className="pt-4 border-t space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Copy and paste this prompt into chat to begin:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md">
                      Let's start Phase {selectedPhase.id}: {selectedPhase.name}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `Let's start Phase ${selectedPhase.id}: ${selectedPhase.name}`
                        );
                        toast.success("Prompt copied to clipboard");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Demo Section */}
      <ChartDemo />

      {/* Report Builder UI */}
      <ReportBuilder projectName="Demo Solar Project" />

      {/* Analytics Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Usage Analytics
          </CardTitle>
          <CardDescription>Track report generation and export activity</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportAnalyticsDashboard />
        </CardContent>
      </Card>

      {/* Export Demo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ReportExport
          reportName="Demo Solar Report"
          segments={[
            { id: "1", type: "executive_summary", enabled: true, order: 0 },
            { id: "2", type: "dcac_comparison", enabled: true, order: 1 },
            { id: "3", type: "payback_timeline", enabled: true, order: 2 },
            { id: "4", type: "engineering_specs", enabled: true, order: 3 },
            { id: "5", type: "environmental_impact", enabled: true, order: 4 },
          ]}
          branding={{
            company_name: "Solar Solutions Inc",
            primary_color: "#22c55e",
            secondary_color: "#0f172a",
            contact_email: "info@solarsolutions.co.za",
            contact_phone: "+27 11 123 4567",
            website: "www.solarsolutions.co.za"
          }}
          reportData={{
            project: {
              name: "Demo Shopping Centre",
              location: "Johannesburg, South Africa",
              total_area_sqm: 15000,
              connection_size_kva: 800,
              tenant_count: 45
            },
            simulation: {
              solar_capacity_kwp: 500,
              battery_capacity_kwh: 200,
              battery_power_kw: 100,
              dc_ac_ratio: 130,
              annual_solar_generation_kwh: 825000,
              annual_consumption_kwh: 1200000,
              self_consumption_kwh: 742500,
              grid_import_kwh: 457500,
              grid_export_kwh: 82500
            },
            kpis: {
              specific_yield: 1650,
              performance_ratio: 82.5,
              capacity_factor: 18.8,
              lcoe: 0.85,
              self_consumption_rate: 90,
              solar_coverage: 61.9,
              grid_independence: 68.5,
              peak_shaving_kw: 150
            },
            dcAcAnalysis: {
              baseline_annual_kwh: 735000,
              oversized_annual_kwh: 825000,
              clipping_loss_kwh: 18000,
              additional_capture_kwh: 108000,
              net_gain_kwh: 90000,
              net_gain_percent: 12.2,
              clipping_percent: 2.1,
              hourly_comparison: [],
              monthly_comparison: [
                { month: "Jan", baseline_kwh: 68000, oversized_kwh: 76500, gain_kwh: 8500, gain_percent: 12.5 },
                { month: "Feb", baseline_kwh: 62000, oversized_kwh: 69500, gain_kwh: 7500, gain_percent: 12.1 },
                { month: "Mar", baseline_kwh: 65000, oversized_kwh: 73000, gain_kwh: 8000, gain_percent: 12.3 },
                { month: "Apr", baseline_kwh: 58000, oversized_kwh: 65000, gain_kwh: 7000, gain_percent: 12.1 },
                { month: "May", baseline_kwh: 52000, oversized_kwh: 58000, gain_kwh: 6000, gain_percent: 11.5 },
                { month: "Jun", baseline_kwh: 48000, oversized_kwh: 53500, gain_kwh: 5500, gain_percent: 11.5 },
                { month: "Jul", baseline_kwh: 50000, oversized_kwh: 56000, gain_kwh: 6000, gain_percent: 12.0 },
                { month: "Aug", baseline_kwh: 55000, oversized_kwh: 61500, gain_kwh: 6500, gain_percent: 11.8 },
                { month: "Sep", baseline_kwh: 60000, oversized_kwh: 67500, gain_kwh: 7500, gain_percent: 12.5 },
                { month: "Oct", baseline_kwh: 65000, oversized_kwh: 73000, gain_kwh: 8000, gain_percent: 12.3 },
                { month: "Nov", baseline_kwh: 70000, oversized_kwh: 78500, gain_kwh: 8500, gain_percent: 12.1 },
                { month: "Dec", baseline_kwh: 72000, oversized_kwh: 81000, gain_kwh: 9000, gain_percent: 12.5 }
              ]
            },
            financials: {
              system_cost: 6500000,
              annual_grid_cost_baseline: 2400000,
              annual_grid_cost_with_solar: 915000,
              annual_savings: 1485000,
              payback_years: 4.4,
              roi_percent: 471,
              npv: 12500000,
              irr: 28.5,
              yearly_cashflows: Array.from({ length: 25 }, (_, i) => ({
                year: i + 1,
                cumulative_savings: 1485000 * (i + 1) * 0.98,
                cumulative_cost: 6500000,
                net_position: 1485000 * (i + 1) * 0.98 - 6500000
              }))
            },
            environmental: {
              co2_avoided_tons: 742,
              trees_equivalent: 12200,
              car_miles_avoided: 1850000,
              homes_powered_equivalent: 68.5,
              grid_emission_factor: 0.9
            }
          }}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phase 5 Complete</CardTitle>
            <CardDescription>PDF and Excel export functionality is now available</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">PDF with cover page & TOC</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">Segment-based content pages</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">Data tables with styling</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">Excel/CSV comprehensive export</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wireframes Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">UI Wireframes</CardTitle>
          <CardDescription>Preview mockups for Phase 0 design validation</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="builder">
            <TabsList>
              <TabsTrigger value="builder">Report Builder</TabsTrigger>
              <TabsTrigger value="executive">Executive Summary</TabsTrigger>
              <TabsTrigger value="dcac">DC/AC Chart</TabsTrigger>
              <TabsTrigger value="export">Export Dialog</TabsTrigger>
            </TabsList>

            <TabsContent value="builder" className="mt-4">
              <ScrollArea className="h-[400px]">
                <pre className="text-xs font-mono bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre">
                  {wireframes.builder}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="executive" className="mt-4">
              <ScrollArea className="h-[400px]">
                <pre className="text-xs font-mono bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre">
                  {wireframes.executive}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="dcac" className="mt-4">
              <ScrollArea className="h-[400px]">
                <pre className="text-xs font-mono bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre">
                  {wireframes.dcac}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="export" className="mt-4">
              <ScrollArea className="h-[400px]">
                <pre className="text-xs font-mono bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre">
                  {wireframes.export}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
