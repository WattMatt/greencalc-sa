import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { OnboardingStep } from '@/hooks/useOnboardingProgress';
import { CheckCircle, Circle, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingChecklistProps {
  steps: OnboardingStep[];
  progress: number;
  completedCount: number;
  totalSteps: number;
  isComplete: boolean;
  onDismiss: () => void;
  onReset?: () => void;
}

export function OnboardingChecklist({
  steps,
  progress,
  completedCount,
  totalSteps,
  isComplete,
  onDismiss,
  onReset,
}: OnboardingChecklistProps) {
  if (isComplete) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">
                  All done! You've completed the setup.
                </p>
                <p className="text-sm text-muted-foreground">
                  You're ready to manage your project schedule
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onReset && (
                <Button variant="ghost" size="sm" onClick={onReset}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onDismiss}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Getting Started</CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {completedCount}/{totalSteps}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-3 p-2 rounded-md transition-colors",
                step.completed && "opacity-60"
              )}
            >
              <div className="mt-0.5">
                {step.completed ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium",
                  step.completed && "line-through"
                )}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
