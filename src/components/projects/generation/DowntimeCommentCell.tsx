import React, { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DowntimeCommentCellProps {
  projectId: string;
  year: number;
  month: number;
  day: number;
  initialValue: string;
  pastComments: string[];
  onSaved?: () => void;
}

export function DowntimeCommentCell({
  projectId,
  year,
  month,
  day,
  initialValue,
  pastComments,
  onSaved,
}: DowntimeCommentCellProps) {
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSaved = useRef(initialValue);

  const save = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed === lastSaved.current) return;
      lastSaved.current = trimmed;

      if (!trimmed) {
        // Delete the comment row if empty
        await supabase
          .from("downtime_comments")
          .delete()
          .eq("project_id", projectId)
          .eq("year", year)
          .eq("month", month)
          .eq("day", day);
      } else {
        await supabase.from("downtime_comments").upsert(
          {
            project_id: projectId,
            year,
            month,
            day,
            comment: trimmed,
          },
          { onConflict: "project_id,year,month,day" }
        );
      }
      onSaved?.();
    },
    [projectId, year, month, day, onSaved]
  );

  const handleBlur = () => {
    save(value);
  };

  const handleSelect = (comment: string) => {
    setValue(comment);
    setOpen(false);
    save(comment);
    // Re-focus input after selection
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="flex items-center gap-0.5 min-w-[160px]">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="flex-1 h-6 px-1.5 text-xs bg-transparent border border-border/50 rounded-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/30 placeholder:text-muted-foreground"
        placeholder="Add comment..."
      />
      {pastComments.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-6 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-sm hover:bg-muted/50 transition-colors"
              tabIndex={-1}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="end" sideOffset={4}>
            <Command>
              <CommandInput placeholder="Search comments..." className="h-8 text-xs" />
              <CommandList>
                <CommandEmpty className="text-xs py-3">No matching comments.</CommandEmpty>
                <CommandGroup>
                  {pastComments.map((comment) => (
                    <CommandItem
                      key={comment}
                      value={comment}
                      onSelect={() => handleSelect(comment)}
                      className="text-xs cursor-pointer"
                    >
                      {comment}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
