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
  cachedContent: Map<string, EnhancedContent>;
}

// Simple in-memory cache
const contentCache = new Map<string, EnhancedContent>();

export function useContentEnhancer(): UseContentEnhancerReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateContent = useCallback(async (
    type: ContentType,
    context: ContentContext
  ): Promise<EnhancedContent | null> => {
    // Check cache first
    const cacheKey = `${type}-${context.featureArea}-${context.tourId || ""}-${context.stepIndex || ""}`;
    const cached = contentCache.get(cacheKey);
    if (cached && type !== "contextual-help") {
      return cached;
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

      // Cache the result (except contextual-help which is dynamic)
      if (type !== "contextual-help") {
        contentCache.set(cacheKey, enhancedContent);
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
  }, []);

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

  return {
    isLoading,
    error,
    generateExplanation,
    generateFAQs,
    generateTips,
    generateGlossary,
    askContextualHelp,
    cachedContent: contentCache,
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
