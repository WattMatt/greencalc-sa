import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BreakdownInput {
  label: string;
  value: string;
}

interface FinancialMetricRowProps {
  label: string;
  value: string;
  valueClassName?: string;
  breakdown: {
    formula: string;
    inputs: BreakdownInput[];
  };
}

export function FinancialMetricRow({ 
  label, 
  value, 
  valueClassName = "", 
  breakdown 
}: FinancialMetricRowProps) {
  return (
    <div className="grid grid-cols-2 hover:bg-muted/50">
      <div className="px-3 py-1.5 text-muted-foreground flex items-center gap-1.5">
        {label}
        <TooltipProvider>
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground hover:text-primary cursor-help flex-shrink-0" />
            </TooltipTrigger>
            <TooltipContent 
              className="max-w-xs p-3 bg-popover border border-border shadow-lg" 
              side="right"
              sideOffset={8}
            >
              <p className="text-xs font-semibold mb-2 text-foreground border-b border-border pb-2">
                {breakdown.formula}
              </p>
              <div className="space-y-1.5">
                {breakdown.inputs.map((input, i) => (
                  <div key={i} className="flex justify-between text-xs gap-4">
                    <span className="text-muted-foreground">{input.label}:</span>
                    <span className="font-mono text-foreground">{input.value}</span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className={`px-3 py-1.5 text-right font-medium ${valueClassName}`}>
        {value}
      </div>
    </div>
  );
}
