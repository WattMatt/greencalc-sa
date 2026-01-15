import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, FileText, Crown, Minus } from "lucide-react";
import { ProposalTemplateId, PROPOSAL_TEMPLATES } from "./types";
import { cn } from "@/lib/utils";

interface TemplateSelectorProps {
  selectedTemplate: ProposalTemplateId;
  onSelect: (template: ProposalTemplateId) => void;
  className?: string;
}

const TEMPLATE_ICONS: Record<ProposalTemplateId, React.ElementType> = {
  modern: Sparkles,
  classic: FileText,
  premium: Crown,
  minimal: Minus,
};

export function TemplateSelector({ selectedTemplate, onSelect, className }: TemplateSelectorProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Template Style</CardTitle>
        <CardDescription>Choose a visual style for your proposal</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {Object.values(PROPOSAL_TEMPLATES).map((template) => {
            const Icon = TEMPLATE_ICONS[template.id];
            const isSelected = selectedTemplate === template.id;

            return (
              <button
                key={template.id}
                onClick={() => onSelect(template.id)}
                className={cn(
                  "relative p-4 rounded-lg border text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}

                <div
                  className="w-8 h-8 rounded-md mb-3 flex items-center justify-center"
                  style={{ backgroundColor: template.colors.accentColor + "20" }}
                >
                  <Icon
                    className="h-4 w-4"
                    style={{ color: template.colors.accentColor }}
                  />
                </div>

                <p className="font-medium text-sm">{template.name}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {template.description}
                </p>

                {/* Color preview */}
                <div className="flex gap-1 mt-3">
                  <div
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: template.colors.headerBg }}
                    title="Header"
                  />
                  <div
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: template.colors.accentColor }}
                    title="Accent"
                  />
                  <div
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: template.colors.cardBg }}
                    title="Background"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
