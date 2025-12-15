import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TOURS } from "./tours";

interface TourStepContext {
  tourId: string;
  stepIndex: number;
  title: string;
  content: string;
  featureArea: string;
  infographicType?: "process-flow" | "feature-overview" | "data-flow" | "comparison";
}

interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

interface UseInfographicGeneratorReturn {
  isGenerating: boolean;
  progress: number;
  totalSteps: number;
  currentStep: string;
  generateForTour: (tourId: string) => Promise<GenerationResult[]>;
  generateForStep: (tourId: string, stepIndex: number, infographicType?: TourStepContext["infographicType"]) => Promise<GenerationResult>;
  generateAll: () => Promise<void>;
}

// Map tour IDs to feature areas
const TOUR_FEATURE_AREAS: Record<string, string> = {
  "quick-estimate": "Quick Estimate - Instant solar feasibility calculator",
  "simulation-hub": "Simulation Hub - Central navigation for all simulation modes",
  "profile-builder": "Profile Builder - Detailed load profile modeling",
  "sandbox": "Sandbox Mode - Experimental scenario testing",
  "proposal-builder": "Proposal Builder - Client-ready proposal generation",
};

// Map step indices to infographic types based on content
function getInfographicType(tourId: string, stepIndex: number): TourStepContext["infographicType"] {
  // Default mapping based on common patterns
  const tour = TOURS[tourId];
  if (!tour) return "feature-overview";

  const step = tour.steps[stepIndex];
  if (!step) return "feature-overview";

  const title = step.title.toLowerCase();
  const content = step.content.toLowerCase();

  // Detect process-flow type steps
  if (
    title.includes("calculate") ||
    title.includes("save") ||
    title.includes("export") ||
    content.includes("workflow") ||
    content.includes("process")
  ) {
    return "process-flow";
  }

  // Detect comparison type steps
  if (
    title.includes("compare") ||
    title.includes("scenario") ||
    content.includes("side-by-side") ||
    content.includes("different")
  ) {
    return "comparison";
  }

  // Detect data-flow type steps
  if (
    title.includes("data") ||
    title.includes("import") ||
    title.includes("profile") ||
    content.includes("meter data") ||
    content.includes("load profile")
  ) {
    return "data-flow";
  }

  return "feature-overview";
}

export function useInfographicGenerator(): UseInfographicGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentStep, setCurrentStep] = useState("");

  const generateForStep = useCallback(async (
    tourId: string,
    stepIndex: number,
    infographicType?: TourStepContext["infographicType"]
  ): Promise<GenerationResult> => {
    const tour = TOURS[tourId];
    if (!tour) {
      return { success: false, error: `Tour not found: ${tourId}` };
    }

    const step = tour.steps[stepIndex];
    if (!step) {
      return { success: false, error: `Step ${stepIndex} not found in tour ${tourId}` };
    }

    const tourStep: TourStepContext = {
      tourId: tour.id,
      stepIndex,
      title: step.title,
      content: step.content,
      featureArea: TOUR_FEATURE_AREAS[tourId] || tourId,
      infographicType: infographicType || getInfographicType(tourId, stepIndex),
    };

    try {
      const { data, error } = await supabase.functions.invoke("generate-tour-infographic", {
        body: { tourStep },
      });

      if (error) {
        console.error("Edge function error:", error);
        return { success: false, error: error.message };
      }

      return data as GenerationResult;
    } catch (err) {
      const error = err as Error;
      console.error("Error calling edge function:", error);
      return { success: false, error: error.message };
    }
  }, []);

  const generateForTour = useCallback(async (tourId: string): Promise<GenerationResult[]> => {
    const tour = TOURS[tourId];
    if (!tour) {
      toast.error(`Tour not found: ${tourId}`);
      return [];
    }

    setIsGenerating(true);
    setProgress(0);
    setTotalSteps(tour.steps.length);
    
    const results: GenerationResult[] = [];

    for (let i = 0; i < tour.steps.length; i++) {
      setCurrentStep(`${tour.name} - Step ${i + 1}: ${tour.steps[i].title}`);
      
      const result = await generateForStep(tourId, i);
      results.push(result);
      
      setProgress(i + 1);

      if (result.success) {
        console.log(`Generated infographic for ${tourId} step ${i}:`, result.imageUrl);
      } else {
        console.error(`Failed to generate for ${tourId} step ${i}:`, result.error);
      }

      // Small delay between requests to avoid rate limiting
      if (i < tour.steps.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setIsGenerating(false);
    setCurrentStep("");
    
    const successCount = results.filter(r => r.success).length;
    toast.success(`Generated ${successCount}/${tour.steps.length} infographics for ${tour.name}`);

    return results;
  }, [generateForStep]);

  const generateAll = useCallback(async () => {
    setIsGenerating(true);
    
    const tourIds = Object.keys(TOURS);
    let totalGenerated = 0;
    let totalFailed = 0;
    
    // Calculate total steps across all tours
    const total = tourIds.reduce((acc, id) => acc + TOURS[id].steps.length, 0);
    setTotalSteps(total);
    setProgress(0);

    for (const tourId of tourIds) {
      const tour = TOURS[tourId];
      
      for (let i = 0; i < tour.steps.length; i++) {
        setCurrentStep(`${tour.name} - Step ${i + 1}: ${tour.steps[i].title}`);
        
        const result = await generateForStep(tourId, i);
        
        if (result.success) {
          totalGenerated++;
        } else {
          totalFailed++;
        }
        
        setProgress(prev => prev + 1);

        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setIsGenerating(false);
    setCurrentStep("");
    
    toast.success(`Generation complete: ${totalGenerated} succeeded, ${totalFailed} failed`);
  }, [generateForStep]);

  return {
    isGenerating,
    progress,
    totalSteps,
    currentStep,
    generateForTour,
    generateForStep,
    generateAll,
  };
}
