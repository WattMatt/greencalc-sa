import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, ImagePlus, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { useInfographicGenerator } from "./useInfographicGenerator";
import { TOURS } from "./tours";

interface GenerationStatus {
  tourId: string;
  stepIndex: number;
  status: "pending" | "generating" | "success" | "error";
  imageUrl?: string;
  error?: string;
}

export function InfographicManager() {
  const {
    isGenerating,
    progress,
    totalSteps,
    currentStep,
    generateForTour,
    generateForStep,
    generateAll,
  } = useInfographicGenerator();

  const [generationStatus, setGenerationStatus] = useState<GenerationStatus[]>([]);
  const [selectedTour, setSelectedTour] = useState<string | null>(null);

  const handleGenerateForTour = async (tourId: string) => {
    setSelectedTour(tourId);
    const tour = TOURS[tourId];
    
    // Initialize status for all steps
    const initialStatus: GenerationStatus[] = tour.steps.map((_, index) => ({
      tourId,
      stepIndex: index,
      status: "pending",
    }));
    setGenerationStatus(initialStatus);

    // Generate each step
    for (let i = 0; i < tour.steps.length; i++) {
      setGenerationStatus(prev => 
        prev.map((s, idx) => 
          idx === i ? { ...s, status: "generating" } : s
        )
      );

      const result = await generateForStep(tourId, i);

      setGenerationStatus(prev =>
        prev.map((s, idx) =>
          idx === i
            ? {
                ...s,
                status: result.success ? "success" : "error",
                imageUrl: result.imageUrl,
                error: result.error,
              }
            : s
        )
      );

      // Delay between requests
      if (i < tour.steps.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setSelectedTour(null);
  };

  const tourEntries = Object.entries(TOURS);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Infographic Generator
          </CardTitle>
          <CardDescription>
            Generate visual infographics for tour steps using AI (Gemini Flash Image)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{currentStep}</span>
                <span className="font-medium">{progress}/{totalSteps}</span>
              </div>
              <Progress value={(progress / totalSteps) * 100} className="h-2" />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={generateAll}
              disabled={isGenerating}
              variant="default"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ImagePlus className="h-4 w-4 mr-2" />
                  Generate All Tours
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tourEntries.map(([tourId, tour]) => (
          <Card key={tourId} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{tour.name}</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {tour.steps.length} steps
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {tourId}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Step list */}
              <div className="space-y-1.5">
                {tour.steps.map((step, index) => {
                  const status = generationStatus.find(
                    s => s.tourId === tourId && s.stepIndex === index
                  );

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/50"
                    >
                      <span className="truncate flex-1 mr-2">{step.title}</span>
                      {status?.status === "generating" && (
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      )}
                      {status?.status === "success" && (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      )}
                      {status?.status === "error" && (
                        <XCircle className="h-3 w-3 text-destructive" />
                      )}
                    </div>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleGenerateForTour(tourId)}
                disabled={isGenerating || selectedTour === tourId}
              >
                {selectedTour === tourId ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-3 w-3 mr-2" />
                    Generate for {tour.name.replace(" Tour", "")}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Generated images preview */}
      {generationStatus.some(s => s.status === "success") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generated Infographics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {generationStatus
                .filter(s => s.status === "success" && s.imageUrl)
                .map((status, idx) => (
                  <div key={idx} className="space-y-2">
                    <img
                      src={status.imageUrl}
                      alt={`${status.tourId} step ${status.stepIndex}`}
                      className="w-full rounded-lg border"
                    />
                    <p className="text-xs text-muted-foreground text-center">
                      {TOURS[status.tourId]?.steps[status.stepIndex]?.title}
                    </p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
