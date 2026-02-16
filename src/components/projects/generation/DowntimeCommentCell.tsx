import React, { useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronDown } from "lucide-react";

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
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSaved = useRef(initialValue);
  const justAccepted = useRef(false);

  const filteredSuggestions = useMemo(() => {
    if (!value.trim()) return [];
    const lower = value.toLowerCase();
    return pastComments.filter((c) => c.toLowerCase().startsWith(lower) && c.toLowerCase() !== lower);
  }, [value, pastComments]);

  const activeSuggestion = filteredSuggestions.length > 0 ? filteredSuggestions[suggestionIndex % filteredSuggestions.length] : null;

  // The ghost text is the remainder of the suggestion after what the user typed
  const ghostText = activeSuggestion ? activeSuggestion.slice(value.length) : "";

  const save = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed === lastSaved.current) return;
      lastSaved.current = trimmed;

      if (!trimmed) {
        await supabase
          .from("downtime_comments")
          .delete()
          .eq("project_id", projectId)
          .eq("year", year)
          .eq("month", month)
          .eq("day", day);
      } else {
        await supabase.from("downtime_comments").upsert(
          { project_id: projectId, year, month, day, comment: trimmed },
          { onConflict: "project_id,year,month,day" }
        );
      }
      onSaved?.();
    },
    [projectId, year, month, day, onSaved]
  );

  const acceptSuggestion = useCallback(() => {
    if (activeSuggestion) {
      setValue(activeSuggestion);
      save(activeSuggestion);
      setSuggestionIndex(0);
      justAccepted.current = true;
    }
  }, [activeSuggestion, save]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setSuggestionIndex(0);
    justAccepted.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (justAccepted.current) {
      if (e.key === "Tab" || e.key === "Enter") {
        justAccepted.current = false;
        return; // let default behavior (focus next input)
      }
      justAccepted.current = false;
    }
    if (filteredSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionIndex((prev) => (prev + 1) % filteredSuggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionIndex((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        acceptSuggestion();
        return;
      }
      if (e.key === "Escape") {
        setSuggestionIndex(0);
        // Clear suggestions by blurring briefly or just let user keep typing
        return;
      }
    }
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  const handleBlur = () => {
    setFocused(false);
    save(value);
  };

  const handleSelect = (comment: string) => {
    setValue(comment);
    setOpen(false);
    save(comment);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="flex items-center gap-0.5 min-w-[160px]">
      <div className="relative flex-1">
        {/* Ghost text overlay */}
        <span
          aria-hidden
          className="absolute left-0 top-0 h-6 px-1.5 text-xs flex items-center pointer-events-none whitespace-nowrap overflow-hidden"
          style={{ maxWidth: "100%" }}
        >
          <span className="invisible">{value}</span>
          {ghostText && focused && (
            <span className="text-muted-foreground/50">{ghostText}</span>
          )}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full h-6 px-1.5 text-xs bg-transparent border border-border/50 rounded-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/30 placeholder:text-muted-foreground"
          placeholder="Add comment..."
        />
      </div>
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
