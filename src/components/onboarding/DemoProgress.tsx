import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface DemoProgressProps {
  duration: number; // Total duration in ms
  isPaused: boolean;
  onComplete?: () => void;
  className?: string;
}

export function DemoProgress({ duration, isPaused, onComplete, className }: DemoProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isPaused) return;

    setProgress(0);
    const startTime = performance.now();
    let animationId: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const currentProgress = Math.min((elapsed / duration) * 100, 100);
      
      setProgress(currentProgress);

      if (currentProgress < 100) {
        animationId = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [duration, isPaused, onComplete]);

  // Reset progress when duration changes (step change)
  useEffect(() => {
    setProgress(0);
  }, [duration]);

  return (
    <div className={cn("h-1 w-full bg-muted rounded-full overflow-hidden", className)}>
      <div
        className={cn(
          "h-full bg-primary transition-[width] duration-100 ease-linear",
          isPaused && "animate-pulse"
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
