import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface BreakdownInput {
  label: string;
  value: string;
}

interface MetricTooltipProps {
  formula: string;
  inputs: BreakdownInput[];
  children: React.ReactNode;
}

export function MetricTooltip({ formula, inputs, children }: MetricTooltipProps) {
  return (
    <HoverCard openDelay={100} closeDelay={50}>
      <HoverCardTrigger asChild>
        <span className="cursor-help border-b border-dashed border-muted-foreground/40 hover:border-primary transition-colors">
          {children}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 p-3 bg-popover border border-border shadow-lg" side="top" sideOffset={8}>
        <p className="text-xs font-semibold mb-2 text-foreground border-b border-border pb-2">
          {formula}
        </p>
        <div className="space-y-1.5">
          {inputs.map((input, i) => (
            <div key={i} className="flex justify-between text-xs gap-4">
              <span className="text-muted-foreground">{input.label}:</span>
              <span className="font-mono text-foreground">{input.value}</span>
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
