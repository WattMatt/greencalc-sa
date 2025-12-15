import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, X, Sparkles, Zap, BarChart3 } from "lucide-react";
import { useTour } from "./TourContext";
import { TOURS } from "./tours";

const WELCOME_SHOWN_KEY = "welcome_modal_shown";

interface WelcomeModalProps {
  defaultTourId?: string;
}

export function WelcomeModal({ defaultTourId = "simulationHub" }: WelcomeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { startTour, setDemoMode } = useTour();

  useEffect(() => {
    // Check if this is a first-time user
    const hasSeenWelcome = localStorage.getItem(WELCOME_SHOWN_KEY);
    if (!hasSeenWelcome) {
      // Small delay to let the page render first
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleStartDemo = () => {
    localStorage.setItem(WELCOME_SHOWN_KEY, "true");
    setIsOpen(false);
    
    // Start the demo tour
    const tour = TOURS[defaultTourId];
    if (tour) {
      setDemoMode(true);
      startTour(tour);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(WELCOME_SHOWN_KEY, "true");
    setIsOpen(false);
  };

  const handleExplore = () => {
    localStorage.setItem(WELCOME_SHOWN_KEY, "true");
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl">Welcome to the Platform!</DialogTitle>
          <DialogDescription className="text-base pt-2">
            Your complete energy modeling and simulation toolkit for solar PV and battery storage projects.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Zap className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Quick Estimates</p>
              <p className="text-xs text-muted-foreground">Get instant ROI calculations for any site</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <BarChart3 className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Advanced Simulations</p>
              <p className="text-xs text-muted-foreground">Detailed modeling with real load profiles</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleStartDemo} className="w-full gap-2">
            <Play className="h-4 w-4" />
            Watch Demo Tour
          </Button>
          <Button variant="outline" onClick={handleExplore} className="w-full">
            Explore on My Own
          </Button>
          <Button variant="ghost" onClick={handleSkip} className="w-full text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Skip for Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Utility to reset welcome modal (for testing/settings)
export function resetWelcomeModal() {
  localStorage.removeItem(WELCOME_SHOWN_KEY);
}
