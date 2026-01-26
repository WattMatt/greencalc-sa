import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface DayPresetsProps {
  selectedDays: Set<number>;
  onDaysChange: (days: Set<number>) => void;
}

const WEEKDAYS = new Set([1, 2, 3, 4, 5]); // Mon-Fri (1=Mon, 5=Fri)
const WEEKEND = new Set([0, 6]); // Sun=0, Sat=6
const ALL_DAYS = new Set([0, 1, 2, 3, 4, 5, 6]);

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

export function DayPresets({ selectedDays, onDaysChange }: DayPresetsProps) {
  // Determine which preset matches current selection
  const getCurrentPreset = (): string | undefined => {
    if (selectedDays.size === 0) return "none";
    if (setsEqual(selectedDays, WEEKDAYS)) return "weekday";
    if (setsEqual(selectedDays, WEEKEND)) return "weekend";
    if (setsEqual(selectedDays, ALL_DAYS)) return "all";
    return undefined;
  };

  const handlePresetChange = (value: string) => {
    if (!value) return; // Don't allow deselection
    
    switch (value) {
      case "none":
        onDaysChange(new Set());
        break;
      case "weekday":
        onDaysChange(new Set(WEEKDAYS));
        break;
      case "weekend":
        onDaysChange(new Set(WEEKEND));
        break;
      case "all":
        onDaysChange(new Set(ALL_DAYS));
        break;
    }
  };

  return (
    <ToggleGroup
      type="single"
      value={getCurrentPreset()}
      onValueChange={handlePresetChange}
      className="gap-0"
    >
      <ToggleGroupItem
        value="none"
        aria-label="Deselect all days"
        className="h-7 px-2 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-none rounded-l-md border-r border-border/50"
      >
        None
      </ToggleGroupItem>
      <ToggleGroupItem
        value="weekday"
        aria-label="Select weekdays"
        className="h-7 px-2 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-none border-r border-border/50"
      >
        Wkday
      </ToggleGroupItem>
      <ToggleGroupItem
        value="weekend"
        aria-label="Select weekend"
        className="h-7 px-2 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-none border-r border-border/50"
      >
        Wkend
      </ToggleGroupItem>
      <ToggleGroupItem
        value="all"
        aria-label="Select all days"
        className="h-7 px-2 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-none rounded-r-md"
      >
        All
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
