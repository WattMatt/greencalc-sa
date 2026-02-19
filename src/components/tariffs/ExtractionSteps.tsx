import { CheckCircle2, Loader2, Circle, Upload, Cpu, ClipboardCheck, Database } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExtractionStep = "upload" | "extract" | "review" | "save";

interface ExtractionStepsProps {
  currentStep: ExtractionStep;
  isProcessing?: boolean;
}

const steps: { key: ExtractionStep; label: string; icon: typeof Upload }[] = [
  { key: "upload", label: "Upload File", icon: Upload },
  { key: "extract", label: "AI Extraction", icon: Cpu },
  { key: "review", label: "Review Data", icon: ClipboardCheck },
  { key: "save", label: "Save to Database", icon: Database },
];

const stepIndex = (step: ExtractionStep) => steps.findIndex(s => s.key === step);

export function ExtractionSteps({ currentStep, isProcessing = false }: ExtractionStepsProps) {
  const activeIdx = stepIndex(currentStep);

  return (
    <div className="flex items-center w-full px-2 py-3">
      {steps.map((step, idx) => {
        const isComplete = idx < activeIdx;
        const isActive = idx === activeIdx;
        const isPending = idx > activeIdx;
        const StepIcon = step.icon;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1 min-w-[64px]">
              <div
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-full border-2 transition-all",
                  isComplete && "bg-primary border-primary text-primary-foreground",
                  isActive && "border-primary text-primary bg-primary/10",
                  isPending && "border-muted-foreground/30 text-muted-foreground/40"
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : isActive && isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <StepIcon className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium text-center leading-tight",
                  isComplete && "text-primary",
                  isActive && "text-primary",
                  isPending && "text-muted-foreground/50"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connecting line */}
            {idx < steps.length - 1 && (
              <div className="flex-1 mx-1 mt-[-16px]">
                <div
                  className={cn(
                    "h-0.5 w-full rounded-full transition-all",
                    idx < activeIdx ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
