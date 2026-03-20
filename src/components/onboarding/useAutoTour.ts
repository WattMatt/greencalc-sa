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
  // Auto-tours disabled — users can manually trigger tours via TourButton if needed
}
