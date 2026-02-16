import React, { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronUp, ChevronDown } from "lucide-react";

interface DowntimeSlotCellProps {
  projectId: string;
  year: number;
  month: number;
  day: number;
  readingSource: string;
  calculatedSlots: number;
  overrideValue: number | undefined;
  onChanged?: () => void;
}

export function DowntimeSlotCell({
  projectId,
  year,
  month,
  day,
  readingSource,
  calculatedSlots,
  overrideValue,
  onChanged,
}: DowntimeSlotCellProps) {
  const [value, setValue] = useState<number>(overrideValue ?? calculatedSlots);
  const isOverridden = overrideValue !== undefined;

  // Sync when props change
  React.useEffect(() => {
    setValue(overrideValue ?? calculatedSlots);
  }, [overrideValue, calculatedSlots]);

  const persist = useCallback(
    async (newValue: number) => {
      await supabase.from("downtime_slot_overrides").upsert(
        {
          project_id: projectId,
          year,
          month,
          day,
          reading_source: readingSource,
          slot_override: newValue,
        },
        { onConflict: "project_id,year,month,day,reading_source" }
      );
      onChanged?.();
    },
    [projectId, year, month, day, readingSource, onChanged]
  );

  const handleClick = (delta: number) => {
    const next = Math.max(0, value + delta);
    setValue(next);
    persist(next);
  };

  return (
    <div className="flex items-center justify-end gap-0.5">
      <span className={`tabular-nums ${isOverridden ? "font-semibold text-primary" : ""}`}>
        {value}
      </span>
      <div className="flex flex-col -my-1">
        <button
          type="button"
          onClick={() => handleClick(1)}
          className="h-3 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-sm hover:bg-muted/50 transition-colors"
          tabIndex={-1}
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => handleClick(-1)}
          className="h-3 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-sm hover:bg-muted/50 transition-colors"
          tabIndex={-1}
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
