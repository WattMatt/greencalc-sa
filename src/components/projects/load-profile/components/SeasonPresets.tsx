import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface SeasonPresetsProps {
  selectedMonths: Set<number>;
  onMonthsChange: (months: Set<number>) => void;
}

// Eskom TOU seasonal definitions
const SUMMER_MONTHS = new Set([0, 1, 2, 3, 4, 8, 9, 10, 11]); // Sep-May (Low Demand Season)
const WINTER_MONTHS = new Set([5, 6, 7]); // Jun-Aug (High Demand Season)
const ALL_MONTHS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const val of a) {
    if (!b.has(val)) return false;
  }
  return true;
}

export function SeasonPresets({ selectedMonths, onMonthsChange }: SeasonPresetsProps) {
  // Determine current preset based on selection
  const getCurrentPreset = (): string | undefined => {
    if (selectedMonths.size === 0) return "none";
    if (setsEqual(selectedMonths, SUMMER_MONTHS)) return "summer";
    if (setsEqual(selectedMonths, WINTER_MONTHS)) return "winter";
    if (setsEqual(selectedMonths, ALL_MONTHS)) return "all";
    return undefined;
  };

  const handlePresetChange = (value: string) => {
    if (!value) return;
    
    switch (value) {
      case "none":
        onMonthsChange(new Set());
        break;
      case "summer":
        onMonthsChange(new Set(SUMMER_MONTHS));
        break;
      case "winter":
        onMonthsChange(new Set(WINTER_MONTHS));
        break;
      case "all":
        onMonthsChange(new Set(ALL_MONTHS));
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
        size="sm" 
        className="text-xs px-2 h-7 rounded-r-none border-r-0"
        aria-label="Deselect all months"
      >
        None
      </ToggleGroupItem>
      <ToggleGroupItem 
        value="summer" 
        size="sm" 
        className="text-xs px-2 h-7 rounded-none border-r-0"
        aria-label="Select summer months (Sep-May)"
      >
        Summer
      </ToggleGroupItem>
      <ToggleGroupItem 
        value="winter" 
        size="sm" 
        className="text-xs px-2 h-7 rounded-none border-r-0"
        aria-label="Select winter months (Jun-Aug)"
      >
        Winter
      </ToggleGroupItem>
      <ToggleGroupItem 
        value="all" 
        size="sm" 
        className="text-xs px-2 h-7 rounded-l-none"
        aria-label="Select all months"
      >
        All
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
