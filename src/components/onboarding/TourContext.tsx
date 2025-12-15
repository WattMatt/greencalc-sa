import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface TourStep {
  target: string; // CSS selector for the element to highlight
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
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
}

const TourContext = createContext<TourContextType | undefined>(undefined);

const COMPLETED_TOURS_KEY = "completed_tours";

export function TourProvider({ children }: { children: ReactNode }) {
  const [activeTour, setActiveTour] = useState<Tour | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedTours, setCompletedTours] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(COMPLETED_TOURS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

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
  }, [activeTour]);

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

  const markTourCompleted = useCallback((tourId: string) => {
    setCompletedTours((prev) => {
      if (prev.includes(tourId)) return prev;
      const updated = [...prev, tourId];
      localStorage.setItem(COMPLETED_TOURS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const resetAllTours = useCallback(() => {
    setCompletedTours([]);
    localStorage.removeItem(COMPLETED_TOURS_KEY);
  }, []);

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
