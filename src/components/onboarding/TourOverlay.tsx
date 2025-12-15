import { useEffect, useState, useCallback } from "react";
import { useTour } from "./TourContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Position {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function TourOverlay() {
  const { activeTour, currentStepIndex, isActive, nextStep, prevStep, endTour } = useTour();
  const [targetPosition, setTargetPosition] = useState<Position | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const currentStep = activeTour?.steps[currentStepIndex];

  const calculatePositions = useCallback(() => {
    if (!currentStep) return;

    const element = document.querySelector(currentStep.target);
    if (!element) {
      // Element not found, center the tooltip
      setTargetPosition(null);
      setTooltipPosition({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - 175,
      });
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = 8;

    setTargetPosition({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Calculate tooltip position based on placement
    const tooltipWidth = 350;
    const tooltipHeight = 180;
    const gap = 12;
    const placement = currentStep.placement || "bottom";

    let top = 0;
    let left = 0;

    switch (placement) {
      case "top":
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
    }

    // Keep tooltip within viewport
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    setTooltipPosition({ top, left });

    // Scroll element into view if needed
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentStep]);

  useEffect(() => {
    if (!isActive) return;

    calculatePositions();
    
    const handleResize = () => calculatePositions();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [isActive, calculatePositions]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") endTour();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [endTour]);

  if (!isActive || !activeTour || !currentStep) return null;

  const isLastStep = currentStepIndex === activeTour.steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Dark overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetPosition && (
              <rect
                x={targetPosition.left}
                y={targetPosition.top}
                width={targetPosition.width}
                height={targetPosition.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="hsl(var(--background) / 0.85)"
          mask="url(#spotlight-mask)"
          onClick={endTour}
        />
      </svg>

      {/* Highlight border around target */}
      {targetPosition && (
        <div
          className="absolute rounded-lg border-2 border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.2)] pointer-events-none transition-all duration-300"
          style={{
            top: targetPosition.top,
            left: targetPosition.left,
            width: targetPosition.width,
            height: targetPosition.height,
          }}
        />
      )}

      {/* Tooltip Card */}
      <Card
        className="absolute w-[350px] shadow-xl pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-200"
        style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base">{currentStep.title}</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-2" onClick={endTour}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="text-sm text-muted-foreground">{currentStep.content}</p>
        </CardContent>
        <CardFooter className="flex items-center justify-between pt-0">
          {/* Step indicators */}
          <div className="flex items-center gap-1">
            {activeTour.steps.map((_, index) => (
              <Circle
                key={index}
                className={cn(
                  "h-2 w-2",
                  index === currentStepIndex
                    ? "fill-primary text-primary"
                    : "fill-muted text-muted"
                )}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <Button variant="ghost" size="sm" onClick={prevStep}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button size="sm" onClick={nextStep}>
              {isLastStep ? "Finish" : "Next"}
              {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
