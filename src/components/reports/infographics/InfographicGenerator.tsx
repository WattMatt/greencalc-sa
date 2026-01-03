import React, { useState, useEffect } from "react";
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
  Zap,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useInfographicGeneration, getCacheKey, type InfographicType, type InfographicData } from "@/hooks/useInfographicGeneration";

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
  { type: "tariff", label: "Tariff Explainer", icon: Zap, description: "TOU pricing visualization" },
];

interface InfographicGeneratorProps {
  data?: InfographicData;
  projectId?: string;
  className?: string;
}

export function InfographicGenerator({ data, projectId, className }: InfographicGeneratorProps) {
  const [cached, setCached] = useState<Map<InfographicType, GeneratedInfographic>>(new Map());
  const [isLoadingCache, setIsLoadingCache] = useState(true);
  
  const { generating, progress, generateInfographics } = useInfographicGeneration();

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

  // Load cached infographics on mount
  useEffect(() => {
    if (!projectId || !data?.solarCapacityKwp) {
      setIsLoadingCache(false);
      return;
    }
    loadCachedInfographics();
  }, [projectId, data?.solarCapacityKwp]);

  const loadCachedInfographics = async () => {
    if (!projectId) return;
    
    setIsLoadingCache(true);
    const cachedMap = new Map<InfographicType, GeneratedInfographic>();
    
    try {
      for (const { type, label } of infographicTypes) {
        const cacheKey = getCacheKey(defaultData, type);
        const filePath = `${projectId}/${cacheKey}.png`;
        
        const { data: urlData } = supabase.storage
          .from('report-infographics')
          .getPublicUrl(filePath);
        
        // Check if file exists by making a HEAD request
        const response = await fetch(urlData.publicUrl, { method: 'HEAD' });
        if (response.ok) {
          cachedMap.set(type, {
            type,
            imageUrl: urlData.publicUrl,
            description: label,
          });
        }
      }
      
      setCached(cachedMap);
    } catch (error) {
      console.error("Error loading cached infographics:", error);
    } finally {
      setIsLoadingCache(false);
    }
  };

  const handleRegenerate = async () => {
    if (!projectId || !data?.solarCapacityKwp) {
      toast.error("Cannot regenerate: missing project or simulation data");
      return;
    }
    
    await generateInfographics(defaultData, projectId);
    // Reload cached after regeneration
    await loadCachedInfographics();
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
    cached.forEach((infographic) => {
      downloadImage(infographic.imageUrl, `${infographic.type}-infographic`);
    });
    toast.success("Downloading all infographics");
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  const allCached = cached.size === infographicTypes.length;

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
              {isLoadingCache 
                ? "Loading cached infographics..."
                : generating 
                  ? `Generating... (${progress.current}/${progress.total})`
                  : allCached 
                    ? "All infographics ready for your report"
                    : `${cached.size}/${infographicTypes.length} cached • Regenerate to create missing`}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRegenerate}
              disabled={generating || isLoadingCache || !data?.solarCapacityKwp}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${generating ? 'animate-spin' : ''}`} />
              {generating ? "Generating..." : "Regenerate"}
            </Button>
            {cached.size > 0 && (
              <Button variant="outline" size="sm" onClick={downloadAll}>
                <Download className="h-4 w-4 mr-1" />
                Download All
              </Button>
            )}
          </div>
        </div>
        {generating && (
          <Progress value={progressPercent} className="mt-3" />
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {infographicTypes.map(({ type, label, icon: Icon }) => {
            const isCached = cached.has(type);
            const isCurrentlyGenerating = generating && progress.currentType === type;
            
            return (
              <div
                key={type}
                className={`relative p-3 rounded-lg border text-left transition-all ${
                  isCached 
                    ? "border-primary bg-primary/5" 
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
                  {isCached && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                </div>
                <p className="font-medium text-xs">{label}</p>
                {isCached ? (
                  <Badge variant="outline" className="mt-1 text-[10px]">Ready</Badge>
                ) : (
                  <Badge variant="secondary" className="mt-1 text-[10px]">Not cached</Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Generated Images */}
        {cached.size > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium">Cached Infographics</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from(cached.values()).map((infographic) => (
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
        {isLoadingCache && (
          <div className="space-y-3">
            <Skeleton className="h-48 w-full rounded-lg" />
            <p className="text-sm text-center text-muted-foreground">
              Loading cached infographics...
            </p>
          </div>
        )}

        {/* No Data State */}
        {!isLoadingCache && !generating && cached.size === 0 && !data?.solarCapacityKwp && (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Run a simulation to generate infographics</p>
            <p className="text-sm mt-1">Infographics are auto-generated when you save a simulation</p>
          </div>
        )}

        {/* No cached but has data state */}
        {!isLoadingCache && !generating && cached.size === 0 && data?.solarCapacityKwp && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No cached infographics found</p>
            <p className="text-sm mt-1">Click "Regenerate" to create infographics for this simulation</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
