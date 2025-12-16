import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FAQ {
  question: string;
  answer: string;
}

interface Tip {
  title: string;
  description: string;
  icon?: string;
}

interface GlossaryEntry {
  term: string;
  definition: string;
  relatedTerms?: string[];
}

interface EnhancedContent {
  type: string;
  content: string | FAQ[] | Tip[] | GlossaryEntry[];
  generatedAt: string;
}

interface ContentContext {
  tourId?: string;
  stepIndex?: number;
  featureArea: string;
  currentContent?: string;
  userQuestion?: string;
}

type ContentType = "explanation" | "faq" | "tips" | "glossary" | "contextual-help";

interface UseContentEnhancerReturn {
  isLoading: boolean;
  error: string | null;
  generateExplanation: (context: ContentContext) => Promise<string | null>;
  generateFAQs: (context: ContentContext) => Promise<FAQ[] | null>;
  generateTips: (context: ContentContext) => Promise<Tip[] | null>;
  generateGlossary: (context: ContentContext) => Promise<GlossaryEntry[] | null>;
  askContextualHelp: (context: ContentContext) => Promise<string | null>;
  clearCache: (featureArea?: string) => Promise<void>;
}

// Generate storage path for content
function getStoragePath(type: ContentType, featureArea: string): string {
  // Sanitize feature area for path (take first part, lowercase, replace spaces with dashes)
  const sanitizedArea = featureArea
    .split(" - ")[0]
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return `help-content/${sanitizedArea}/${type}.json`;
}

export function useContentEnhancer(): UseContentEnhancerReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if content exists in Supabase storage
  const loadFromStorage = useCallback(async (
    type: ContentType,
    featureArea: string
  ): Promise<EnhancedContent | null> => {
    try {
      const path = getStoragePath(type, featureArea);
      
      // Try to get signed URL to check if file exists
      const { data: signedData } = await supabase.storage
        .from("tour-assets")
        .createSignedUrl(path, 3600);

      if (signedData?.signedUrl) {
        // Fetch the content
        const response = await fetch(signedData.signedUrl);
        if (response.ok) {
          const content = await response.json();
          return content as EnhancedContent;
        }
      }
      return null;
    } catch (err) {
      console.log("No cached content found, will generate new");
      return null;
    }
  }, []);

  // Save content to Supabase storage
  const saveToStorage = useCallback(async (
    type: ContentType,
    featureArea: string,
    content: EnhancedContent
  ): Promise<void> => {
    try {
      const path = getStoragePath(type, featureArea);
      const jsonBlob = new Blob([JSON.stringify(content, null, 2)], {
        type: "application/json",
      });

      await supabase.storage
        .from("tour-assets")
        .upload(path, jsonBlob, {
          upsert: true,
          contentType: "application/json",
        });
      
      console.log(`Cached help content: ${path}`);
    } catch (err) {
      console.error("Failed to cache content:", err);
    }
  }, []);

  const generateContent = useCallback(async (
    type: ContentType,
    context: ContentContext
  ): Promise<EnhancedContent | null> => {
    // Skip cache for contextual-help (dynamic Q&A)
    if (type !== "contextual-help") {
      // Check Supabase storage cache first
      const cached = await loadFromStorage(type, context.featureArea);
      if (cached) {
        console.log(`Loaded cached ${type} for ${context.featureArea}`);
        return cached;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("enhance-tour-content", {
        body: { type, context },
      });

      if (fnError) {
        console.error("Edge function error:", fnError);
        setError(fnError.message);
        return null;
      }

      if (data.error) {
        setError(data.error);
        return null;
      }

      const enhancedContent = data as EnhancedContent;

      // Save to Supabase storage (except contextual-help)
      if (type !== "contextual-help") {
        await saveToStorage(type, context.featureArea, enhancedContent);
      }

      return enhancedContent;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error("Error generating content:", errorMsg);
      setError(errorMsg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [loadFromStorage, saveToStorage]);

  const generateExplanation = useCallback(async (context: ContentContext): Promise<string | null> => {
    const result = await generateContent("explanation", context);
    return result?.content as string | null;
  }, [generateContent]);

  const generateFAQs = useCallback(async (context: ContentContext): Promise<FAQ[] | null> => {
    const result = await generateContent("faq", context);
    return result?.content as FAQ[] | null;
  }, [generateContent]);

  const generateTips = useCallback(async (context: ContentContext): Promise<Tip[] | null> => {
    const result = await generateContent("tips", context);
    return result?.content as Tip[] | null;
  }, [generateContent]);

  const generateGlossary = useCallback(async (context: ContentContext): Promise<GlossaryEntry[] | null> => {
    const result = await generateContent("glossary", context);
    return result?.content as GlossaryEntry[] | null;
  }, [generateContent]);

  const askContextualHelp = useCallback(async (context: ContentContext): Promise<string | null> => {
    const result = await generateContent("contextual-help", context);
    return result?.content as string | null;
  }, [generateContent]);

  // Clear cached content for a feature area (or all)
  const clearCache = useCallback(async (featureArea?: string): Promise<void> => {
    try {
      if (featureArea) {
        const sanitizedArea = featureArea
          .split(" - ")[0]
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
        
        const { data: files } = await supabase.storage
          .from("tour-assets")
          .list(`help-content/${sanitizedArea}`);
        
        if (files && files.length > 0) {
          const paths = files.map(f => `help-content/${sanitizedArea}/${f.name}`);
          await supabase.storage.from("tour-assets").remove(paths);
        }
      } else {
        // Clear all help content
        const { data: folders } = await supabase.storage
          .from("tour-assets")
          .list("help-content");
        
        if (folders) {
          for (const folder of folders) {
            const { data: files } = await supabase.storage
              .from("tour-assets")
              .list(`help-content/${folder.name}`);
            
            if (files && files.length > 0) {
              const paths = files.map(f => `help-content/${folder.name}/${f.name}`);
              await supabase.storage.from("tour-assets").remove(paths);
            }
          }
        }
      }
      console.log("Cache cleared");
    } catch (err) {
      console.error("Failed to clear cache:", err);
    }
  }, []);

  return {
    isLoading,
    error,
    generateExplanation,
    generateFAQs,
    generateTips,
    generateGlossary,
    askContextualHelp,
    clearCache,
  };
}

// Feature area mappings for common contexts
export const FEATURE_AREAS = {
  QUICK_ESTIMATE: "Quick Estimate - Instant solar feasibility calculator with location-based irradiance data",
  SIMULATION_HUB: "Simulation Hub - Central navigation for all four simulation modes",
  PROFILE_BUILDER: "Profile Builder - Detailed load profile modeling with SCADA meter data",
  SANDBOX: "Sandbox Mode - Experimental scenario testing with parameter sweeps",
  PROPOSAL_BUILDER: "Proposal Builder - Professional client-ready proposal generation",
  TARIFF_MANAGEMENT: "Tariff Management - Municipal electricity tariff database management",
  LOAD_PROFILES: "Load Profiles - SCADA meter imports and shop-type templates",
  PV_LAYOUT: "PV Layout - Floor plan markup tool for solar array planning",
  BATTERY_STORAGE: "Battery Storage - Energy storage simulation with peak shaving",
  SOLCAST: "Solcast Integration - Real-time solar irradiance forecasting",
  TOU_PERIODS: "Time-of-Use Periods - Peak, Standard, and Off-Peak rate visualization",
};
