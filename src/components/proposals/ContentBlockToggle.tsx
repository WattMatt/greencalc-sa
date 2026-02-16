import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GripVertical, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContentBlock } from "./types";

interface ContentBlockToggleProps {
  block: ContentBlock;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function ContentBlockToggle({ block, onChange, disabled }: ContentBlockToggleProps) {
  return (
    <div 
      className={cn(
        "flex items-center gap-2 p-3 rounded-lg border bg-card transition-colors",
        block.enabled && "border-primary/30 bg-primary/5",
        !block.enabled && "opacity-60"
      )}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground cursor-grab" />
      
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium cursor-pointer truncate">
            {block.label}
          </Label>
          {block.required && (
            <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
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
