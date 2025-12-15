import { useEffect, useState, useCallback } from "react";
import { useTour } from "./TourContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight, Circle, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Position {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function TourOverlay() {
  const { 
    activeTour, 
    currentStepIndex, 
    isActive, 
    nextStep, 
    prevStep, 
    endTour,
    isDemoMode,
    setDemoMode,
    demoSpeed,
    setDemoSpeed,
  } = useTour();
  const [targetPosition, setTargetPosition] = useState<Position | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  const currentStep = activeTour?.steps[currentStepIndex];
  const hasMedia = currentStep?.image || currentStep?.gif || currentStep?.videoUrl;
  const tooltipWidth = hasMedia ? 450 : 350;

  const calculatePositions = useCallback(() => {
    if (!currentStep) return;

    const element = document.querySelector(currentStep.target);
    if (!element) {
      // Element not found, center the tooltip
      setTargetPosition(null);
      setTooltipPosition({
        top: window.innerHeight / 2 - 100,
        left: window.innerWidth / 2 - tooltipWidth / 2,
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
    const tooltipHeight = hasMedia ? 320 : 180;
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
  }, [currentStep, tooltipWidth, hasMedia]);

  useEffect(() => {
    if (!isActive) return;

    // Reset image loaded state when step changes
    setImageLoaded(false);
    calculatePositions();
    
    const handleResize = () => calculatePositions();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [isActive, calculatePositions, currentStepIndex]);

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
  const highlightAnimation = currentStep.highlightAnimation || "none";

  // Get animation class for highlight
  const getHighlightAnimationClass = () => {
    switch (highlightAnimation) {
      case "pulse":
        return "animate-[tour-pulse_2s_ease-in-out_infinite]";
      case "glow":
        return "animate-[tour-glow_2s_ease-in-out_infinite]";
      case "bounce":
        return "animate-[tour-bounce_1s_ease-in-out_infinite]";
      default:
        return "";
    }
  };

  const renderMedia = () => {
    if (!hasMedia) return null;

    const mediaPosition = currentStep.mediaPosition || "top";
    const mediaContainerClass = cn(
      "rounded-md overflow-hidden bg-muted",
      mediaPosition === "top" ? "mb-3" : "my-2"
    );

    if (currentStep.videoUrl) {
      // Handle YouTube or direct video
      const isYouTube = currentStep.videoUrl.includes("youtube.com") || currentStep.videoUrl.includes("youtu.be");
      
      if (isYouTube) {
        const videoId = currentStep.videoUrl.includes("youtu.be") 
          ? currentStep.videoUrl.split("/").pop() 
          : new URLSearchParams(new URL(currentStep.videoUrl).search).get("v");
        
        return (
          <div className={mediaContainerClass}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
              className="w-full aspect-video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={currentStep.mediaAlt || currentStep.title}
            />
          </div>
        );
      }

      return (
        <div className={mediaContainerClass}>
          <video 
            src={currentStep.videoUrl} 
            className="w-full aspect-video"
            controls
            autoPlay={isDemoMode}
            muted
          >
            Your browser does not support video playback.
          </video>
        </div>
      );
    }

    const imageSrc = currentStep.gif || currentStep.image;
    if (imageSrc) {
      return (
        <div className={cn(mediaContainerClass, "relative min-h-[120px]")}>
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          <img
            src={imageSrc}
            alt={currentStep.mediaAlt || currentStep.title}
            className={cn(
              "w-full h-auto max-h-[180px] object-contain transition-opacity duration-200",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setImageLoaded(true)}
          />
        </div>
      );
    }

    return null;
  };

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
          className={cn(
            "absolute rounded-lg border-2 border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.2)] pointer-events-none transition-all duration-300",
            getHighlightAnimationClass()
          )}
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
        className={cn(
          "absolute shadow-xl pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-200",
          isDemoMode && "border-primary/50"
        )}
        style={{ 
          top: tooltipPosition.top, 
          left: tooltipPosition.left,
          width: tooltipWidth,
        }}
        onMouseEnter={() => isDemoMode && setDemoMode(false)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{currentStep.title}</CardTitle>
              {isDemoMode && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  Demo
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-2" onClick={endTour}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          {renderMedia()}
          <p className="text-sm text-muted-foreground">{currentStep.content}</p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 pt-0">
          {/* Step indicators and navigation */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1">
              {activeTour.steps.map((_, index) => (
                <Circle
                  key={index}
                  className={cn(
                    "h-2 w-2 cursor-pointer transition-colors",
                    index === currentStepIndex
                      ? "fill-primary text-primary"
                      : "fill-muted text-muted hover:fill-muted-foreground"
                  )}
                  onClick={() => {
                    if (isDemoMode) setDemoMode(false);
                    useTour().goToStep?.(index);
                  }}
                />
              ))}
            </div>

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
          </div>

          {/* Demo mode controls */}
          <div className="flex items-center justify-between w-full border-t pt-2 mt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setDemoMode(!isDemoMode)}
            >
              {isDemoMode ? (
                <>
                  <Pause className="h-3 w-3 mr-1" />
                  Pause Demo
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 mr-1" />
                  Auto Demo
                </>
              )}
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Speed:</span>
              <Select
                value={demoSpeed.toString()}
                onValueChange={(val) => setDemoSpeed(parseFloat(val))}
              >
                <SelectTrigger className="h-7 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5x</SelectItem>
                  <SelectItem value="1">1x</SelectItem>
                  <SelectItem value="1.5">1.5x</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* CSS for custom animations */}
      <style>{`
        @keyframes tour-pulse {
          0%, 100% { 
            transform: scale(1); 
            box-shadow: 0 0 0 4px hsl(var(--primary) / 0.2);
          }
          50% { 
            transform: scale(1.02); 
            box-shadow: 0 0 0 8px hsl(var(--primary) / 0.3);
          }
        }
        
        @keyframes tour-glow {
          0%, 100% { 
            box-shadow: 0 0 0 4px hsl(var(--primary) / 0.2), 0 0 20px hsl(var(--primary) / 0.1);
          }
          50% { 
            box-shadow: 0 0 0 6px hsl(var(--primary) / 0.3), 0 0 40px hsl(var(--primary) / 0.2);
          }
        }
        
        @keyframes tour-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
