import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  BarChart3, 
  Sparkles, 
  DollarSign, 
  Leaf, 
  Settings2,
  ChevronRight,
  GripVertical
} from "lucide-react";
import { SegmentType } from "../types";

interface Segment {
  id: SegmentType;
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
}

const defaultSegments: Segment[] = [
  { id: "executive_summary", label: "Executive Summary", description: "Key metrics and AI illustration", icon: FileText, enabled: true },
  { id: "dcac_comparison", label: "DC/AC Analysis", description: "Oversizing ratio comparison", icon: BarChart3, enabled: true },
  { id: "energy_flow", label: "Energy Flow", description: "Sankey diagram of energy distribution", icon: Sparkles, enabled: true },
  { id: "monthly_yield", label: "Monthly Yield", description: "12-month generation forecast", icon: BarChart3, enabled: false },
  { id: "payback_timeline", label: "Payback Timeline", description: "Financial payback projection", icon: DollarSign, enabled: true },
  { id: "tariff_details", label: "Tariff Analysis", description: "Detailed breakdown of electricity tariff", icon: DollarSign, enabled: true },
  { id: "environmental_impact", label: "Environmental Impact", description: "CO2 reduction metrics", icon: Leaf, enabled: false },
  { id: "engineering_specs", label: "Engineering Specs", description: "Technical specifications", icon: Settings2, enabled: true },
  { id: "ai_infographics", label: "AI Infographics", description: "Auto-generated professional visuals", icon: Sparkles, enabled: false },
];

interface SegmentSelectorProps {
  segments: Segment[];
  onSegmentsChange: (segments: Segment[]) => void;
  className?: string;
}

export function SegmentSelector({ segments, onSegmentsChange, className }: SegmentSelectorProps) {
  const enabledCount = segments.filter(s => s.enabled).length;

  const toggleSegment = (id: SegmentType) => {
    onSegmentsChange(
      segments.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    );
  };

  const selectAll = () => {
    onSegmentsChange(segments.map(s => ({ ...s, enabled: true })));
  };

  const selectNone = () => {
    onSegmentsChange(segments.map(s => ({ ...s, enabled: false })));
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Report Segments</CardTitle>
            <CardDescription>{enabledCount} of {segments.length} selected</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>All</Button>
            <Button variant="ghost" size="sm" onClick={selectNone}>None</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="space-y-1 p-4 pt-0">
            {segments.map((segment) => {
              const Icon = segment.icon;
              return (
                <button
                  key={segment.id}
                  onClick={() => toggleSegment(segment.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    segment.enabled
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <Checkbox 
                    checked={segment.enabled} 
                    onCheckedChange={() => toggleSegment(segment.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Icon className={`h-4 w-4 ${segment.enabled ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{segment.label}</div>
                    <div className="text-xs text-muted-foreground">{segment.description}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export { defaultSegments };
export type { Segment };
