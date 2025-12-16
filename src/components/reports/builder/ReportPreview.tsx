import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  BarChart3, 
  Sparkles, 
  DollarSign, 
  Leaf, 
  Settings2,
  Image
} from "lucide-react";
import { Segment } from "./SegmentSelector";

interface ReportPreviewProps {
  segments: Segment[];
  projectName?: string;
  className?: string;
}

const segmentIcons: Record<string, React.ElementType> = {
  executive_summary: FileText,
  dcac_comparison: BarChart3,
  energy_flow: Sparkles,
  monthly_yield: BarChart3,
  payback_timeline: DollarSign,
  savings_breakdown: DollarSign,
  environmental_impact: Leaf,
  engineering_specs: Settings2,
};

export function ReportPreview({ segments, projectName = "Solar Project", className }: ReportPreviewProps) {
  const enabledSegments = segments.filter(s => s.enabled);
  const totalPages = Math.ceil(enabledSegments.length / 2) + 1; // +1 for cover

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Live Preview</CardTitle>
          <Badge variant="outline">{totalPages} pages</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-4">
            {/* Cover Page */}
            <div className="aspect-[8.5/11] bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border p-6 flex flex-col">
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                  <Image className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold">{projectName}</h3>
                <p className="text-sm text-muted-foreground mt-1">Solar Energy Proposal</p>
                <Separator className="my-4 w-24" />
                <p className="text-xs text-muted-foreground">
                  Generated {new Date().toLocaleDateString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Page 1 of {totalPages}</p>
              </div>
            </div>

            {/* Content Pages */}
            {enabledSegments.map((segment, index) => {
              const Icon = segmentIcons[segment.id] || FileText;
              const pageNum = Math.floor(index / 2) + 2;
              
              return (
                <div 
                  key={segment.id}
                  className="aspect-[8.5/11] bg-background rounded-lg border p-6 flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Icon className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm">{segment.label}</h4>
                  </div>
                  
                  <div className="flex-1 rounded-lg bg-muted/30 border border-dashed flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Icon className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">{segment.description}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-center">
                    <p className="text-xs text-muted-foreground">Page {pageNum} of {totalPages}</p>
                  </div>
                </div>
              );
            })}

            {enabledSegments.length === 0 && (
              <div className="aspect-[8.5/11] bg-muted/20 rounded-lg border border-dashed flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No segments selected</p>
                  <p className="text-xs mt-1">Select segments to preview your report</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
