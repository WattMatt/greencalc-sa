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
        "flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors",
        block.enabled && "border-primary/30 bg-primary/5",
        !block.enabled && "opacity-60"
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium cursor-pointer">
            {block.label}
          </Label>
          {block.required && (
            <Lock className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {block.description}
        </p>
      </div>
      
      <Switch
        checked={block.enabled}
        onCheckedChange={onChange}
        disabled={disabled || block.required}
      />
    </div>
  );
}
