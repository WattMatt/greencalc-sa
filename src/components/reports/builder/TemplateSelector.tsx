import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Briefcase, Wrench, Sparkles } from "lucide-react";
import { ReportTemplate } from "../types";

interface TemplatePreset {
  id: ReportTemplate;
  name: string;
  description: string;
  icon: React.ElementType;
  segments: string[];
}

const templates: TemplatePreset[] = [
  {
    id: "executive",
    name: "Executive Summary",
    description: "High-level overview for decision makers",
    icon: Briefcase,
    segments: ["executive_summary", "payback_timeline", "environmental_impact"]
  },
  {
    id: "technical",
    name: "Technical Report",
    description: "Detailed engineering specifications",
    icon: Wrench,
    segments: ["dcac_comparison", "energy_flow", "monthly_yield", "engineering_specs"]
  },
  {
    id: "financial",
    name: "Financial Report",
    description: "Complete financial analysis and projections",
    icon: FileText,
    segments: ["executive_summary", "payback_timeline", "tariff_details", "savings_breakdown", "monthly_yield"]
  },
  {
    id: "custom",
    name: "Custom",
    description: "Build your own report structure",
    icon: Sparkles,
    segments: []
  }
];

interface TemplateSelectorProps {
  selectedTemplate: ReportTemplate;
  onTemplateSelect: (template: ReportTemplate, segments: string[]) => void;
  className?: string;
}

export function TemplateSelector({ selectedTemplate, onTemplateSelect, className }: TemplateSelectorProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Template Presets</CardTitle>
        <CardDescription>Quick-start with predefined layouts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {templates.map((template) => {
            const Icon = template.icon;
            const isSelected = selectedTemplate === template.id;
            
            return (
              <button
                key={template.id}
                onClick={() => onTemplateSelect(template.id, template.segments)}
                className={`relative p-4 rounded-lg border text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <Icon className={`h-5 w-5 mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <p className="font-medium text-sm">{template.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                {template.segments.length > 0 && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    {template.segments.length} segments
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export { templates };
export type { TemplatePreset };
