import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type InfographicType = "executive" | "system" | "savings" | "environmental" | "engineering" | "tariff";

export interface InfographicData {
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

export interface TariffData {
  name?: string;
  tariffType?: string;
  tariffFamily?: string;
  transmissionZone?: string;
  voltageLevel?: string;
  capacityKva?: number;
  fixedCharges?: {
    gccPerKva?: number;
    demandPerKva?: number;
    networkAccessCharge?: number;
    reactiveEnergyCharge?: number;
  };
  touRates?: Array<{
    season: string;
    period: string;
    energyRate: number;
    networkRate?: number;
    totalRate: number;
  }>;
}

interface GenerationProgress {
  current: number;
  total: number;
  currentType?: InfographicType;
}

interface UseInfographicGenerationReturn {
  generating: boolean;
  progress: GenerationProgress;
  generateInfographics: (data: InfographicData, projectId: string, tariffData?: TariffData) => Promise<void>;
  generateSingle: (type: InfographicType, data: InfographicData, projectId: string, tariffData?: TariffData) => Promise<boolean>;
}

// Generate a cache key based on key simulation params
export const getCacheKey = (data: InfographicData, type: InfographicType): string => {
  const keyParams = `${data.solarCapacityKwp}-${data.batteryCapacityKwh}-${data.annualSavings}-${type}`;
  return keyParams.replace(/\./g, '_');
};

const INFOGRAPHIC_TYPES: InfographicType[] = ["executive", "system", "savings", "environmental", "engineering", "tariff"];

export function useInfographicGeneration(): UseInfographicGenerationReturn {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress>({ current: 0, total: 0 });

  const uploadToStorage = useCallback(async (
    imageUrl: string, 
    type: InfographicType, 
    data: InfographicData,
    projectId: string
  ): Promise<string | null> => {
    try {
      // Fetch the image as blob
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      const cacheKey = getCacheKey(data, type);
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
  }, []);

  const generateSingle = useCallback(async (
    type: InfographicType, 
    data: InfographicData, 
    projectId: string,
    tariffData?: TariffData
  ): Promise<boolean> => {
    try {
      const body: any = { type, data };
      if (type === "tariff" && tariffData) {
        body.tariffData = tariffData;
      }

      const { data: result, error } = await supabase.functions.invoke("generate-report-infographic", {
        body,
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);

      // Cache to storage
      await uploadToStorage(result.imageUrl, type, data, projectId);
      return true;
    } catch (error) {
      console.error(`Error generating ${type} infographic:`, error);
      return false;
    }
  }, [uploadToStorage]);

  const generateInfographics = useCallback(async (
    data: InfographicData, 
    projectId: string,
    tariffData?: TariffData
  ): Promise<void> => {
    if (!projectId || !data.solarCapacityKwp) {
      console.warn("Cannot generate infographics: missing projectId or solar capacity");
      return;
    }

    setGenerating(true);
    const types = tariffData ? INFOGRAPHIC_TYPES : INFOGRAPHIC_TYPES.filter(t => t !== "tariff");
    setProgress({ current: 0, total: types.length });
    
    let successCount = 0;
    
    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      setProgress({ current: i + 1, total: types.length, currentType: type });
      
      const success = await generateSingle(type, data, projectId, tariffData);
      if (success) successCount++;
      
      // Small delay between API calls to avoid rate limiting
      if (i < types.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setGenerating(false);
    setProgress({ current: 0, total: 0 });
    
    if (successCount === types.length) {
      toast.success("Report infographics generated and cached");
    } else if (successCount > 0) {
      toast.warning(`Generated ${successCount}/${types.length} infographics`);
    } else {
      toast.error("Failed to generate infographics");
    }
  }, [generateSingle]);

  return {
    generating,
    progress,
    generateInfographics,
    generateSingle,
  };
}
