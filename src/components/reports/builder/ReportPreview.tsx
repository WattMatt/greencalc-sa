import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileText, 
  BarChart3, 
  Sparkles, 
  DollarSign, 
  Leaf, 
  Settings2,
  Image,
  Sun,
  Battery,
  Zap,
  TrendingUp,
  RefreshCw
} from "lucide-react";
import { Segment } from "./SegmentSelector";

interface ReportPreviewProps {
  segments: Segment[];
  projectName?: string;
  className?: string;
}

const segmentIcons: Record<string, React.ElementType> = {
  executive_summary: FileText,
  dcac_comparison: BarChart3,
  energy_flow: Sparkles,
  monthly_yield: BarChart3,
  payback_timeline: DollarSign,
  savings_breakdown: DollarSign,
  environmental_impact: Leaf,
  engineering_specs: Settings2,
  ai_infographics: Sparkles,
};

// Sample data for previews
const sampleData = {
  solarCapacity: 100,
  batteryCapacity: 50,
  annualYield: 186400,
  annualSavings: 450000,
  paybackYears: 5.2,
  co2Avoided: 120,
  selfConsumption: 72,
  dcAcRatio: 1.3,
};

function AIInfographicSegment({ projectName }: { projectName: string }) {
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateInfographic = async () => {
      if (imageUrl || generating) return;
      
      setGenerating(true);
      setError(null);
      
      try {
        const { data, error: fnError } = await supabase.functions.invoke("generate-report-infographic", {
          body: { 
            type: "executive", 
            data: {
              projectName,
              solarCapacityKwp: sampleData.solarCapacity,
              batteryCapacityKwh: sampleData.batteryCapacity,
              annualSavings: sampleData.annualSavings,
              paybackYears: sampleData.paybackYears,
              co2AvoidedTons: sampleData.co2Avoided,
              selfConsumptionPercent: sampleData.selfConsumption,
              dcAcRatio: sampleData.dcAcRatio,
            }
          },
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        
        setImageUrl(data?.imageUrl);
      } catch (err) {
        console.error("Failed to generate infographic:", err);
        setError(err instanceof Error ? err.message : "Generation failed");
      } finally {
        setGenerating(false);
      }
    };

    generateInfographic();
  }, [projectName, imageUrl, generating]);

  if (generating) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2 text-[10px] text-primary">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Generating AI infographic...</span>
        </div>
        <Skeleton className="h-24 w-full rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-[10px] text-muted-foreground">
        <Sparkles className="h-6 w-6 mx-auto mb-1 opacity-30" />
        <p>Could not generate infographic</p>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (imageUrl) {
    return (
      <div className="space-y-2">
        <img 
          src={imageUrl} 
          alt="AI Generated Infographic" 
          className="w-full rounded border object-cover"
        />
        <p className="text-[8px] text-center text-muted-foreground">
          AI-generated executive summary
        </p>
      </div>
    );
  }

  return (
    <div className="text-center text-muted-foreground">
      <Sparkles className="h-6 w-6 mx-auto mb-1 opacity-30" />
      <p className="text-[10px]">Preparing infographic...</p>
    </div>
  );
}

function SegmentContent({ segmentId, projectName }: { segmentId: string; projectName: string }) {
  switch (segmentId) {
    case "ai_infographics":
      return <AIInfographicSegment projectName={projectName} />;
      
    case "executive_summary":
      return (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <MetricBox icon={<Sun className="h-3 w-3" />} label="Solar Capacity" value="100 kWp" />
            <MetricBox icon={<Battery className="h-3 w-3" />} label="Battery" value="50 kWh" />
            <MetricBox icon={<DollarSign className="h-3 w-3" />} label="Annual Savings" value="R450,000" />
            <MetricBox icon={<TrendingUp className="h-3 w-3" />} label="Payback" value="5.2 years" />
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            This proposal outlines a comprehensive solar PV solution designed to reduce grid dependency 
            and achieve significant cost savings through renewable energy generation.
          </p>
        </div>
      );
    
    case "dcac_comparison":
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px]">
            <span>DC/AC Ratio</span>
            <span className="font-bold text-primary">1.3:1</span>
          </div>
          <div className="h-2 bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 rounded-full relative">
            <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-background border border-primary rounded-full" style={{ left: "30%" }} />
          </div>
          <div className="grid grid-cols-3 gap-1 text-[9px] text-center mt-2">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-1">
              <p className="font-bold text-emerald-600">+12%</p>
              <p className="text-muted-foreground">Yield Gain</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded p-1">
              <p className="font-bold text-amber-600">0.9%</p>
              <p className="text-muted-foreground">Clipping</p>
            </div>
            <div className="bg-primary/10 rounded p-1">
              <p className="font-bold text-primary">+11.1%</p>
              <p className="text-muted-foreground">Net Benefit</p>
            </div>
          </div>
        </div>
      );
    
    case "energy_flow":
      return (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <EnergyNode icon={<Sun />} label="Solar" value="186 MWh" color="text-amber-500" />
            <div className="flex-1 mx-2 border-t border-dashed" />
            <EnergyNode icon={<Zap />} label="Load" value="258 MWh" color="text-blue-500" />
          </div>
          <div className="flex justify-center">
            <EnergyNode icon={<Battery />} label="Battery" value="50 kWh" color="text-emerald-500" />
          </div>
          <div className="text-[9px] text-center text-muted-foreground">
            Self-consumption: 72% | Grid import: 28%
          </div>
        </div>
      );
    
    case "monthly_yield":
      return (
        <div className="space-y-2">
          <div className="flex items-end justify-between h-16 gap-0.5">
            {[65, 70, 85, 90, 100, 95, 92, 88, 80, 75, 68, 62].map((h, i) => (
              <div 
                key={i} 
                className="flex-1 bg-primary/60 rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[8px] text-muted-foreground">
            <span>Jan</span><span>Jun</span><span>Dec</span>
          </div>
          <p className="text-[9px] text-center">Annual Yield: 186,400 kWh (1,864 kWh/kWp)</p>
        </div>
      );
    
    case "payback_timeline":
      return (
        <div className="space-y-2">
          <div className="relative h-8 bg-muted rounded">
            <div className="absolute left-0 top-0 h-full w-[52%] bg-emerald-500/60 rounded-l" />
            <div className="absolute left-[52%] top-1/2 -translate-y-1/2 w-1 h-4 bg-primary" />
          </div>
          <div className="flex justify-between text-[9px]">
            <span>Year 0</span>
            <span className="font-bold text-emerald-600">Payback: 5.2 yrs</span>
            <span>Year 25</span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[9px]">
            <div className="bg-muted/50 rounded p-1 text-center">
              <p className="font-bold">R2.1M</p>
              <p className="text-muted-foreground">System Cost</p>
            </div>
            <div className="bg-muted/50 rounded p-1 text-center">
              <p className="font-bold text-emerald-600">R11.25M</p>
              <p className="text-muted-foreground">25-yr Savings</p>
            </div>
          </div>
        </div>
      );
    
    case "savings_breakdown":
      return (
        <div className="space-y-2">
          <div className="space-y-1">
            <SavingsBar label="Peak savings" value={45} amount="R202k" color="bg-red-400" />
            <SavingsBar label="Standard savings" value={35} amount="R157k" color="bg-amber-400" />
            <SavingsBar label="Off-peak savings" value={20} amount="R90k" color="bg-emerald-400" />
          </div>
          <Separator />
          <div className="flex justify-between text-[10px] font-bold">
            <span>Total Annual Savings</span>
            <span className="text-emerald-600">R450,000</span>
          </div>
        </div>
      );
    
    case "environmental_impact":
      return (
        <div className="space-y-2 text-center">
          <div className="flex justify-center gap-4">
            <div>
              <Leaf className="h-8 w-8 mx-auto text-emerald-500 mb-1" />
              <p className="text-lg font-bold text-emerald-600">120</p>
              <p className="text-[9px] text-muted-foreground">tonnes CO₂/yr</p>
            </div>
            <div>
              <span className="text-2xl">🌳</span>
              <p className="text-lg font-bold">5,454</p>
              <p className="text-[9px] text-muted-foreground">trees equivalent</p>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground">
            25-year impact: 3,000 tonnes CO₂ avoided
          </p>
        </div>
      );
    
    case "engineering_specs":
      return (
        <div className="space-y-1 text-[9px]">
          <SpecRow label="PV Modules" value="250 × 400W panels" />
          <SpecRow label="Inverter" value="3 × 33kW SMA Tripower" />
          <SpecRow label="DC/AC Ratio" value="1.30:1" />
          <SpecRow label="Tilt / Azimuth" value="25° / 0° (North)" />
          <SpecRow label="Battery" value="50kWh LFP @ 25kW" />
          <SpecRow label="Expected PR" value="80%" />
        </div>
      );
    
    default:
      return (
        <div className="text-center text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-1 opacity-30" />
          <p className="text-[10px]">Content preview</p>
        </div>
      );
  }
}

function MetricBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-primary mb-0.5">{icon}</div>
      <p className="font-bold text-[11px]">{value}</p>
      <p className="text-[8px] text-muted-foreground">{label}</p>
    </div>
  );
}

function EnergyNode({ icon, label, value, color }: { icon: React.ReactElement; label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center mx-auto ${color}`}>
        {React.cloneElement(icon, { className: "h-4 w-4" })}
      </div>
      <p className="text-[9px] font-medium mt-0.5">{label}</p>
      <p className="text-[8px] text-muted-foreground">{value}</p>
    </div>
  );
}

function SavingsBar({ label, value, amount, color }: { label: string; value: number; amount: string; color: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[9px]">
        <span>{label}</span>
        <span className="font-medium">{amount}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 border-b border-dashed last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function ReportPreview({ segments, projectName = "Demo Solar Project", className }: ReportPreviewProps) {
  const enabledSegments = segments.filter(s => s.enabled);
  const totalPages = Math.ceil(enabledSegments.length / 2) + 1;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Live Preview</CardTitle>
          <Badge variant="outline">{totalPages} pages</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-4">
            {/* Cover Page */}
            <div className="aspect-[8.5/11] bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border p-6 flex flex-col">
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                  <Sun className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold">{projectName}</h3>
                <p className="text-sm text-muted-foreground mt-1">Solar Energy Proposal</p>
                <Separator className="my-4 w-24" />
                <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
                  <div>
                    <p className="font-semibold">100 kWp</p>
                    <p className="text-muted-foreground">Solar Capacity</p>
                  </div>
                  <div>
                    <p className="font-semibold">50 kWh</p>
                    <p className="text-muted-foreground">Battery Storage</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Generated {new Date().toLocaleDateString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Page 1 of {totalPages}</p>
              </div>
            </div>

            {/* Content Pages */}
            {enabledSegments.map((segment, index) => {
              const Icon = segmentIcons[segment.id] || FileText;
              const pageNum = Math.floor(index / 2) + 2;
              
              return (
                <div 
                  key={segment.id}
                  className="aspect-[8.5/11] bg-background rounded-lg border p-4 flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                    <Icon className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm">{segment.label}</h4>
                  </div>
                  
                  <div className="flex-1">
                    <SegmentContent segmentId={segment.id} projectName={projectName} />
                  </div>
                  
                  <div className="mt-3 pt-2 border-t text-center">
                    <p className="text-xs text-muted-foreground">Page {pageNum} of {totalPages}</p>
                  </div>
                </div>
              );
            })}

            {enabledSegments.length === 0 && (
              <div className="aspect-[8.5/11] bg-muted/20 rounded-lg border border-dashed flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No segments selected</p>
                  <p className="text-xs mt-1">Select segments to preview your report</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}