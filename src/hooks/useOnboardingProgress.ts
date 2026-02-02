import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'gantt-onboarding-progress';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: 'create_task',
    title: 'Create your first task',
    description: 'Add a task to start building your project schedule',
    completed: false,
  },
  {
    id: 'add_milestone',
    title: 'Add a milestone',
    description: 'Mark important dates or deliverables',
    completed: false,
  },
  {
    id: 'create_dependency',
    title: 'Link tasks with dependencies',
    description: 'Show how tasks relate to each other',
    completed: false,
  },
  {
    id: 'assign_owner',
    title: 'Assign task owners',
    description: 'Track who is responsible for each task',
    completed: false,
  },
  {
    id: 'save_baseline',
    title: 'Save a baseline',
    description: 'Create a snapshot to track schedule changes',
    completed: false,
  },
  {
    id: 'use_filters',
    title: 'Try filtering tasks',
    description: 'Find tasks by status, owner, or color',
    completed: false,
  },
];

export function useOnboardingProgress(projectId: string) {
  const [steps, setSteps] = useState<OnboardingStep[]>(DEFAULT_STEPS);
  const [isDismissed, setIsDismissed] = useState(false);

  // Load progress from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${projectId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.dismissed) {
          setIsDismissed(true);
        }
        if (parsed.steps) {
          setSteps(prevSteps => 
            prevSteps.map(step => ({
              ...step,
              completed: parsed.steps[step.id] || false,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to load onboarding progress:', error);
    }
  }, [projectId]);

  // Save progress to localStorage
  const saveProgress = useCallback((newSteps: OnboardingStep[], dismissed: boolean) => {
    try {
      const stepProgress: Record<string, boolean> = {};
      newSteps.forEach(step => {
        stepProgress[step.id] = step.completed;
      });
      
      localStorage.setItem(`${STORAGE_KEY}-${projectId}`, JSON.stringify({
        steps: stepProgress,
        dismissed,
      }));
    } catch (error) {
      console.error('Failed to save onboarding progress:', error);
    }
  }, [projectId]);

  const completeStep = useCallback((stepId: string) => {
    setSteps(prev => {
      const updated = prev.map(step => 
        step.id === stepId ? { ...step, completed: true } : step
      );
      saveProgress(updated, isDismissed);
      return updated;
    });
  }, [saveProgress, isDismissed]);

  const dismissOnboarding = useCallback(() => {
    setIsDismissed(true);
    saveProgress(steps, true);
  }, [steps, saveProgress]);

  const resetOnboarding = useCallback(() => {
    const resetSteps = DEFAULT_STEPS.map(step => ({ ...step, completed: false }));
    setSteps(resetSteps);
    setIsDismissed(false);
    saveProgress(resetSteps, false);
  }, [saveProgress]);

  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;
  const isComplete = completedCount === steps.length;

  return {
    steps,
    completedCount,
    totalSteps: steps.length,
    progress,
    isComplete,
    isDismissed,
    completeStep,
    dismissOnboarding,
    resetOnboarding,
  };
}
