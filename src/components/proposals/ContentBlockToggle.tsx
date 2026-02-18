import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GripVertical, Lock, Wand2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContentBlock } from "./types";
import { DragEvent } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ContentBlockToggleProps {
  block: ContentBlock;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  hasNarrative?: boolean;
  onGenerateNarrative?: () => void;
  isGeneratingNarrative?: boolean;
  canGenerateNarrative?: boolean;
}

export function ContentBlockToggle({ 
  block, onChange, disabled, isDragging, isDragOver, 
  onDragStart, onDragEnd, onDragOver, onDrop,
  hasNarrative, onGenerateNarrative, isGeneratingNarrative, canGenerateNarrative
}: ContentBlockToggleProps) {
  return (
    <div 
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "flex items-center gap-2 p-3 rounded-lg border bg-card transition-colors max-w-full",
        block.enabled && "border-primary/30 bg-primary/5",
        !block.enabled && "opacity-60",
        isDragging && "opacity-40",
        isDragOver && "border-t-2 border-t-primary"
      )}
    >
      <GripVertical className={cn("h-4 w-4 shrink-0 text-muted-foreground", isDragging ? "cursor-grabbing" : "cursor-grab")} />
      
      <div className="w-0 flex-1">
        <div className="flex items-center gap-2">
          <Label className="block text-sm font-medium cursor-pointer truncate">
            {block.label}
          </Label>
          {block.required && (
            <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          {hasNarrative && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Wand2 className="h-3 w-3 shrink-0 text-primary" />
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">AI narrative generated</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="block text-xs text-muted-foreground truncate">
          {block.description}
        </p>
      </div>

      {canGenerateNarrative && onGenerateNarrative && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={(e) => { e.stopPropagation(); onGenerateNarrative(); }}
                disabled={isGeneratingNarrative || disabled}
              >
                {isGeneratingNarrative ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">{hasNarrative ? "Regenerate AI narrative" : "Generate AI narrative"}</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      <Switch
        className="shrink-0 data-[state=unchecked]:border data-[state=unchecked]:border-muted-foreground/40 data-[state=unchecked]:bg-muted"
        checked={block.enabled}
        onCheckedChange={onChange}
        disabled={disabled || block.required}
      />
    </div>
  );
}