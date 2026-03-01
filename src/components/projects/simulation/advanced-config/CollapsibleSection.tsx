import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface CollapsibleSectionProps {
  icon: React.ReactNode;
  title: string;
  badge?: boolean;
  toggleEnabled?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleSection({
  icon,
  title,
  badge,
  toggleEnabled,
  onToggleEnabled,
  children,
  defaultOpen = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1">
              {icon}
              <Label className="text-sm font-medium cursor-pointer">{title}</Label>
              {badge && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Active</Badge>}
              {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          {onToggleEnabled !== undefined && (
            <Switch
              checked={toggleEnabled}
              onCheckedChange={onToggleEnabled}
            />
          )}
        </div>
        <CollapsibleContent>
          <div className="px-3 pb-3">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
