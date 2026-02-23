import { useState } from "react";
import { ChevronLeft, ChevronRight, Sun, Zap, Battery, TrendingUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface CarouselPane {
  id: string;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  /** If true, clicking disabled pane won't offer enable — just shows info */
  cannotToggle?: boolean;
  disabledMessage?: string;
  content: React.ReactNode;
}

interface ConfigCarouselProps {
  panes: CarouselPane[];
  onRequestEnable?: (feature: string) => void;
}

export function ConfigCarousel({ panes, onRequestEnable }: ConfigCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(() => {
    const first = panes.findIndex((p) => p.enabled);
    return first >= 0 ? first : 0;
  });
  const [enableDialogPane, setEnableDialogPane] = useState<CarouselPane | null>(null);

  const handleTabClick = (index: number) => {
    const pane = panes[index];
    if (!pane.enabled) {
      if (!pane.cannotToggle) {
        setEnableDialogPane(pane);
      }
      // Still navigate to show the disabled state
      setActiveIndex(index);
      return;
    }
    setActiveIndex(index);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + panes.length) % panes.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % panes.length);
  };

  const handleEnable = () => {
    if (enableDialogPane) {
      onRequestEnable?.(enableDialogPane.id);
      setEnableDialogPane(null);
    }
  };

  const activePaneData = panes[activeIndex];

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={handlePrev}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="flex flex-1 gap-1 overflow-x-auto">
          {panes.map((pane, i) => (
            <button
              key={pane.id}
              onClick={() => handleTabClick(i)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap min-h-[44px] flex-1",
                i === activeIndex && pane.enabled &&
                  "bg-primary text-primary-foreground shadow-sm",
                i === activeIndex && !pane.enabled &&
                  "bg-muted text-muted-foreground ring-1 ring-border",
                i !== activeIndex && pane.enabled &&
                  "hover:bg-accent text-foreground",
                i !== activeIndex && !pane.enabled &&
                  "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              <span className={cn(!pane.enabled && "opacity-40")}>
                {pane.icon}
              </span>
              <span className={cn(!pane.enabled && "opacity-40 line-through")}>
                {pane.label}
              </span>
              {!pane.enabled && <Lock className="h-3 w-3 ml-auto opacity-50" />}
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={handleNext}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Active Pane Content */}
      <div className="relative min-h-[200px]">
        {activePaneData.enabled ? (
          <div className="animate-in fade-in-0 slide-in-from-right-2 duration-200">
            {activePaneData.content}
          </div>
        ) : (
          <div className="relative">
            <div className="opacity-30 pointer-events-none select-none">
              {activePaneData.content}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 rounded-lg">
              <Lock className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground font-medium">
                {activePaneData.disabledMessage || `${activePaneData.label} is not enabled`}
              </p>
              {!activePaneData.cannotToggle && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setEnableDialogPane(activePaneData)}
                >
                  Enable {activePaneData.label}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Enable Feature Dialog */}
      <AlertDialog open={!!enableDialogPane} onOpenChange={(open) => !open && setEnableDialogPane(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable {enableDialogPane?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will enable the {enableDialogPane?.label?.toLowerCase()} feature for this project.
              You can disable it again from the project settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnable}>Enable</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
