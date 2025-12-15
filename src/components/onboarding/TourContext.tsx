import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from "react";

export interface TourStep {
  target: string; // CSS selector for the element to highlight
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
  // Rich media fields
  image?: string;              // Static image URL (screenshot, diagram)
  gif?: string;                // Animated GIF URL
  videoUrl?: string;           // YouTube/Vimeo embed or direct video URL
  mediaAlt?: string;           // Alt text for accessibility
  // Animation & timing
  highlightAnimation?: "pulse" | "glow" | "bounce" | "none";
  autoAdvanceMs?: number;      // Auto-advance to next step after X milliseconds
  // Layout hints
  mediaPosition?: "top" | "inline";  // Media above content or inline
}

export interface Tour {
  id: string;
  name: string;
  steps: TourStep[];
}

interface TourContextType {
  activeTour: Tour | null;
  currentStepIndex: number;
  isActive: boolean;
  startTour: (tour: Tour) => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  completedTours: string[];
  markTourCompleted: (tourId: string) => void;
  resetAllTours: () => void;
  // Demo mode
  isDemoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  demoSpeed: number;  // 0.5, 1, 1.5, 2 multiplier
  setDemoSpeed: (speed: number) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

const COMPLETED_TOURS_KEY = "completed_tours";
const DEFAULT_AUTO_ADVANCE_MS = 4000;

export function TourProvider({ children }: { children: ReactNode }) {
  const [activeTour, setActiveTour] = useState<Tour | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoSpeed, setDemoSpeed] = useState(1);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [completedTours, setCompletedTours] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(COMPLETED_TOURS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const markTourCompleted = useCallback((tourId: string) => {
    setCompletedTours((prev) => {
      if (prev.includes(tourId)) return prev;
      const updated = [...prev, tourId];
      localStorage.setItem(COMPLETED_TOURS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const startTour = useCallback((tour: Tour) => {
    setActiveTour(tour);
    setCurrentStepIndex(0);
  }, []);

  const endTour = useCallback(() => {
    if (activeTour) {
      markTourCompleted(activeTour.id);
    }
    setActiveTour(null);
    setCurrentStepIndex(0);
    setIsDemoMode(false);
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
    }
  }, [activeTour, markTourCompleted]);

  const nextStep = useCallback(() => {
    if (activeTour && currentStepIndex < activeTour.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      endTour();
    }
  }, [activeTour, currentStepIndex, endTour]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const goToStep = useCallback((index: number) => {
    if (activeTour && index >= 0 && index < activeTour.steps.length) {
      setCurrentStepIndex(index);
    }
  }, [activeTour]);

  const resetAllTours = useCallback(() => {
    setCompletedTours([]);
    localStorage.removeItem(COMPLETED_TOURS_KEY);
  }, []);

  // Demo mode auto-advance effect
  useEffect(() => {
    if (!isDemoMode || !activeTour) return;

    const currentStep = activeTour.steps[currentStepIndex];
    const baseDelay = currentStep?.autoAdvanceMs || DEFAULT_AUTO_ADVANCE_MS;
    const adjustedDelay = baseDelay / demoSpeed;

    autoAdvanceTimerRef.current = setTimeout(() => {
      nextStep();
    }, adjustedDelay);

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, [isDemoMode, activeTour, currentStepIndex, demoSpeed, nextStep]);

  return (
    <TourContext.Provider
      value={{
        activeTour,
        currentStepIndex,
        isActive: activeTour !== null,
        startTour,
        endTour,
        nextStep,
        prevStep,
        goToStep,
        completedTours,
        markTourCompleted,
        resetAllTours,
        isDemoMode,
        setDemoMode: setIsDemoMode,
        demoSpeed,
        setDemoSpeed,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}
