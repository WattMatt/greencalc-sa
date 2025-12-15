import { useEffect, useRef } from "react";
import { useTour, Tour } from "./TourContext";

interface UseAutoTourOptions {
  tour: Tour;
  delay?: number; // Delay in ms before starting tour
}

/**
 * Hook that automatically starts a tour if the user hasn't completed it before.
 * Should be used on pages that have an associated tour.
 */
export function useAutoTour({ tour, delay = 500 }: UseAutoTourOptions) {
  const { startTour, completedTours, isActive } = useTour();
  const hasTriggered = useRef(false);

  useEffect(() => {
    // Only trigger once per mount, and only if tour not completed and no active tour
    if (hasTriggered.current) return;
    if (completedTours.includes(tour.id)) return;
    if (isActive) return;

    hasTriggered.current = true;

    // Small delay to ensure page elements are rendered
    const timer = setTimeout(() => {
      startTour(tour);
    }, delay);

    return () => clearTimeout(timer);
  }, [tour, completedTours, isActive, startTour, delay]);
}
