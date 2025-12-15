import { cn } from "@/lib/utils";
import { LucideIcon, Check, ChevronRight, FileInput, Settings, BarChart3, Download } from "lucide-react";

interface ProcessStep {
  icon: LucideIcon;
  label: string;
  description?: string;
  status?: "complete" | "current" | "upcoming";
}

interface ProcessFlowProps {
  steps: ProcessStep[];
  orientation?: "horizontal" | "vertical";
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ProcessFlow({
  steps,
  orientation = "horizontal",
  className,
  size = "md",
}: ProcessFlowProps) {
  const isHorizontal = orientation === "horizontal";

  const sizeConfig = {
    sm: {
      icon: "h-4 w-4",
      container: "h-8 w-8",
      text: "text-xs",
      descText: "text-xs",
      gap: "gap-1",
      connector: isHorizontal ? "w-8" : "h-6",
    },
    md: {
      icon: "h-5 w-5",
      container: "h-10 w-10",
      text: "text-sm",
      descText: "text-xs",
      gap: "gap-1.5",
      connector: isHorizontal ? "w-12" : "h-8",
    },
    lg: {
      icon: "h-6 w-6",
      container: "h-12 w-12",
      text: "text-base",
      descText: "text-sm",
      gap: "gap-2",
      connector: isHorizontal ? "w-16" : "h-10",
    },
  };

  const config = sizeConfig[size];

  const getStatusStyles = (status: ProcessStep["status"]) => {
    switch (status) {
      case "complete":
        return {
          container: "bg-primary text-primary-foreground",
          text: "text-foreground",
        };
      case "current":
        return {
          container: "bg-primary/20 text-primary border-2 border-primary",
          text: "text-foreground font-medium",
        };
      case "upcoming":
      default:
        return {
          container: "bg-muted text-muted-foreground",
          text: "text-muted-foreground",
        };
    }
  };

  const renderConnector = (index: number) => {
    if (index === steps.length - 1) return null;

    const currentStatus = steps[index].status;
    const isComplete = currentStatus === "complete";

    if (isHorizontal) {
      return (
        <div className={cn("flex items-center", config.connector)}>
          <div 
            className={cn(
              "h-0.5 flex-1 transition-colors duration-300",
              isComplete ? "bg-primary" : "bg-border"
            )}
          />
          <ChevronRight 
            className={cn(
              "h-4 w-4 -mx-1",
              isComplete ? "text-primary" : "text-muted-foreground"
            )}
          />
          <div 
            className={cn(
              "h-0.5 flex-1 transition-colors duration-300",
              isComplete ? "bg-primary" : "bg-border"
            )}
          />
        </div>
      );
    }

    return (
      <div className={cn("flex justify-center", config.connector)}>
        <div 
          className={cn(
            "w-0.5 h-full transition-colors duration-300",
            isComplete ? "bg-primary" : "bg-border"
          )}
        />
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex",
        isHorizontal ? "flex-row items-start" : "flex-col",
        className
      )}
    >
      {steps.map((step, index) => {
        const Icon = step.icon;
        const status = step.status || "upcoming";
        const styles = getStatusStyles(status);

        return (
          <div
            key={index}
            className={cn(
              "flex",
              isHorizontal ? "flex-col items-center" : "flex-row items-start gap-3"
            )}
          >
            <div
              className={cn(
                "flex",
                isHorizontal ? "flex-row items-center" : "flex-col items-center"
              )}
            >
              {/* Step circle/icon */}
              <div
                className={cn(
                  "flex items-center justify-center rounded-full transition-all duration-300",
                  config.container,
                  styles.container
                )}
              >
                {status === "complete" ? (
                  <Check className={config.icon} />
                ) : (
                  <Icon className={config.icon} />
                )}
              </div>

              {/* Connector */}
              {isHorizontal && renderConnector(index)}
            </div>

            {/* Labels */}
            <div
              className={cn(
                "flex flex-col",
                config.gap,
                isHorizontal ? "items-center text-center mt-2 max-w-[100px]" : "flex-1"
              )}
            >
              <span className={cn(config.text, styles.text)}>{step.label}</span>
              {step.description && (
                <span className={cn(config.descText, "text-muted-foreground")}>
                  {step.description}
                </span>
              )}
            </div>

            {/* Vertical connector */}
            {!isHorizontal && renderConnector(index)}
          </div>
        );
      })}
    </div>
  );
}

// Example usage component for quick visual testing
export function ProcessFlowExample() {
  const exampleSteps: ProcessStep[] = [
    { icon: FileInput, label: "Import Data", status: "complete" },
    { icon: Settings, label: "Configure", status: "current" },
    { icon: BarChart3, label: "Simulate", status: "upcoming" },
    { icon: Download, label: "Export", status: "upcoming" },
  ];

  return (
    <div className="space-y-8 p-4">
      <div>
        <h4 className="text-sm font-medium mb-3">Horizontal (default)</h4>
        <ProcessFlow steps={exampleSteps} />
      </div>
      <div>
        <h4 className="text-sm font-medium mb-3">Vertical</h4>
        <ProcessFlow steps={exampleSteps} orientation="vertical" />
      </div>
    </div>
  );
}
