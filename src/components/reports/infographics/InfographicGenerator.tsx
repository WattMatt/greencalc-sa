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
  projectId?: string;
  className?: string;
}

// Generate a cache key based on key simulation params
const getCacheKey = (data: InfographicData, type: InfographicType): string => {
  const keyParams = `${data.solarCapacityKwp}-${data.batteryCapacityKwh}-${data.annualSavings}-${type}`;
  return keyParams.replace(/\./g, '_');
};

export function InfographicGenerator({ data, projectId, className }: InfographicGeneratorProps) {
  const [generated, setGenerated] = useState<Map<InfographicType, GeneratedInfographic>>(new Map());
  const [failed, setFailed] = useState<Set<InfographicType>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingCache, setIsLoadingCache] = useState(true);
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
      
      if (cachedMap.size > 0) {
        setGenerated(cachedMap);
        if (cachedMap.size === infographicTypes.length) {
          hasStartedGeneration.current = true; // Prevent re-generation
        }
      }
    } catch (error) {
      console.error("Error loading cached infographics:", error);
    } finally {
      setIsLoadingCache(false);
    }
  };

  const uploadToStorage = async (imageUrl: string, type: InfographicType): Promise<string | null> => {
    if (!projectId) return imageUrl;
    
    try {
      // Fetch the image as blob
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      const cacheKey = getCacheKey(defaultData, type);
      const filePath = `${projectId}/${cacheKey}.png`;
      
      // Upload to storage (upsert)
      const { error: uploadError } = await supabase.storage
        .from('report-infographics')
        .upload(filePath, blob, { 
          contentType: 'image/png',
          upsert: true 
        });
      
      if (uploadError) {
        console.error("Error uploading infographic:", uploadError);
        return imageUrl;
      }
      
      // Return public URL
      const { data: urlData } = supabase.storage
        .from('report-infographics')
        .getPublicUrl(filePath);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error("Error caching infographic:", error);
      return imageUrl;
    }
  };

  // Auto-generate missing infographics when data is available and cache is loaded
  useEffect(() => {
    if (hasStartedGeneration.current) return;
    if (isLoadingCache) return;
    if (!data?.solarCapacityKwp) return;
    
    // Check if we need to generate any infographics
    const missingTypes = infographicTypes.filter(({ type }) => !generated.has(type));
    if (missingTypes.length === 0) return;
    
    hasStartedGeneration.current = true;
    generateMissingInfographics(missingTypes.map(t => t.type));
  }, [data?.solarCapacityKwp, isLoadingCache, generated.size]);

  const generateSingleInfographic = async (type: InfographicType): Promise<boolean> => {
    try {
      const { data: result, error } = await supabase.functions.invoke("generate-report-infographic", {
        body: { type, data: defaultData },
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);

      // Cache to storage
      const cachedUrl = await uploadToStorage(result.imageUrl, type);

      setGenerated(prev => new Map(prev).set(type, {
        type,
        imageUrl: cachedUrl || result.imageUrl,
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

  const generateMissingInfographics = async (types: InfographicType[]) => {
    setIsGenerating(true);
    setProgress({ current: 0, total: types.length });
    
    let successCount = 0;
    for (let i = 0; i < types.length; i++) {
      setProgress({ current: i + 1, total: types.length });
      const success = await generateSingleInfographic(types[i]);
      if (success) successCount++;
      if (i < types.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setIsGenerating(false);
    if (successCount === types.length) {
      toast.success("Infographics generated and cached");
    } else if (successCount > 0) {
      toast.warning(`Generated ${successCount}/${types.length} infographics`);
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
