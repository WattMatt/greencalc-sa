import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DAY_LABELS } from "../types";

interface WeekdaySelectorProps {
  selectedDays: Set<number>; // 0=Sunday, 1=Monday, ..., 6=Saturday
  onDaysChange: (days: Set<number>) => void;
}

export function WeekdaySelector({ selectedDays, onDaysChange }: WeekdaySelectorProps) {
  const handleValueChange = (values: string[]) => {
    onDaysChange(new Set(values.map(v => parseInt(v, 10))));
  };

  return (
    <ToggleGroup
      type="multiple"
      value={Array.from(selectedDays).map(String)}
      onValueChange={handleValueChange}
      className="h-7 gap-0 border rounded-md"
    >
      {DAY_LABELS.map((label, index) => (
        <ToggleGroupItem
          key={index}
          value={String(index)}
          aria-label={`Day ${label}`}
          className="h-7 w-7 px-0 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-none first:rounded-l-md last:rounded-r-md border-r last:border-r-0"
        >
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
