import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TOURS } from "./tours";

// Map tour URIs to infographic prompts for AI generation
const INFOGRAPHIC_PROMPTS: Record<string, string> = {
  // Quick Estimate
  "quick-estimate/location": "Simple flat icon illustration of South Africa map with sun icons showing solar irradiance zones, green energy theme, minimal clean design, white background",
  "quick-estimate/area": "Simple flat icon of a building floor plan with square meter measurement markers, green energy theme, minimal design, white background",
  "quick-estimate/solar": "Simple flat icon of solar panels with capacity meter/slider, showing kW measurement, green energy theme, minimal design, white background",
  "quick-estimate/battery": "Simple flat icon of battery storage system with charge level indicator, green energy theme, minimal design, white background",
  "quick-estimate/calculate": "Simple flat icon of calculator with ROI chart showing savings graph, green energy theme, minimal design, white background",
  
  // Simulation Hub
  "simulation-hub/quick-estimate": "Simple flat icon showing lightning bolt with ±20% badge, quick calculation concept, green energy theme, minimal design, white background",
  "simulation-hub/profile-builder": "Simple flat icon showing stacked load profile charts with meter data, accuracy indicator, green energy theme, minimal design, white background",
  "simulation-hub/sandbox": "Simple flat icon showing A/B/C comparison cards with experiment beaker, sandbox concept, green energy theme, minimal design, white background",
  "simulation-hub/proposal": "Simple flat icon showing professional document with checkmark and signature line, green energy theme, minimal design, white background",
  
  // Profile Builder
  "profile-builder/pv-config": "Simple flat icon of solar panel array with configuration sliders, DC/AC ratio indicator, green energy theme, minimal design, white background",
  "profile-builder/battery": "Simple flat icon of battery with charge/discharge arrows and power rating, green energy theme, minimal design, white background",
  "profile-builder/load-chart": "Simple flat icon of 24-hour bar chart with colored TOU periods (red peak, yellow standard, green off-peak), minimal design, white background",
  "profile-builder/save": "Simple flat icon of floppy disk with checkmark, save simulation concept, green energy theme, minimal design, white background",
  
  // Sandbox
  "sandbox/scenarios": "Simple flat icon showing three cards labeled A B C side by side for comparison, green energy theme, minimal design, white background",
  "sandbox/parameter-sweep": "Simple flat icon of slider controls with range indicators and optimization graph, green energy theme, minimal design, white background",
  "sandbox/draft": "Simple flat icon of document with DRAFT watermark badge, green energy theme, minimal design, white background",
  "sandbox/promote": "Simple flat icon of arrow pointing up from draft to production with star badge, green energy theme, minimal design, white background",
  
  // Proposal Builder
  "proposal-builder/simulation": "Simple flat icon of dropdown selector with simulation chart thumbnails, green energy theme, minimal design, white background",
  "proposal-builder/checklist": "Simple flat icon of checklist with progress bar and checkmarks, verification concept, green energy theme, minimal design, white background",
  "proposal-builder/branding": "Simple flat icon of company logo placeholder with color palette swatches, branding concept, green energy theme, minimal design, white background",
  "proposal-builder/export": "Simple flat icon showing PDF and Excel file icons with download arrow, export concept, green energy theme, minimal design, white background",
  "proposal-builder/signature": "Simple flat icon of signature line with pen and approval checkmark, digital signature concept, green energy theme, minimal design, white background",
};

// Extract path from tour:// URI in tour step
function getPathFromTourStep(tourId: string, stepIndex: number): string | null {
  const tour = TOURS[tourId];
  if (!tour) return null;
  
  const step = tour.steps[stepIndex];
  if (!step?.image?.startsWith("tour://")) return null;
  
  return step.image.replace("tour://", "");
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
  generateForStep: (tourId: string, stepIndex: number) => Promise<GenerationResult>;
  generateAll: () => Promise<void>;
}

export function useInfographicGenerator(): UseInfographicGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentStep, setCurrentStep] = useState("");

  const generateForStep = useCallback(async (
    tourId: string,
    stepIndex: number
  ): Promise<GenerationResult> => {
    const path = getPathFromTourStep(tourId, stepIndex);
    if (!path) {
      return { success: false, error: `No tour:// URI for ${tourId} step ${stepIndex}` };
    }

    const prompt = INFOGRAPHIC_PROMPTS[path];
    if (!prompt) {
      return { success: false, error: `No prompt defined for path: ${path}` };
    }

    try {
      const { data, error } = await supabase.functions.invoke("generate-tour-infographic", {
        body: { path, prompt },
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
        await new Promise(resolve => setTimeout(resolve, 2000));
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

        // Delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2500));
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
