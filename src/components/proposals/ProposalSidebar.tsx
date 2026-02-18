import { useState, DragEvent } from "react";
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
  Loader2,
  Wand2,
  RefreshCw
} from "lucide-react";
import { ContentBlockToggle } from "./ContentBlockToggle";
import { BrandingForm } from "./BrandingForm";
import { TemplateSelector } from "./templates/TemplateSelector";
import { ContentBlock, ProposalBranding, SimulationData, Proposal, ContentBlockId, ContentBlockCategory } from "./types";
import { ProposalTemplateId } from "./templates/types";

// Mapping from ContentBlockId to edge function sectionType
const NARRATIVE_SECTION_MAP: Partial<Record<ContentBlockId, string>> = {
  introduction: "executive_summary",
  backgroundMethodology: "tariff_details",
  tenderReturnData: "engineering_specs",
  financialEstimates: "payback_timeline",
  financialConclusion: "investment_recommendation",
};

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
  aiNarratives?: Record<string, { narrative: string; keyHighlights?: string[] }>;
  onGenerateNarrative?: (blockId: ContentBlockId, sectionType: string) => void;
  generatingNarrativeId?: string | null;
  documentType?: 'proposal' | 'monthly_report';
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
  onToggleCollapse,
  aiNarratives,
  onGenerateNarrative,
  generatingNarrativeId,
  documentType = 'proposal'
}: ProposalSidebarProps) {
  const [activeTab, setActiveTab] = useState("content");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [blockFilter, setBlockFilter] = useState<'all' | 'proposal' | 'monthly_report'>(documentType);

  // Filter blocks based on selected filter
  const filteredBlocks = contentBlocks.filter(b => {
    if (blockFilter === 'all') return true;
    return b.category === 'general' || b.category === blockFilter;
  });
  const sortedBlocks = [...filteredBlocks].sort((a, b) => a.order - b.order);

  const handleBlockToggle = (blockId: string, enabled: boolean) => {
    const updatedBlocks = contentBlocks.map(block =>
      block.id === blockId ? { ...block, enabled } : block
    );
    onContentBlocksChange(updatedBlocks);
  };

  const handleDragStart = (e: DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDrop = (e: DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...sortedBlocks];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    const updated = reordered.map((block, i) => ({ ...block, order: i }));
    onContentBlocksChange(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleGenerateNarrative = (blockId: ContentBlockId) => {
    const sectionType = NARRATIVE_SECTION_MAP[blockId];
    if (sectionType && onGenerateNarrative) {
      onGenerateNarrative(blockId, sectionType);
    }
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
    <div className="w-80 bg-card border-r flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
        <h2 className="font-semibold text-sm">Configure Proposal</h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-3 grid grid-cols-3 flex-shrink-0">
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

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3">
            <TabsContent value="content" className="mt-0 space-y-2">
              {/* Block category filter - single cycling button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7 mb-3 justify-between"
                onClick={() => {
                  const cycle: Array<'all' | 'proposal' | 'monthly_report'> = [documentType, 'all', documentType === 'proposal' ? 'monthly_report' : 'proposal'];
                  const currentIndex = cycle.indexOf(blockFilter);
                  const nextIndex = (currentIndex + 1) % cycle.length;
                  setBlockFilter(cycle[nextIndex]);
                }}
              >
                <span>
                  {blockFilter === 'all' ? 'All Sections' : blockFilter === 'proposal' ? 'Proposal' : 'Monthly Report'}
                </span>
                <RefreshCw className="h-3 w-3 ml-1" />
              </Button>
              <p className="text-xs text-muted-foreground mb-3">
                Toggle sections and generate AI narratives for your proposal
              </p>
              {sortedBlocks.map((block, index) => {
                  const canGenerate = !!NARRATIVE_SECTION_MAP[block.id];
                  return (
                    <ContentBlockToggle
                      key={block.id}
                      block={block}
                      onChange={(enabled) => handleBlockToggle(block.id, enabled)}
                      disabled={disabled}
                      isDragging={draggedIndex === index}
                      isDragOver={dragOverIndex === index && draggedIndex !== index}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      hasNarrative={!!aiNarratives?.[block.id]}
                      canGenerateNarrative={canGenerate}
                      onGenerateNarrative={() => handleGenerateNarrative(block.id)}
                      isGeneratingNarrative={generatingNarrativeId === block.id}
                    />
                  );
                })}
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
          </div>
        </ScrollArea>
      </Tabs>

      {/* Export Actions */}
      <div className="p-3 border-t space-y-2 flex-shrink-0">
        <Button 
          className="w-full" 
          size="sm"
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
          size="sm"
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