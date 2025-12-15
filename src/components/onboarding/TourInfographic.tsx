import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { ImageIcon, Sparkles } from "lucide-react";

interface TourInfographicProps {
  tourUri: string; // e.g., "tour://quick-estimate/location"
  alt?: string;
  className?: string;
}

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

export function TourInfographic({ tourUri, alt, className }: TourInfographicProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!tourUri?.startsWith("tour://")) {
      setLoading(false);
      return;
    }

    const path = tourUri.replace("tour://", "");
    loadOrGenerateInfographic(path);
  }, [tourUri]);

  const loadOrGenerateInfographic = async (path: string) => {
    setLoading(true);
    setError(false);

    try {
      // First, try to load from storage cache
      const storagePath = `infographics/${path}.png`;
      const { data: existingFile } = await supabase.storage
        .from("tour-assets")
        .createSignedUrl(storagePath, 3600);

      if (existingFile?.signedUrl) {
        // Verify the image actually exists by fetching it
        const testResponse = await fetch(existingFile.signedUrl, { method: 'HEAD' });
        if (testResponse.ok) {
          setImageUrl(existingFile.signedUrl);
          setLoading(false);
          return;
        }
      }

      // If not cached, generate via AI
      const prompt = INFOGRAPHIC_PROMPTS[path];
      if (!prompt) {
        console.warn(`No infographic prompt for path: ${path}`);
        setLoading(false);
        setError(true);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke("generate-tour-infographic", {
        body: { path, prompt },
      });

      if (fnError) throw fnError;

      if (data?.imageUrl) {
        setImageUrl(data.imageUrl);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Failed to load/generate infographic:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`relative ${className}`}>
        <Skeleton className="w-full h-32 rounded-lg" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={`flex items-center justify-center h-24 rounded-lg bg-muted/50 ${className}`}>
        <div className="text-center text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-50" />
          <p className="text-xs">Infographic</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt || "Tour infographic"}
      className={`w-full h-auto rounded-lg object-contain max-h-32 ${className}`}
      onError={() => setError(true)}
    />
  );
}
