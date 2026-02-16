import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Palette, 
  LayoutGrid, 
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2
} from "lucide-react";
import { ContentBlockToggle } from "./ContentBlockToggle";
import { BrandingForm } from "./BrandingForm";
import { TemplateSelector } from "./templates/TemplateSelector";
import { ContentBlock, ProposalBranding, SimulationData, Proposal } from "./types";
import { ProposalTemplateId } from "./templates/types";

interface ProposalSidebarProps {
  contentBlocks: ContentBlock[];
  onContentBlocksChange: (blocks: ContentBlock[]) => void;
  branding: ProposalBranding;
  onBrandingChange: (branding: ProposalBranding) => void;
  selectedTemplate: ProposalTemplateId;
  onTemplateChange: (template: ProposalTemplateId) => void;
  simulation: SimulationData | null;
  proposal: Partial<Proposal>;
  project: any;
  onExportPDF: () => Promise<void>;
  onExportExcel: () => void;
  isExporting?: boolean;
  disabled?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ProposalSidebar({
  contentBlocks,
  onContentBlocksChange,
  branding,
  onBrandingChange,
  selectedTemplate,
  onTemplateChange,
  simulation,
  onExportPDF,
  onExportExcel,
  isExporting,
  disabled,
  collapsed,
  onToggleCollapse
}: ProposalSidebarProps) {
  const [activeTab, setActiveTab] = useState("content");

  const handleBlockToggle = (blockId: string, enabled: boolean) => {
    const updatedBlocks = contentBlocks.map(block =>
      block.id === blockId ? { ...block, enabled } : block
    );
    onContentBlocksChange(updatedBlocks);
  };

  if (collapsed) {
    return (
      <div className="w-12 bg-card border-r flex flex-col items-center py-4 gap-2">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onToggleCollapse}
          className="mb-4"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => { onToggleCollapse?.(); setActiveTab("content"); }}>
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => { onToggleCollapse?.(); setActiveTab("branding"); }}>
          <Palette className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => { onToggleCollapse?.(); setActiveTab("template"); }}>
          <FileText className="h-4 w-4" />
        </Button>
        <Separator className="my-2" />
        <Button variant="ghost" size="icon" onClick={onExportPDF} disabled={!simulation || isExporting}>
          <Download className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-card border-r flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold">Configure Proposal</h2>
        <Button variant="ghost" size="icon" onClick={onToggleCollapse}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4 grid grid-cols-3">
          <TabsTrigger value="content" className="text-xs">
            <LayoutGrid className="h-3 w-3 mr-1" />
            Content
          </TabsTrigger>
          <TabsTrigger value="branding" className="text-xs opacity-50 cursor-not-allowed" disabled>
            <Palette className="h-3 w-3 mr-1" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="template" className="text-xs opacity-50 cursor-not-allowed" disabled>
            <FileText className="h-3 w-3 mr-1" />
            Template
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 p-4">
          <TabsContent value="content" className="mt-0 space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Toggle sections to include in your proposal
            </p>
            {contentBlocks
              .sort((a, b) => a.order - b.order)
              .map((block) => (
                <ContentBlockToggle
                  key={block.id}
                  block={block}
                  onChange={(enabled) => handleBlockToggle(block.id, enabled)}
                  disabled={disabled}
                />
              ))}
          </TabsContent>

          <TabsContent value="branding" className="mt-0">
            <BrandingForm
              branding={branding}
              onChange={onBrandingChange}
              disabled={disabled}
            />
          </TabsContent>

          <TabsContent value="template" className="mt-0">
            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onSelect={onTemplateChange}
            />
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Export Actions */}
      <div className="p-4 border-t space-y-2">
        <Button 
          className="w-full" 
          onClick={onExportPDF}
          disabled={!simulation || isExporting}
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export PDF
        </Button>
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={onExportExcel}
          disabled={!simulation}
        >
          <FileText className="mr-2 h-4 w-4" />
          Export Excel
        </Button>
      </div>
    </div>
  );
}
