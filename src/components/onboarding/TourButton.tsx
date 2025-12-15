import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour } from "./TourContext";
import { Tour } from "./TourContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TourButtonProps {
  tour: Tour;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}

export function TourButton({ tour, variant = "outline", size = "sm", showLabel = true }: TourButtonProps) {
  const { startTour, completedTours } = useTour();
  const isCompleted = completedTours.includes(tour.id);

  const button = (
    <Button
      variant={variant}
      size={size}
      onClick={() => startTour(tour)}
      className="gap-2"
    >
      <Lightbulb className="h-4 w-4" />
      {showLabel && (
        <span className="hidden sm:inline">
          {isCompleted ? "Replay Tour" : "Take Tour"}
        </span>
      )}
    </Button>
  );

  if (!showLabel) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{isCompleted ? "Replay guided tour" : "Start guided tour"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
