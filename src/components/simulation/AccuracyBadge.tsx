import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type AccuracyLevel = "actual" | "estimated" | "missing";

interface AccuracyBadgeProps {
  level: AccuracyLevel;
  label?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const accuracyConfig: Record<AccuracyLevel, {
  label: string;
  description: string;
  icon: typeof CheckCircle2;
  className: string;
}> = {
  actual: {
    label: "Actual Data",
    description: "Based on real SCADA meter readings",
    icon: CheckCircle2,
    className: "bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400",
  },
  estimated: {
    label: "Estimated",
    description: "Calculated from shop type templates and floor area",
    icon: AlertTriangle,
    className: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  },
  missing: {
    label: "Missing Data",
    description: "No profile assigned - using default assumptions",
    icon: AlertCircle,
    className: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400",
  },
};

export function AccuracyBadge({ level, label, showIcon = true, size = "sm", className }: AccuracyBadgeProps) {
  const config = accuracyConfig[level];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "font-medium cursor-help",
              size === "sm" ? "text-xs px-1.5 py-0" : "text-sm px-2 py-0.5",
              config.className,
              className
            )}
          >
            {showIcon && <Icon className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-4 w-4")} />}
            {label || config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface AccuracySummaryProps {
  actualCount: number;
  estimatedCount: number;
  missingCount: number;
  className?: string;
}

export function AccuracySummary({ actualCount, estimatedCount, missingCount, className }: AccuracySummaryProps) {
  const total = actualCount + estimatedCount + missingCount;
  if (total === 0) return null;

  const actualPercent = Math.round((actualCount / total) * 100);
  const estimatedPercent = Math.round((estimatedCount / total) * 100);
  const missingPercent = Math.round((missingCount / total) * 100);

  return (
    <div className={cn("flex items-center gap-3 text-xs", className)}>
      <span className="text-muted-foreground">Data Quality:</span>
      {actualCount > 0 && (
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span>{actualCount} actual ({actualPercent}%)</span>
        </div>
      )}
      {estimatedCount > 0 && (
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-amber-500" />
          <span>{estimatedCount} estimated ({estimatedPercent}%)</span>
        </div>
      )}
      {missingCount > 0 && (
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span>{missingCount} missing ({missingPercent}%)</span>
        </div>
      )}
    </div>
  );
}

export function getAccuracyLevel(hasScadaData: boolean, hasShopType: boolean): AccuracyLevel {
  if (hasScadaData) return "actual";
  if (hasShopType) return "estimated";
  return "missing";
}
