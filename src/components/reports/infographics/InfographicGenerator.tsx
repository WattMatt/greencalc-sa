import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Sparkles, 
  FileText, 
  Cpu, 
  PiggyBank, 
  Leaf, 
  Settings2,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

type InfographicType = "executive" | "system" | "savings" | "environmental" | "engineering";

interface InfographicData {
  projectName?: string;
  solarCapacityKwp?: number;
  batteryCapacityKwh?: number;
  annualSavings?: number;
  paybackYears?: number;
  roiPercent?: number;
  co2AvoidedTons?: number;
  selfConsumptionPercent?: number;
  dcAcRatio?: number;
}

interface GeneratedInfographic {
  type: InfographicType;
  imageUrl: string;
  description: string;
}

const infographicTypes: { type: InfographicType; label: string; icon: React.ElementType; description: string }[] = [
  { type: "executive", label: "Executive Summary", icon: FileText, description: "Key metrics overview for stakeholders" },
  { type: "system", label: "System Overview", icon: Cpu, description: "Technical system diagram" },
  { type: "savings", label: "Savings Breakdown", icon: PiggyBank, description: "Financial savings visualization" },
  { type: "environmental", label: "Environmental Impact", icon: Leaf, description: "CO2 reduction and sustainability" },
  { type: "engineering", label: "Engineering Specs", icon: Settings2, description: "Technical specifications panel" },
];

interface InfographicGeneratorProps {
  data?: InfographicData;
  className?: string;
}

export function InfographicGenerator({ data, className }: InfographicGeneratorProps) {
  const [generated, setGenerated] = useState<Map<InfographicType, GeneratedInfographic>>(new Map());
  const [failed, setFailed] = useState<Set<InfographicType>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: infographicTypes.length });
  const hasStartedGeneration = useRef(false);

  const defaultData: InfographicData = {
    projectName: "Demo Solar Project",
    solarCapacityKwp: 100,
    batteryCapacityKwh: 50,
    annualSavings: 450000,
    paybackYears: 5.2,
    roiPercent: 18.5,
    co2AvoidedTons: 120,
    selfConsumptionPercent: 72,
    dcAcRatio: 1.3,
    ...data,
  };

  // Auto-generate all infographics when data is available
  useEffect(() => {
    if (hasStartedGeneration.current) return;
    if (!data?.solarCapacityKwp) return; // Only generate when we have real simulation data
    
    hasStartedGeneration.current = true;
    generateAllInfographics();
  }, [data?.solarCapacityKwp]);

  const generateSingleInfographic = async (type: InfographicType): Promise<boolean> => {
    try {
      const { data: result, error } = await supabase.functions.invoke("generate-report-infographic", {
        body: { type, data: defaultData },
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);

      setGenerated(prev => new Map(prev).set(type, {
        type,
        imageUrl: result.imageUrl,
        description: result.description,
      }));
      setFailed(prev => {
        const next = new Set(prev);
        next.delete(type);
        return next;
      });
      return true;
    } catch (error) {
      console.error(`Error generating ${type} infographic:`, error);
      setFailed(prev => new Set(prev).add(type));
      return false;
    }
  };

  const generateAllInfographics = async () => {
    setIsGenerating(true);
    setProgress({ current: 0, total: infographicTypes.length });
    
    let successCount = 0;
    for (let i = 0; i < infographicTypes.length; i++) {
      const { type } = infographicTypes[i];
      setProgress({ current: i + 1, total: infographicTypes.length });
      const success = await generateSingleInfographic(type);
      if (success) successCount++;
      // Small delay between requests to avoid rate limiting
      if (i < infographicTypes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setIsGenerating(false);
    if (successCount === infographicTypes.length) {
      toast.success("All infographics generated successfully");
    } else if (successCount > 0) {
      toast.warning(`Generated ${successCount}/${infographicTypes.length} infographics`);
    }
  };

  const retryFailed = async () => {
    const failedTypes = Array.from(failed);
    setIsGenerating(true);
    setProgress({ current: 0, total: failedTypes.length });
    
    for (let i = 0; i < failedTypes.length; i++) {
      setProgress({ current: i + 1, total: failedTypes.length });
      await generateSingleInfographic(failedTypes[i]);
      if (i < failedTypes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setIsGenerating(false);
  };

  const downloadImage = (imageUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = () => {
    generated.forEach((infographic) => {
      downloadImage(infographic.imageUrl, `${infographic.type}-infographic`);
    });
    toast.success("Downloading all infographics");
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  const allGenerated = generated.size === infographicTypes.length;
  const hasFailed = failed.size > 0;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Report Infographics
            </CardTitle>
            <CardDescription>
              {isGenerating 
                ? `Generating infographics... (${progress.current}/${progress.total})`
                : allGenerated 
                  ? "All infographics ready for your report"
                  : hasFailed
                    ? `${generated.size} generated, ${failed.size} failed`
                    : "Preparing infographics..."}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {hasFailed && !isGenerating && (
              <Button variant="outline" size="sm" onClick={retryFailed}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry Failed
              </Button>
            )}
            {generated.size > 0 && (
              <Button variant="outline" size="sm" onClick={downloadAll}>
                <Download className="h-4 w-4 mr-1" />
                Download All
              </Button>
            )}
          </div>
        </div>
        {isGenerating && (
          <Progress value={progressPercent} className="mt-3" />
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {infographicTypes.map(({ type, label, icon: Icon }) => {
            const isGenerated = generated.has(type);
            const isFailed = failed.has(type);
            const isCurrentlyGenerating = isGenerating && 
              progress.current > 0 && 
              infographicTypes[progress.current - 1]?.type === type;
            
            return (
              <div
                key={type}
                className={`relative p-4 rounded-lg border text-left transition-all ${
                  isGenerated 
                    ? "border-primary bg-primary/5" 
                    : isFailed
                      ? "border-destructive bg-destructive/5"
                      : "border-border bg-muted/30"
                }`}
              >
                {isCurrentlyGenerating && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                    <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-primary" />
                  {isGenerated && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  {isFailed && <AlertCircle className="h-4 w-4 text-destructive" />}
                </div>
                <p className="font-medium text-sm">{label}</p>
                {isGenerated && (
                  <Badge variant="outline" className="mt-2 text-xs">
                    Ready
                  </Badge>
                )}
                {isFailed && (
                  <Badge variant="destructive" className="mt-2 text-xs">
                    Failed
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Generated Images */}
        {generated.size > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium">Generated Infographics</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from(generated.values()).map((infographic) => (
                <div key={infographic.type} className="relative group rounded-lg border overflow-hidden">
                  <img 
                    src={infographic.imageUrl} 
                    alt={infographic.description}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => downloadImage(infographic.imageUrl, `${infographic.type}-infographic`)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                  <div className="p-2 bg-muted">
                    <p className="text-sm font-medium">
                      {infographicTypes.find(t => t.type === infographic.type)?.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isGenerating && generated.size === 0 && (
          <div className="space-y-3">
            <Skeleton className="h-48 w-full rounded-lg" />
            <p className="text-sm text-center text-muted-foreground">
              Generating infographics automatically...
            </p>
          </div>
        )}

        {/* No Data State */}
        {!isGenerating && generated.size === 0 && !data?.solarCapacityKwp && (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Infographics will be generated automatically when simulation data is available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
