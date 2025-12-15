import { useState } from "react";
import { useTour, Tour } from "./TourContext";
import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TourBeaconProps {
  tour: Tour;
  stepIndex?: number;
  size?: "sm" | "md" | "lg";
  variant?: "pulse" | "glow" | "bounce" | "static";
  className?: string;
  tooltipText?: string;
}

export function TourBeacon({
  tour,
  stepIndex = 0,
  size = "md",
  variant = "pulse",
  className,
  tooltipText = "Click for a guided tour",
}: TourBeaconProps) {
  const { startTour, goToStep, isActive } = useTour();
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    if (isActive) return;
    startTour(tour);
    if (stepIndex > 0) {
      setTimeout(() => goToStep(stepIndex), 50);
    }
  };

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const containerSizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const getAnimationClass = () => {
    if (isHovered || variant === "static") return "";
    switch (variant) {
      case "pulse":
        return "animate-[beacon-pulse_2s_ease-in-out_infinite]";
      case "glow":
        return "animate-[beacon-glow_2s_ease-in-out_infinite]";
      case "bounce":
        return "animate-[beacon-bounce_1s_ease-in-out_infinite]";
      default:
        return "";
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
              "relative flex items-center justify-center rounded-full bg-primary/10 text-primary transition-all duration-200 hover:bg-primary/20 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              containerSizeClasses[size],
              getAnimationClass(),
              isActive && "opacity-50 cursor-not-allowed",
              className
            )}
            disabled={isActive}
            aria-label={tooltipText}
          >
            <HelpCircle className={cn(sizeClasses[size])} />
            
            {/* Outer ring animation */}
            {variant !== "static" && !isHovered && (
              <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltipText}
        </TooltipContent>
      </Tooltip>

      {/* CSS for beacon animations */}
      <style>{`
        @keyframes beacon-pulse {
          0%, 100% { 
            transform: scale(1);
            opacity: 1;
          }
          50% { 
            transform: scale(1.1);
            opacity: 0.8;
          }
        }
        
        @keyframes beacon-glow {
          0%, 100% { 
            box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4);
          }
          50% { 
            box-shadow: 0 0 0 8px hsl(var(--primary) / 0);
          }
        }
        
        @keyframes beacon-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </TooltipProvider>
  );
}
