import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GripVertical, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContentBlock } from "./types";
import { DragEvent } from "react";

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
}

export function ContentBlockToggle({ block, onChange, disabled, isDragging, isDragOver, onDragStart, onDragEnd, onDragOver, onDrop }: ContentBlockToggleProps) {
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
        </div>
        <p className="block text-xs text-muted-foreground truncate">
          {block.description}
        </p>
      </div>
      
      <Switch
        className="shrink-0 data-[state=unchecked]:border data-[state=unchecked]:border-muted-foreground/40 data-[state=unchecked]:bg-muted"
        checked={block.enabled}
        onCheckedChange={onChange}
        disabled={disabled || block.required}
      />
    </div>
  );
}
