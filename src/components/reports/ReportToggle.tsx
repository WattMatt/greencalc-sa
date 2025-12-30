import React from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle, CheckCircle2 } from "lucide-react";
import { useReportSelection } from "@/hooks/useReportSelection";
import { SegmentType } from "@/components/reports/types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ReportToggleProps {
    id: string;
    segmentType: SegmentType;
    label: string;
    className?: string;
    variant?: "icon" | "button";
}

export function ReportToggle({
    id,
    segmentType,
    label,
    className,
    variant = "icon",
}: ReportToggleProps) {
    const { isSelected, toggleItem } = useReportSelection();
    const selected = isSelected(id);

    if (variant === "button") {
        return (
            <Button
                variant={selected ? "secondary" : "outline"}
                size="sm"
                onClick={(e) => {
                    e.stopPropagation();
                    toggleItem(id, segmentType, label);
                }}
                className={cn("gap-2 transition-all", selected && "bg-green-100 text-green-700 hover:bg-green-200 border-green-200", className)}
            >
                {selected ? <CheckCircle2 className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                {selected ? "Added to Report" : "Add to Report"}
            </Button>
        );
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleItem(id, segmentType, label);
                        }}
                        className={cn(
                            "h-8 w-8 transition-all rounded-full",
                            selected
                                ? "text-green-600 bg-green-50 hover:bg-green-100 hover:text-green-700"
                                : "text-muted-foreground hover:text-primary hover:bg-primary/10",
                            className
                        )}
                    >
                        {selected ? (
                            <CheckCircle2 className="h-5 w-5" />
                        ) : (
                            <PlusCircle className="h-5 w-5" />
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{selected ? "Remove from report" : "Add to report"}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
