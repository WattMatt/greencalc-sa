import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  RefreshCw
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
  const [generating, setGenerating] = useState<InfographicType | "all" | null>(null);
  const [generated, setGenerated] = useState<Map<InfographicType, GeneratedInfographic>>(new Map());
  const [progress, setProgress] = useState({ current: 0, total: 0 });

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
      return true;
    } catch (error) {
      console.error(`Error generating ${type} infographic:`, error);
      return false;
    }
  };

  const generateInfographic = async (type: InfographicType) => {
    setGenerating(type);
    const success = await generateSingleInfographic(type);
    if (success) {
      toast.success(`${infographicTypes.find(t => t.type === type)?.label} generated!`);
    } else {
      toast.error("Failed to generate infographic");
    }
    setGenerating(null);
  };

  const generateAllInfographics = async () => {
    setGenerating("all");
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
    
    setGenerating(null);
    setProgress({ current: 0, total: 0 });
    toast.success(`Generated ${successCount}/${infographicTypes.length} infographics`);
  };

  const downloadImage = (imageUrl: string, filename: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Infographic Generator
        </CardTitle>
        <CardDescription>
          Generate professional infographics for your solar project report
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Generate All Button */}
        <div className="flex justify-end">
          <Button
            onClick={generateAllInfographics}
            disabled={generating !== null}
            className="gap-2"
          >
            {generating === "all" ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating {progress.current}/{progress.total}...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate All Infographics
              </>
            )}
          </Button>
        </div>

        {/* Type Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {infographicTypes.map(({ type, label, icon: Icon, description }) => {
            const isGenerated = generated.has(type);
            const isGenerating = generating === type || (generating === "all" && progress.current > 0 && infographicTypes[progress.current - 1]?.type === type);
            
            return (
              <button
                key={type}
                onClick={() => generateInfographic(type)}
                disabled={generating !== null}
                className={`relative p-4 rounded-lg border text-left transition-all ${
                  isGenerated 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                } ${generating !== null && !isGenerating ? "opacity-50" : ""}`}
              >
                {isGenerating && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                    <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
                <Icon className="h-5 w-5 mb-2 text-primary" />
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
                {isGenerated && (
                  <Badge variant="default" className="absolute top-2 right-2 text-xs">
                    Done
                  </Badge>
                )}
              </button>
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateInfographic(infographic.type)}
                      disabled={generating !== null}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Regenerate
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

        {/* Empty State */}
        {generated.size === 0 && generating === null && (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Click any infographic type above to generate</p>
          </div>
        )}

        {/* Loading State */}
        {generating && generated.size === 0 && (
          <div className="space-y-3">
            <Skeleton className="h-48 w-full rounded-lg" />
            <p className="text-sm text-center text-muted-foreground">
              Generating {infographicTypes.find(t => t.type === generating)?.label}...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
