import { useState } from "react";
import { useTour } from "./TourContext";
import { TOURS } from "./tours";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Play, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface DemoLauncherProps {
  className?: string;
  variant?: "default" | "compact";
}

export function DemoLauncher({ className, variant = "default" }: DemoLauncherProps) {
  const { startTour, setDemoMode, isActive } = useTour();
  const [isOpen, setIsOpen] = useState(false);

  const handleLaunchDemo = (tourId: string) => {
    const tour = TOURS[tourId];
    if (tour) {
      startTour(tour);
      // Small delay to ensure tour is started before enabling demo mode
      setTimeout(() => {
        setDemoMode(true);
      }, 100);
    }
    setIsOpen(false);
  };

  const tourOptions = Object.values(TOURS);

  if (variant === "compact") {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 gap-1", className)}
            disabled={isActive}
          >
            <Play className="h-3.5 w-3.5" />
            Demo
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Auto-Play Demos
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {tourOptions.map((tour) => (
            <DropdownMenuItem
              key={tour.id}
              onClick={() => handleLaunchDemo(tour.id)}
              className="cursor-pointer"
            >
              <div className="flex flex-col">
                <span className="font-medium">{tour.name}</span>
                <span className="text-xs text-muted-foreground">
                  {tour.steps.length} steps
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn("gap-2", className)}
          disabled={isActive}
        >
          <Play className="h-4 w-4" />
          Watch Demo
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Choose a Feature Demo
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tourOptions.map((tour) => (
          <DropdownMenuItem
            key={tour.id}
            onClick={() => handleLaunchDemo(tour.id)}
            className="cursor-pointer py-2"
          >
            <div className="flex flex-col">
              <span className="font-medium">{tour.name}</span>
              <span className="text-xs text-muted-foreground">
                Auto-play walkthrough • {tour.steps.length} steps
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
