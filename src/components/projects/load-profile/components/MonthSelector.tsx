import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MONTH_LABELS } from "../types";

interface MonthSelectorProps {
  selectedMonths: Set<number>;
  onMonthsChange: (months: Set<number>) => void;
}

export function MonthSelector({ selectedMonths, onMonthsChange }: MonthSelectorProps) {
  const handleToggle = (values: string[]) => {
    const newMonths = new Set(values.map(v => parseInt(v, 10)));
    onMonthsChange(newMonths);
  };

  return (
    <ToggleGroup
      type="multiple"
      value={Array.from(selectedMonths).map(String)}
      onValueChange={handleToggle}
      className="gap-0"
    >
      {MONTH_LABELS.map((label, index) => (
        <ToggleGroupItem
          key={index}
          value={String(index)}
          aria-label={`Toggle ${label}`}
          className="h-7 w-6 px-0 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-none first:rounded-l-md last:rounded-r-md border-r border-border/50 last:border-r-0"
        >
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
