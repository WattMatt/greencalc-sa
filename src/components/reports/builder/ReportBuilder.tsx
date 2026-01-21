import React, { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Download,
  Loader2,
  Sun,
  Battery,
  DollarSign,
  TrendingUp,
  BarChart3,
  Sparkles,
  Leaf,
  Settings2,
  Zap,
  GripVertical,
  Wand2,
  RefreshCw,
  Scale,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { ReportSegment, SegmentType } from "../types";
import { Separator } from "@/components/ui/separator";
import { generateReportPDF } from "@/lib/pdfshift";

// Segment definitions with icons
const SEGMENT_OPTIONS: Array<{
  id: SegmentType;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  { id: "executive_summary", label: "Executive Summary", description: "Key metrics overview", icon: FileText },
  { id: "tariff_details", label: "Tariff Analysis", description: "TOU rates & seasonal breakdown", icon: Zap },
  { id: "dcac_comparison", label: "DC/AC Analysis", description: "Oversizing ratio comparison", icon: BarChart3 },
  { id: "sizing_comparison", label: "Sizing Alternatives", description: "Conservative vs aggressive options", icon: Scale },
  { id: "energy_flow", label: "Energy Flow", description: "System energy distribution", icon: Sparkles },
  { id: "monthly_yield", label: "Monthly Yield", description: "12-month generation forecast", icon: BarChart3 },
  { id: "payback_timeline", label: "Payback Timeline", description: "Financial ROI projection", icon: DollarSign },
  { id: "sensitivity_analysis", label: "Sensitivity Analysis", description: "ROI under different scenarios", icon: TrendingUp },
  { id: "environmental_impact", label: "Environmental Impact", description: "CO2 reduction metrics", icon: Leaf },
  { id: "engineering_specs", label: "Engineering Specs", description: "Technical specifications", icon: Settings2 },
];

// AI Narrative types - supports ALL report sections
type NarrativeContent = { narrative: string; keyHighlights: string[] };
type AIProposalNarrative = Partial<Record<SegmentType, NarrativeContent>>;

interface ReportBranding {
  company_name?: string | null;
  logo_url?: string | null;
  primary_color?: string;
  secondary_color?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  address?: string | null;
  client_logo_url?: string | null;
}

interface ReportBuilderProps {
  projectName?: string;
  projectId?: string;
  simulationData?: {
    solarCapacityKwp?: number;
    batteryCapacityKwh?: number;
    annualSavings?: number;
    paybackYears?: number;
    roiPercent?: number;
    co2AvoidedTons?: number;
    dcAcRatio?: number;
  };
  branding?: ReportBranding;
  className?: string;
}

export function ReportBuilder({
  projectName = "Solar Project",
  projectId,
  simulationData: initialSimulationData,
  branding,
  className
}: ReportBuilderProps) {
  const [reportName, setReportName] = useState(`${projectName} Report`);
  const [selectedSegments, setSelectedSegments] = useState<Set<SegmentType>>(
    new Set(["executive_summary", "tariff_details", "dcac_comparison", "payback_timeline", "engineering_specs"])
  );
  const [segmentOrder, setSegmentOrder] = useState<SegmentType[]>(SEGMENT_OPTIONS.map(s => s.id));
  const [isGenerating, setIsGenerating] = useState(false);
  const [draggedSegment, setDraggedSegment] = useState<SegmentType | null>(null);
  const [dragOverSegment, setDragOverSegment] = useState<SegmentType | null>(null);
  
  // AI Narrative state
  const [aiNarratives, setAiNarratives] = useState<AIProposalNarrative>({});
  const [editedNarratives, setEditedNarratives] = useState<Partial<Record<SegmentType, string>>>({});
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  
  // Page navigation state
  const [currentPage, setCurrentPage] = useState(0);
  const [aiNarrativeEnabled, setAiNarrativeEnabled] = useState(true);

  // Fetch project details including tariff
  const { data: projectDetails } = useQuery({
    queryKey: ["project-details", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          tariffs:tariff_id (
            name,
            tariff_type,
            municipalities:municipality_id (name)
          )
        `)
        .eq("id", projectId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch latest simulation if not provided
  const { data: latestSimulation } = useQuery({
    queryKey: ["latest-simulation", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("project_simulations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!projectId && !initialSimulationData,
  });

  // Merge provided data with fetched data
  const simulationData = useMemo(() => {
    if (initialSimulationData) return initialSimulationData;
    if (!latestSimulation) return {
      solarCapacityKwp: 100,
      batteryCapacityKwh: 50,
      annualSavings: 250000,
      paybackYears: 5.2,
      roiPercent: 18,
      co2AvoidedTons: 120,
      dcAcRatio: 1.3,
    };

    const results = latestSimulation.results_json as any;
    const pvConfig = results?.pvConfig || {};

    return {
      solarCapacityKwp: latestSimulation.solar_capacity_kwp || 0,
      batteryCapacityKwh: latestSimulation.battery_capacity_kwh || 0,
      annualSavings: latestSimulation.annual_solar_savings || 0,
      paybackYears: latestSimulation.payback_years || 0,
      roiPercent: latestSimulation.roi_percentage || 0,
      co2AvoidedTons: (latestSimulation.solar_capacity_kwp || 0) * 1.2,
      dcAcRatio: pvConfig.dcAcRatio || 1.3,
    };
  }, [initialSimulationData, latestSimulation]);

  const toggleSegment = (id: SegmentType) => {
    setSelectedSegments(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSegments(new Set(SEGMENT_OPTIONS.map(s => s.id)));
  };

  const selectNone = () => {
    setSelectedSegments(new Set());
  };

  // Drag and drop handlers
  const handleDragStart = useCallback((segmentId: SegmentType) => {
    setDraggedSegment(segmentId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, segmentId: SegmentType) => {
    e.preventDefault();
    if (draggedSegment && draggedSegment !== segmentId) {
      setDragOverSegment(segmentId);
    }
  }, [draggedSegment]);

  const handleDragLeave = useCallback(() => {
    setDragOverSegment(null);
  }, []);

  const handleDrop = useCallback((targetId: SegmentType) => {
    if (!draggedSegment || draggedSegment === targetId) {
      setDraggedSegment(null);
      setDragOverSegment(null);
      return;
    }

    setSegmentOrder(prev => {
      const newOrder = [...prev];
      const draggedIndex = newOrder.indexOf(draggedSegment);
      const targetIndex = newOrder.indexOf(targetId);
      
      // Remove dragged item and insert at target position
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedSegment);
      
      return newOrder;
    });

    setDraggedSegment(null);
    setDragOverSegment(null);
  }, [draggedSegment]);

  const handleDragEnd = useCallback(() => {
    setDraggedSegment(null);
    setDragOverSegment(null);
  }, []);

  // Get ordered segment options
  const orderedSegmentOptions = useMemo(() => {
    return segmentOrder.map(id => SEGMENT_OPTIONS.find(s => s.id === id)!).filter(Boolean);
  }, [segmentOrder]);

  const enabledSegments = orderedSegmentOptions.filter(s => selectedSegments.has(s.id));
  const totalPages = enabledSegments.length + 1; // Cover page + one page per segment

  // Page navigation helpers
  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
  }, [totalPages]);

  const goToFirstPage = useCallback(() => goToPage(0), [goToPage]);
  const goToLastPage = useCallback(() => goToPage(totalPages - 1), [goToPage, totalPages]);
  const goToPrevPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);
  const goToNextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);

  // Reset to first page when segments change
  React.useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [totalPages, currentPage]);

  // Generate AI Narrative
  const generateAINarrative = useCallback(async (sectionType?: string) => {
    setIsGeneratingNarrative(true);
    
    try {
      const tariffInfo = projectDetails?.tariffs;
      const projectData = {
        projectName,
        location: projectDetails?.location,
        buildingArea: projectDetails?.total_area_sqm,
        connectionSize: projectDetails?.connection_size_kva,
        solarCapacityKwp: simulationData.solarCapacityKwp,
        batteryCapacityKwh: simulationData.batteryCapacityKwh,
        dcAcRatio: simulationData.dcAcRatio,
        tariffName: tariffInfo?.name,
        tariffType: tariffInfo?.tariff_type,
        municipalityName: tariffInfo?.municipalities?.name,
        annualSavings: simulationData.annualSavings,
        paybackYears: simulationData.paybackYears,
        roiPercent: simulationData.roiPercent,
      };

      // Generate for ALL enabled segments, not just a fixed list
      const sectionsToGenerate = sectionType 
        ? [sectionType] 
        : Array.from(selectedSegments);

      const results = await Promise.all(
        sectionsToGenerate.map(async (section) => {
          const { data, error } = await supabase.functions.invoke('generate-proposal-narrative', {
            body: { sectionType: section, projectData }
          });
          
          if (error) throw error;
          return { section, data };
        })
      );

      const newNarratives = { ...aiNarratives };
      results.forEach(({ section, data }) => {
        if (data?.narrative) {
          newNarratives[section as keyof AIProposalNarrative] = {
            narrative: data.narrative,
            keyHighlights: data.keyHighlights || []
          };
        }
      });

      setAiNarratives(newNarratives);
      toast.success("AI narrative generated successfully!");
    } catch (error) {
      console.error('AI narrative generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate narrative';
      
      if (errorMessage.includes('Rate limit')) {
        toast.error("AI rate limit reached. Please try again in a moment.");
      } else if (errorMessage.includes('credits')) {
        toast.error("AI credits exhausted. Please add credits to continue.");
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsGeneratingNarrative(false);
    }
  }, [projectDetails, projectName, simulationData, aiNarratives]);

  // Generate PDF using PDFShift
  const handleGeneratePDF = async () => {
    if (enabledSegments.length === 0) {
      toast.error("Please select at least one segment");
      return;
    }

    setIsGenerating(true);
    
    try {
      const result = await generateReportPDF({
        reportName,
        projectName,
        simulationData: {
          solarCapacityKwp: simulationData.solarCapacityKwp || 0,
          batteryCapacityKwh: simulationData.batteryCapacityKwh || 0,
          annualSavings: simulationData.annualSavings || 0,
          paybackYears: simulationData.paybackYears || 0,
          roiPercent: simulationData.roiPercent || 0,
          co2AvoidedTons: simulationData.co2AvoidedTons || 0,
          dcAcRatio: simulationData.dcAcRatio || 1.3,
        },
        projectDetails: projectDetails ? {
          location: projectDetails.location || undefined,
          total_area_sqm: projectDetails.total_area_sqm || undefined,
          connection_size_kva: projectDetails.connection_size_kva || undefined,
          tariffs: projectDetails.tariffs ? {
            name: projectDetails.tariffs.name || undefined,
            tariff_type: projectDetails.tariffs.tariff_type || undefined,
            municipalities: projectDetails.tariffs.municipalities || undefined,
          } : undefined,
        } : undefined,
        branding: branding ? {
          company_name: branding.company_name,
          logo_url: branding.logo_url,
          primary_color: branding.primary_color,
          contact_email: branding.contact_email,
          contact_phone: branding.contact_phone,
          website: branding.website,
        } : undefined,
        segments: enabledSegments.map((seg, index) => ({
          type: seg.id,
          enabled: true,
          order: index,
        })),
        aiNarratives: aiNarrativeEnabled ? aiNarratives : undefined,
      });
      
      if (result.success) {
        toast.success("PDF generated successfully!");
      } else {
        toast.error(result.error || "Failed to generate PDF");
      }
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <Input
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              className="text-lg font-semibold border-none p-0 h-auto focus-visible:ring-0 bg-transparent"
            />
            <p className="text-sm text-muted-foreground">
              {selectedSegments.size} of {SEGMENT_OPTIONS.length} segments selected
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* AI Narrative Button */}
          <Button
            variant="outline"
            onClick={() => generateAINarrative()}
            disabled={isGeneratingNarrative}
          >
            {isGeneratingNarrative ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : aiNarratives.executive_summary ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate AI
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate AI Narrative
              </>
            )}
          </Button>
          
          <Button 
            onClick={handleGeneratePDF} 
            disabled={isGenerating || selectedSegments.size === 0}
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Generate PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* AI Narrative Status Banner */}
      {aiNarratives.executive_summary && (
        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-emerald-600" />
            <span className="text-sm text-emerald-700 dark:text-emerald-400">
              AI-generated professional narrative active
            </span>
            <Badge variant="secondary" className="text-xs">
              {Object.keys(aiNarratives).length} sections
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAiNarrativeEnabled(!aiNarrativeEnabled)}
            className="text-xs"
          >
            {aiNarrativeEnabled ? "Disable AI Text" : "Enable AI Text"}
          </Button>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Segment Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Report Sections</h3>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>All</Button>
              <Button variant="ghost" size="sm" onClick={selectNone}>None</Button>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mb-2">
            Drag to reorder sections in your PDF
          </p>
          <div className="space-y-2">
            {orderedSegmentOptions.map((segment) => {
              const Icon = segment.icon;
              const isSelected = selectedSegments.has(segment.id);
              const isDragging = draggedSegment === segment.id;
              const isDragOver = dragOverSegment === segment.id;
              
              return (
                <div
                  key={segment.id}
                  draggable
                  onDragStart={() => handleDragStart(segment.id)}
                  onDragOver={(e) => handleDragOver(e, segment.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(segment.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => toggleSegment(segment.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all cursor-grab active:cursor-grabbing ${
                    isDragging ? "opacity-50 scale-95" : ""
                  } ${
                    isDragOver ? "ring-2 ring-primary ring-offset-2" : ""
                  } ${
                    isSelected
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-muted/30 border border-transparent hover:bg-muted/50"
                  }`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                  <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => toggleSegment(segment.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                      {segment.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{segment.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: WYSIWYG PDF Preview with Page Navigation */}
        <div className="lg:col-span-2">
          {/* Preview Header with Navigation */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">PDF Preview</h3>
            <div className="flex items-center gap-2">
              {/* Page Navigation Controls */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={goToFirstPage}
                  disabled={currentPage === 0 || totalPages === 0}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={goToPrevPage}
                  disabled={currentPage === 0 || totalPages === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="px-3 py-1 text-sm font-medium min-w-[80px] text-center">
                  {totalPages > 0 ? `${currentPage + 1} / ${totalPages}` : "0 / 0"}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={goToNextPage}
                  disabled={currentPage >= totalPages - 1 || totalPages === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={goToLastPage}
                  disabled={currentPage >= totalPages - 1 || totalPages === 0}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
              <Badge variant="outline">{totalPages} pages</Badge>
            </div>
          </div>
          
          {/* Page Thumbnails */}
          <div className="mb-4">
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-2">
                {/* Cover thumbnail */}
                <button
                  onClick={() => goToPage(0)}
                  className={`flex-shrink-0 w-16 h-20 rounded border-2 transition-all overflow-hidden ${
                    currentPage === 0 
                      ? 'border-primary ring-2 ring-primary/20' 
                      : 'border-muted hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="w-full h-full bg-background flex flex-col">
                    <div className="h-3 bg-primary" />
                    <div className="flex-1 flex items-center justify-center">
                      <Sun className="h-4 w-4 text-primary/50" />
                    </div>
                    <div className="text-[6px] text-center text-muted-foreground pb-0.5">Cover</div>
                  </div>
                </button>
                
                {/* Segment thumbnails */}
                {enabledSegments.map((segment, index) => {
                  const Icon = segment.icon;
                  const pageNum = index + 1;
                  return (
                    <button
                      key={segment.id}
                      onClick={() => goToPage(pageNum)}
                      className={`flex-shrink-0 w-16 h-20 rounded border-2 transition-all overflow-hidden ${
                        currentPage === pageNum 
                          ? 'border-primary ring-2 ring-primary/20' 
                          : 'border-muted hover:border-muted-foreground/50'
                      }`}
                    >
                      <div className="w-full h-full bg-background flex flex-col">
                        <div className="h-3 bg-muted/50 flex items-center justify-center">
                          <Icon className="h-2 w-2 text-primary" />
                        </div>
                        <div className="flex-1 flex items-center justify-center p-1">
                          <div className="w-full space-y-0.5">
                            <div className="h-1 bg-muted rounded w-full" />
                            <div className="h-1 bg-muted rounded w-3/4" />
                            <div className="h-1 bg-muted rounded w-1/2" />
                          </div>
                        </div>
                        <div className="text-[6px] text-center text-muted-foreground pb-0.5 truncate px-0.5">
                          {segment.label.split(' ')[0]}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Single Page Preview */}
          <div className="rounded-lg border bg-muted/20 p-6">
            <div className="max-w-md mx-auto">
              {/* Cover Page */}
              {currentPage === 0 && (
                <div className="aspect-[8.5/11] bg-background rounded-lg shadow-lg overflow-hidden relative">
                  {/* Page break indicator */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                  
                  {/* Green header with logos */}
                  <div className="bg-primary h-24 p-4">
                    {/* Logo row */}
                    {(branding?.logo_url || branding?.client_logo_url) && (
                      <div className="flex items-center justify-between mb-2">
                        {branding?.logo_url ? (
                          <img 
                            src={branding.logo_url} 
                            alt="Company Logo" 
                            className="h-6 max-w-[80px] object-contain bg-white/10 rounded px-1"
                          />
                        ) : <div />}
                        {branding?.client_logo_url ? (
                          <img 
                            src={branding.client_logo_url} 
                            alt="Client Logo" 
                            className="h-6 max-w-[80px] object-contain bg-white/10 rounded px-1"
                          />
                        ) : <div />}
                      </div>
                    )}
                    <h2 className={`text-xl font-bold text-primary-foreground ${(branding?.logo_url || branding?.client_logo_url) ? '' : 'mt-2'}`}>
                      {projectName}
                    </h2>
                    <p className="text-sm text-primary-foreground/80">Solar Energy Proposal</p>
                    {branding?.company_name && (
                      <p className="text-[10px] text-primary-foreground/60 mt-1">Prepared by {branding.company_name}</p>
                    )}
                  </div>
                  
                  <div className="p-6 space-y-6">
                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <Sun className="h-8 w-8 mx-auto text-primary mb-2" />
                        <p className="text-xl font-bold">{simulationData.solarCapacityKwp}</p>
                        <p className="text-xs text-muted-foreground">kWp Solar</p>
                      </div>
                      <div>
                        <Battery className="h-8 w-8 mx-auto text-primary mb-2" />
                        <p className="text-xl font-bold">{simulationData.batteryCapacityKwh}</p>
                        <p className="text-xs text-muted-foreground">kWh Battery</p>
                      </div>
                      <div>
                        <DollarSign className="h-8 w-8 mx-auto text-primary mb-2" />
                        <p className="text-xl font-bold">R{Math.round((simulationData.annualSavings || 0) / 1000)}k</p>
                        <p className="text-xs text-muted-foreground">Annual Savings</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Contents */}
                    <div>
                      <p className="text-sm font-medium mb-3">Table of Contents</p>
                      <div className="space-y-2">
                        {enabledSegments.map((seg, i) => (
                          <div 
                            key={seg.id} 
                            className="flex items-center justify-between text-xs border-b border-dotted border-muted pb-1 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => goToPage(i + 1)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground w-4">{i + 1}.</span>
                              <seg.icon className="h-3 w-3 text-primary" />
                              <span>{seg.label}</span>
                            </div>
                            <span className="text-muted-foreground">Page {i + 2}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 border-t bg-muted/30 text-center">
                    <p className="text-[10px] text-muted-foreground">
                      Generated {new Date().toLocaleDateString()} • Page 1 of {totalPages}
                      {branding?.company_name && ` • ${branding.company_name}`}
                    </p>
                  </div>
                  
                  {/* Page break indicator bottom */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                </div>
              )}

              {/* Content Pages */}
              {currentPage > 0 && currentPage <= enabledSegments.length && (() => {
                const segment = enabledSegments[currentPage - 1];
                if (!segment) return null;
                const Icon = segment.icon;
                
                return (
                  <div className="aspect-[8.5/11] bg-background rounded-lg shadow-lg overflow-hidden flex flex-col relative">
                    {/* Page break indicator top */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                    
                    {/* Page header */}
                    <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{segment.label}</h3>
                      <Badge variant="secondary" className="ml-auto text-[10px]">
                        Section {currentPage} of {enabledSegments.length}
                      </Badge>
                    </div>

                    {/* Page content */}
                    <div className="flex-1 p-4 overflow-auto">
                      <SegmentPreviewContent 
                        segmentId={segment.id} 
                        simulationData={simulationData}
                        projectDetails={projectDetails}
                        projectName={projectName}
                        aiNarratives={aiNarratives}
                        aiNarrativeEnabled={aiNarrativeEnabled}
                        editedNarratives={editedNarratives}
                        onEditNarrative={(id, val) => setEditedNarratives(prev => ({ ...prev, [id]: val }))}
                      />
                    </div>

                    {/* Page footer */}
                    <div className="px-4 py-3 border-t bg-muted/30 text-center">
                      <p className="text-[10px] text-muted-foreground">
                        {projectName} • Page {currentPage + 1} of {totalPages}
                      </p>
                    </div>
                    
                    {/* Page break indicator bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                  </div>
                );
              })()}

              {/* Empty state */}
              {enabledSegments.length === 0 && (
                <div className="aspect-[8.5/11] bg-muted/20 rounded-lg border-2 border-dashed flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No sections selected</p>
                    <p className="text-xs mt-1">Select sections to preview your report</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable AI Narrative Block for preview with EDIT capability
function AIPreviewNarrative({ 
  title, 
  narrative,
  editedNarrative,
  onEdit,
  segmentId,
  children 
}: { 
  title: string; 
  narrative?: string;
  editedNarrative?: string;
  onEdit?: (segmentId: SegmentType, value: string) => void;
  segmentId?: SegmentType;
  children?: React.ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const displayText = editedNarrative !== undefined ? editedNarrative : narrative;
  
  if (!narrative && !editedNarrative) return null;
  
  return (
    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg p-2 space-y-1 border border-emerald-200/50 dark:border-emerald-800/50 mb-2">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-[9px] text-emerald-700 dark:text-emerald-400">{title}</p>
        <div className="flex items-center gap-1">
          {onEdit && segmentId && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-4 px-1 text-[6px]"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? "Done" : "Edit"}
            </Button>
          )}
          <Badge variant="secondary" className="text-[6px] h-4 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
            <Wand2 className="h-2 w-2 mr-0.5" />
            {editedNarrative !== undefined && editedNarrative !== narrative ? "Edited" : "AI"}
          </Badge>
        </div>
      </div>
      {isEditing && onEdit && segmentId ? (
        <Textarea
          value={displayText || ""}
          onChange={(e) => onEdit(segmentId, e.target.value)}
          className="text-[7px] min-h-[60px] bg-background/50 border-emerald-200 dark:border-emerald-800"
          placeholder="Edit the AI-generated narrative..."
        />
      ) : (
        <p className="text-[7px] text-muted-foreground leading-relaxed line-clamp-5">
          {displayText}
        </p>
      )}
      {children}
    </div>
  );
}

// Preview content for each segment type - matches PDF infographics
function SegmentPreviewContent({ 
  segmentId, 
  simulationData,
  projectDetails,
  projectName,
  aiNarratives,
  aiNarrativeEnabled,
  editedNarratives,
  onEditNarrative
}: { 
  segmentId: SegmentType; 
  simulationData: any;
  projectDetails?: any;
  projectName?: string;
  aiNarratives?: AIProposalNarrative;
  aiNarrativeEnabled?: boolean;
  editedNarratives?: Partial<Record<SegmentType, string>>;
  onEditNarrative?: (segmentId: SegmentType, value: string) => void;
}) {
  // Get AI narrative for this segment if available
  const aiNarrative = aiNarrativeEnabled ? aiNarratives?.[segmentId]?.narrative : undefined;
  const editedNarrative = editedNarratives?.[segmentId];
  
  switch (segmentId) {
    case "executive_summary":
      const roiPct = Math.min(100, simulationData.roiPercent || 0);
      const paybackPctExec = Math.min(100, ((simulationData.paybackYears || 5) / 25) * 100);
      const tariffInfo = projectDetails?.tariffs;
      const municipalityName = tariffInfo?.municipalities?.name;
      const tariffName = tariffInfo?.name;
      const buildingArea = projectDetails?.total_area_sqm;
      const connectionSize = projectDetails?.connection_size_kva;
      const location = projectDetails?.location;
      
      // Check for AI narrative (use edited version if exists)
      const originalAiSummary = aiNarrativeEnabled && aiNarratives?.executive_summary?.narrative;
      const hasAiSummary = originalAiSummary || editedNarratives?.executive_summary;
      
      return (
        <div className="space-y-2 text-xs">
          {/* Project Overview - AI or Static */}
          {hasAiSummary ? (
            <AIPreviewNarrative 
              title="Executive Summary" 
              narrative={originalAiSummary || undefined}
              editedNarrative={editedNarratives?.executive_summary}
              onEdit={onEditNarrative}
              segmentId="executive_summary"
            />
          ) : (
            <div className="bg-muted/30 rounded-lg p-2 space-y-1">
              <p className="font-semibold text-[9px] text-foreground">Project Overview</p>
              <p className="text-[8px] text-muted-foreground leading-relaxed">
                This proposal outlines a solar PV installation for <span className="font-medium text-foreground">{projectName || "the project"}</span>
                {location && <>, located in <span className="font-medium text-foreground">{location}</span></>}
                {buildingArea && <>, covering <span className="font-medium text-foreground">{buildingArea.toLocaleString()} m²</span> of building area</>}.
              </p>
              <p className="text-[8px] text-muted-foreground leading-relaxed">
                The system has been sized at <span className="font-medium text-foreground">{simulationData.solarCapacityKwp} kWp</span>
                {connectionSize && <> against a <span className="font-medium text-foreground">{connectionSize} kVA</span> grid connection</>}
                {tariffName && (
                  <>, applying the <span className="font-medium text-foreground">{tariffName}</span> tariff
                  {municipalityName && <> ({municipalityName})</>}
                  </>
                )}.
              </p>
            </div>
          )}

          {/* Metric cards */}
          <div className="grid grid-cols-3 gap-1">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded p-1.5 text-center">
              <p className="text-sm font-bold text-emerald-600">{simulationData.solarCapacityKwp}</p>
              <p className="text-[7px] text-muted-foreground">kWp Solar</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded p-1.5 text-center">
              <p className="text-sm font-bold text-blue-600">{simulationData.batteryCapacityKwh}</p>
              <p className="text-[7px] text-muted-foreground">kWh Battery</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-1.5 text-center">
              <p className="text-xs font-bold text-amber-700">R{Math.round((simulationData.annualSavings || 0) / 1000)}k</p>
              <p className="text-[7px] text-muted-foreground">Annual Savings</p>
            </div>
          </div>
          
          {/* ROI Gauge */}
          <div className="flex items-center gap-2">
            <div className="relative w-12 h-6">
              <svg viewBox="0 0 100 50" className="w-full h-full">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={`${roiPct * 1.26} 126`} className="text-primary" />
              </svg>
              <div className="absolute inset-0 flex items-end justify-center pb-0.5">
                <span className="text-[8px] font-bold text-primary">{Math.round(roiPct)}%</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[8px] font-medium">ROI • Payback: {(simulationData.paybackYears || 0).toFixed(1)} yrs</p>
              <div className="h-1 bg-muted rounded-full overflow-hidden mt-0.5">
                <div className="h-full bg-primary rounded-full" style={{ width: `${paybackPctExec}%` }} />
              </div>
            </div>
          </div>
        </div>
      );

    case "tariff_details":
      return (
        <div className="space-y-2 text-[9px]">
          <AIPreviewNarrative title="Tariff Analysis" narrative={aiNarrative} editedNarrative={editedNarrative} onEdit={onEditNarrative} segmentId={segmentId} />
          {/* TOU Clock Diagram */}
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* Clock segments for 24 hours */}
                {Array.from({ length: 24 }, (_, hour) => {
                  const startAngle = ((hour - 6) * 15 - 90) * Math.PI / 180;
                  const endAngle = ((hour - 5) * 15 - 90) * Math.PI / 180;
                  const innerRadius = 25;
                  const outerRadius = 45;
                  
                  const x1 = 50 + innerRadius * Math.cos(startAngle);
                  const y1 = 50 + innerRadius * Math.sin(startAngle);
                  const x2 = 50 + outerRadius * Math.cos(startAngle);
                  const y2 = 50 + outerRadius * Math.sin(startAngle);
                  const x3 = 50 + outerRadius * Math.cos(endAngle);
                  const y3 = 50 + outerRadius * Math.sin(endAngle);
                  const x4 = 50 + innerRadius * Math.cos(endAngle);
                  const y4 = 50 + innerRadius * Math.sin(endAngle);
                  
                  let color = "#22c55e"; // Off-peak green
                  if ((hour >= 6 && hour < 8) || (hour >= 18 && hour < 21)) {
                    color = "#ef4444"; // Peak red
                  } else if ((hour >= 8 && hour < 18) || (hour >= 21 && hour < 22)) {
                    color = "#f59e0b"; // Standard amber
                  }
                  
                  return (
                    <path
                      key={hour}
                      d={`M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`}
                      fill={color}
                      stroke="white"
                      strokeWidth="0.5"
                    />
                  );
                })}
                {/* Center circle */}
                <circle cx="50" cy="50" r="20" fill="white" className="dark:fill-background" />
                <text x="50" y="53" textAnchor="middle" className="text-[8px] fill-current font-medium">TOU</text>
              </svg>
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-destructive" />
                <span className="text-[8px]">Peak (06-08, 18-21)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[8px]">Standard (08-18, 21-22)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[8px]">Off-Peak (22-06)</span>
              </div>
            </div>
          </div>
          
          {/* Seasonal Calendar */}
          <div>
            <p className="font-medium text-[9px] mb-1">Seasonal Calendar</p>
            <div className="grid grid-cols-12 gap-0.5">
              {["J","F","M","A","M","J","J","A","S","O","N","D"].map((m, i) => (
                <div 
                  key={m + i}
                  className={`text-center rounded py-1 text-[7px] font-medium text-white ${
                    i >= 5 && i <= 7 
                      ? "bg-destructive" 
                      : "bg-emerald-500"
                  }`}
                >
                  {m}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-1 text-[7px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded bg-destructive" />
                <span>High Demand</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded bg-emerald-500" />
                <span>Low Demand</span>
              </div>
            </div>
          </div>
        </div>
      );

    case "dcac_comparison":
      const ratio = simulationData.dcAcRatio || 1.3;
      const ratioPosition = Math.min(100, Math.max(0, ((ratio - 1) / 0.6) * 100));
      
      // Calculate energy gains for different ratios
      const baseRatio = 1.0;
      const currentRatio = ratio;
      const aggressiveRatio = 1.5;
      
      // Energy capture factor (higher ratio = more energy in morning/evening)
      const calcEnergyGain = (r: number) => Math.round((1 + (r - 1) * 0.6) * 100);
      const baseEnergy = calcEnergyGain(baseRatio);
      const currentEnergy = calcEnergyGain(currentRatio);
      const aggressiveEnergy = calcEnergyGain(aggressiveRatio);
      
      return (
        <div className="space-y-2">
          <AIPreviewNarrative title="DC/AC Analysis" narrative={aiNarrative} editedNarrative={editedNarrative} onEdit={onEditNarrative} segmentId={segmentId} />
          
          {/* Comparison header */}
          <div className="flex items-center justify-between text-[9px] mb-1">
            <span className="font-medium">DC/AC Ratio Impact</span>
            <span className="font-bold text-primary">{ratio.toFixed(2)}:1</span>
          </div>
          
          {/* Side-by-side comparison curves */}
          <div className="grid grid-cols-3 gap-1">
            {[
              { label: "1.0:1", value: baseRatio, energy: baseEnergy, color: "text-muted-foreground", bgColor: "bg-muted/50" },
              { label: `${currentRatio.toFixed(2)}:1`, value: currentRatio, energy: currentEnergy, color: "text-primary", bgColor: "bg-primary/10", isCurrent: true },
              { label: "1.5:1", value: aggressiveRatio, energy: aggressiveEnergy, color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950/30" },
            ].map((config, idx) => (
              <div key={idx} className={`rounded p-1.5 ${config.bgColor} ${config.isCurrent ? "ring-1 ring-primary" : ""}`}>
                <p className={`text-[8px] font-bold text-center ${config.color}`}>{config.label}</p>
                {/* Mini energy curve */}
                <div className="relative h-8 mt-1">
                  {/* Inverter limit */}
                  <div className="absolute left-0 right-0 top-[35%] h-px bg-destructive/50" />
                  <svg viewBox="0 0 40 24" className="w-full h-full" preserveAspectRatio="none">
                    {/* Clipped area fill */}
                    <defs>
                      <clipPath id={`clip-${idx}`}>
                        <rect x="0" y="0" width="40" height="8.5" />
                      </clipPath>
                    </defs>
                    {/* Full curve area */}
                    <path
                      d={`M 0 24 Q 10 ${24 - config.value * 18} 20 ${24 - config.value * 20} Q 30 ${24 - config.value * 18} 40 24 Z`}
                      fill="currentColor"
                      className={`${config.color} opacity-20`}
                    />
                    {/* Clipped (lost) energy */}
                    {config.value > 1.0 && (
                      <path
                        d={`M 0 24 Q 10 ${24 - config.value * 18} 20 ${24 - config.value * 20} Q 30 ${24 - config.value * 18} 40 24 Z`}
                        fill="currentColor"
                        className="text-destructive opacity-30"
                        clipPath={`url(#clip-${idx})`}
                      />
                    )}
                    {/* Curve line */}
                    <path
                      d={`M 0 24 Q 10 ${24 - config.value * 18} 20 ${24 - config.value * 20} Q 30 ${24 - config.value * 18} 40 24`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className={config.color}
                    />
                  </svg>
                </div>
                <p className="text-[7px] text-center mt-0.5">
                  <span className="font-semibold">{config.energy}%</span>
                  <span className="text-muted-foreground"> yield</span>
                </p>
              </div>
            ))}
          </div>
          
          {/* Gain indicator */}
          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-600" />
              <span className="text-[8px] font-medium text-emerald-700 dark:text-emerald-400">Energy Gain vs 1:1</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-600">+{currentEnergy - baseEnergy}%</span>
          </div>
          
          {/* Legend */}
          <div className="flex gap-2 text-[6px] text-muted-foreground justify-center">
            <div className="flex items-center gap-0.5">
              <div className="w-4 h-0.5 bg-destructive/50" />
              <span>Inverter limit</span>
            </div>
            <div className="flex items-center gap-0.5">
              <div className="w-2 h-2 bg-destructive/30 rounded-sm" />
              <span>Clipped energy</span>
            </div>
          </div>
        </div>
      );

    case "payback_timeline":
      const payback = simulationData.paybackYears || 5;
      const annualSave = simulationData.annualSavings || 250000;
      const systemCost = (simulationData.solarCapacityKwp || 100) * 12000;
      const total25yr = annualSave * 25 - systemCost;
      
      return (
        <div className="space-y-2">
          <AIPreviewNarrative title="Financial Payback" narrative={aiNarrative} editedNarrative={editedNarrative} onEdit={onEditNarrative} segmentId={segmentId} />
          {/* Cash flow chart */}
          <div className="relative h-14 bg-muted/30 rounded overflow-hidden">
            {/* Zero line */}
            <div className="absolute left-0 right-0 top-[40%] h-px bg-muted-foreground/30" />
            {/* Negative area */}
            <div 
              className="absolute left-0 bottom-[60%] h-[20%] bg-red-200 dark:bg-red-900/30"
              style={{ width: `${(payback / 10) * 100}%` }}
            />
            {/* Positive area */}
            <div 
              className="absolute right-0 top-[40%] h-[30%] bg-emerald-200 dark:bg-emerald-900/30"
              style={{ width: `${((10 - payback) / 10) * 100}%` }}
            />
            {/* Line chart */}
            <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="none">
              <polyline
                points={Array.from({ length: 11 }, (_, yr) => {
                  const cumulative = annualSave * yr - systemCost;
                  const x = yr * 10;
                  const y = 20 - (cumulative / (annualSave * 10)) * 30;
                  return `${x},${y}`;
                }).join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-primary"
              />
            </svg>
            {/* Break-even marker */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-primary"
              style={{ left: `${(payback / 10) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[7px] text-muted-foreground">
            <span>Year 0</span>
            <span className="font-medium text-primary">Break-even: Y{payback.toFixed(1)}</span>
            <span>Year 10</span>
          </div>
          
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-1 text-center">
            <div className="bg-red-50 dark:bg-red-950/30 rounded p-1.5">
              <p className="text-[10px] font-bold text-red-600">-R{(systemCost / 1000).toFixed(0)}k</p>
              <p className="text-[7px] text-muted-foreground">Investment</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded p-1.5">
              <p className="text-[10px] font-bold text-amber-600">{payback.toFixed(1)} yrs</p>
              <p className="text-[7px] text-muted-foreground">Payback</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-1.5">
              <p className="text-[10px] font-bold text-emerald-600">+R{(total25yr / 1000000).toFixed(1)}M</p>
              <p className="text-[7px] text-muted-foreground">25yr Returns</p>
            </div>
          </div>
        </div>
      );

    case "sensitivity_analysis":
      const baseSysCostPreview = (simulationData.solarCapacityKwp || 100) * 12000;
      const baseAnnualSavingsPreview = simulationData.annualSavings || 250000;
      const basePaybackPreview = simulationData.paybackYears || 5;
      
      // Calculate payback for different escalation rates
      const escRatesPreview = [0, 10, 20];
      const escPaybacksPreview = escRatesPreview.map(rate => {
        if (rate === 0) return basePaybackPreview;
        let cumSavings = 0;
        let year = 0;
        let annualSave = baseAnnualSavingsPreview;
        while (cumSavings < baseSysCostPreview && year < 25) {
          year++;
          cumSavings += annualSave;
          annualSave *= (1 + rate / 100);
        }
        return year + (baseSysCostPreview - (cumSavings - annualSave)) / annualSave;
      });
      
      // Calculate payback for cost variations
      const costVarsPreview = [-20, 0, 20];
      const costPaybacksPreview = costVarsPreview.map(pct => 
        (baseSysCostPreview * (1 + pct / 100)) / baseAnnualSavingsPreview
      );
      
      return (
        <div className="space-y-2">
          <AIPreviewNarrative title="Sensitivity Analysis" narrative={aiNarrative} editedNarrative={editedNarrative} onEdit={onEditNarrative} segmentId={segmentId} />
          <p className="text-[8px] text-muted-foreground">How payback changes with different scenarios</p>
          
          {/* Tariff Escalation */}
          <div>
            <p className="text-[9px] font-medium mb-1">Tariff Escalation</p>
            <div className="flex items-end gap-1 h-8">
              {escRatesPreview.map((rate, i) => {
                const maxPb = Math.max(...escPaybacksPreview);
                const height = (escPaybacksPreview[i] / maxPb) * 100;
                return (
                  <div key={rate} className="flex-1 flex flex-col items-center">
                    <span className="text-[7px] font-medium">{escPaybacksPreview[i].toFixed(1)}y</span>
                    <div 
                      className="w-full rounded-t bg-gradient-to-t from-emerald-500 to-emerald-400"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[6px] text-muted-foreground">{rate}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* System Cost */}
          <div>
            <p className="text-[9px] font-medium mb-1">System Cost</p>
            <div className="flex items-end gap-1 h-8">
              {costVarsPreview.map((pct, i) => {
                const maxPb = Math.max(...costPaybacksPreview);
                const height = (costPaybacksPreview[i] / maxPb) * 100;
                const label = pct === 0 ? "Base" : `${pct > 0 ? "+" : ""}${pct}%`;
                return (
                  <div key={pct} className="flex-1 flex flex-col items-center">
                    <span className="text-[7px] font-medium">{costPaybacksPreview[i].toFixed(1)}y</span>
                    <div 
                      className={`w-full rounded-t ${pct === 0 ? "bg-primary" : "bg-muted-foreground/50"}`}
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[6px] text-muted-foreground">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Key insight */}
          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-1.5 text-center">
            <p className="text-[7px] text-muted-foreground">Higher tariff escalation = shorter payback</p>
          </div>
        </div>
      );

    case "environmental_impact":
      const co2 = simulationData.co2AvoidedTons || 120;
      const treesEquiv = Math.round(co2 * 45);
      const lifetime20 = co2 * 20;
      
      return (
        <div className="space-y-3">
          <AIPreviewNarrative title="Environmental Impact" narrative={aiNarrative} editedNarrative={editedNarrative} onEdit={onEditNarrative} segmentId={segmentId} />
          {/* Main metrics with visual elements */}
          <div className="flex justify-around items-center">
            {/* CO2 donut */}
            <div className="text-center">
              <div className="relative w-14 h-14 mx-auto">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="12" className="text-muted" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="12" strokeDasharray="251" strokeDashoffset="63" className="text-emerald-500" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Leaf className="h-5 w-5 text-emerald-500" />
                </div>
              </div>
              <p className="text-sm font-bold text-emerald-600 mt-1">{Math.round(co2)}</p>
              <p className="text-[8px] text-muted-foreground">tonnes CO₂/yr</p>
            </div>
            
            {/* Trees */}
            <div className="text-center">
              <div className="grid grid-cols-3 gap-0.5 mb-1">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span key={i} className="text-[10px]">🌳</span>
                ))}
              </div>
              <p className="text-sm font-bold text-emerald-600">{treesEquiv.toLocaleString()}</p>
              <p className="text-[8px] text-muted-foreground">trees equiv.</p>
            </div>
          </div>
          
          {/* 20-year impact bar */}
          <div className="bg-emerald-100 dark:bg-emerald-950/40 rounded-lg p-2 text-center">
            <p className="text-[8px] text-muted-foreground">20-Year Lifetime Impact</p>
            <p className="text-sm font-bold text-emerald-600">{lifetime20.toLocaleString()} tonnes CO₂</p>
          </div>
        </div>
      );

    case "energy_flow":
      const annualGenFlow = (simulationData.solarCapacityKwp || 100) * 1600;
      const selfConsumeFlow = annualGenFlow * 0.65;
      const gridExportFlow = annualGenFlow * 0.35;
      
      return (
        <div className="space-y-2">
          <AIPreviewNarrative title="Energy Flow" narrative={aiNarrative} editedNarrative={editedNarrative} onEdit={onEditNarrative} segmentId={segmentId} />
          <p className="text-[9px] font-medium">System Energy Distribution</p>
          
          {/* Simplified flow diagram */}
          <div className="relative bg-muted/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              {/* Solar */}
              <div className="bg-amber-100 dark:bg-amber-950/40 rounded px-2 py-1 text-center">
                <Sun className="h-4 w-4 mx-auto text-amber-600 mb-0.5" />
                <p className="text-[8px] font-bold">{Math.round(annualGenFlow / 1000)} MWh</p>
                <p className="text-[6px] text-muted-foreground">Solar</p>
              </div>
              
              {/* Arrows */}
              <div className="flex-1 mx-2 space-y-1">
                <div className="flex items-center">
                  <div className="h-0.5 flex-1 bg-emerald-500" />
                  <span className="text-[6px] mx-1 text-emerald-600">{Math.round(selfConsumeFlow / annualGenFlow * 100)}%</span>
                </div>
                <div className="flex items-center">
                  <div className="h-0.5 flex-1 bg-amber-500" />
                  <span className="text-[6px] mx-1 text-amber-600">{Math.round(gridExportFlow / annualGenFlow * 100)}%</span>
                </div>
              </div>
              
              {/* Building */}
              <div className="bg-blue-100 dark:bg-blue-950/40 rounded px-2 py-1 text-center">
                <Zap className="h-4 w-4 mx-auto text-blue-600 mb-0.5" />
                <p className="text-[8px] font-bold">Load</p>
                <p className="text-[6px] text-muted-foreground">Building</p>
              </div>
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex gap-2 text-[7px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-1 bg-emerald-500 rounded" />
              <span>Self-use</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-1 bg-amber-500 rounded" />
              <span>Export</span>
            </div>
          </div>
        </div>
      );

    case "monthly_yield":
      const monthlyFactorsPreview = [1.1, 1.05, 0.95, 0.85, 0.75, 0.7, 0.72, 0.8, 0.9, 1.0, 1.05, 1.1];
      const annualKwhPreview = (simulationData.solarCapacityKwp || 100) * 1600;
      const avgMonthlyPreview = annualKwhPreview / 12;
      const monthlyGenPreview = monthlyFactorsPreview.map(f => avgMonthlyPreview * f);
      const maxMonthlyPreview = Math.max(...monthlyGenPreview);
      
      return (
        <div className="space-y-2">
          <AIPreviewNarrative title="Monthly Yield" narrative={aiNarrative} editedNarrative={editedNarrative} onEdit={onEditNarrative} segmentId={segmentId} />
          <p className="text-[9px] font-medium">12-Month Solar Generation</p>
          
          {/* Mini bar chart */}
          <div className="flex items-end gap-0.5 h-12 bg-muted/20 rounded p-1">
            {monthlyGenPreview.map((gen, i) => {
              const height = (gen / maxMonthlyPreview) * 100;
              const isSummer = i >= 9 || i <= 2;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-t ${isSummer ? "bg-emerald-500" : "bg-emerald-400"}`}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
          
          {/* Month labels */}
          <div className="flex justify-between text-[6px] text-muted-foreground">
            <span>Jan</span>
            <span>Jul</span>
            <span>Dec</span>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-2 gap-1">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-1 text-center">
              <p className="text-[10px] font-bold text-emerald-600">{Math.round(annualKwhPreview / 1000)} MWh</p>
              <p className="text-[6px] text-muted-foreground">Annual yield</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded p-1 text-center">
              <p className="text-[10px] font-bold text-amber-600">1,600</p>
              <p className="text-[6px] text-muted-foreground">kWh/kWp/yr</p>
            </div>
          </div>
        </div>
      );

    case "engineering_specs":
      const inverterSize = Math.round((simulationData.solarCapacityKwp || 100) / (simulationData.dcAcRatio || 1.3));
      return (
        <div className="space-y-2">
          <AIPreviewNarrative title="Engineering Specs" narrative={aiNarrative} editedNarrative={editedNarrative} onEdit={onEditNarrative} segmentId={segmentId} />
          {/* System diagram */}
          <div className="flex items-center justify-center gap-2 py-2">
            <div className="bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded px-2 py-1 text-center">
              <Sun className="h-3 w-3 mx-auto text-amber-600 mb-0.5" />
              <p className="text-[8px] font-bold">{simulationData.solarCapacityKwp}kWp</p>
              <p className="text-[6px] text-muted-foreground">PV Array</p>
            </div>
            <div className="text-muted-foreground">→</div>
            <div className="bg-blue-100 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-700 rounded px-2 py-1 text-center">
              <Zap className="h-3 w-3 mx-auto text-blue-600 mb-0.5" />
              <p className="text-[8px] font-bold">{inverterSize}kW</p>
              <p className="text-[6px] text-muted-foreground">Inverter</p>
            </div>
            {simulationData.batteryCapacityKwh > 0 && (
              <>
                <div className="text-muted-foreground">→</div>
                <div className="bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded px-2 py-1 text-center">
                  <Battery className="h-3 w-3 mx-auto text-emerald-600 mb-0.5" />
                  <p className="text-[8px] font-bold">{simulationData.batteryCapacityKwh}kWh</p>
                  <p className="text-[6px] text-muted-foreground">Battery</p>
                </div>
              </>
            )}
          </div>
          
          {/* Specs list */}
          <div className="space-y-0.5 text-[8px]">
            <SpecRow label="DC/AC Ratio" value={`${(simulationData.dcAcRatio || 1.3).toFixed(2)}:1`} />
            <SpecRow label="Performance Ratio" value="80-82%" />
            <SpecRow label="Specific Yield" value="~1,600 kWh/kWp/yr" />
          </div>
        </div>
      );

    case "sizing_comparison":
      const currentKwpPreview = simulationData.solarCapacityKwp || 100;
      const currentBatteryPreview = simulationData.batteryCapacityKwh || 50;
      const currentSavingsPreview = simulationData.annualSavings || 250000;
      const costPerKwpPreview = 12000;
      const batteryPerKwhPreview = 6000;

      const scenariosPreview = [
        { name: "Conservative", factor: 0.7, batteryFactor: 0.5 },
        { name: "Current", factor: 1.0, batteryFactor: 1.0, isCurrent: true },
        { name: "Aggressive", factor: 1.35, batteryFactor: 2.0 },
      ];

      const scenarioDataPreview = scenariosPreview.map((s) => {
        const solarKwp = Math.round(currentKwpPreview * s.factor);
        const batteryKwh = Math.round(currentBatteryPreview * s.batteryFactor);
        const systemCost = solarKwp * costPerKwpPreview + batteryKwh * batteryPerKwhPreview;
        const annualSavings = Math.round(currentSavingsPreview * (s.factor * 0.9 + 0.1));
        const paybackYears = systemCost / annualSavings;
        return { ...s, solarKwp, batteryKwh, systemCost, annualSavings, paybackYears };
      });

      return (
        <div className="space-y-2">
          <AIPreviewNarrative title="Sizing Alternatives" narrative={aiNarrative} editedNarrative={editedNarrative} onEdit={onEditNarrative} segmentId={segmentId} />
          <p className="text-[9px] font-medium">System Sizing Comparison</p>
          
          {/* Scenario comparison cards */}
          <div className="grid grid-cols-3 gap-1">
            {scenarioDataPreview.map((scenario) => (
              <div 
                key={scenario.name}
                className={`rounded p-1.5 text-center ${
                  scenario.isCurrent 
                    ? "bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700" 
                    : "bg-muted/50"
                }`}
              >
                <p className={`text-[8px] font-medium ${scenario.isCurrent ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {scenario.name}
                </p>
                <p className={`text-[11px] font-bold ${scenario.isCurrent ? "text-emerald-600" : ""}`}>
                  {scenario.solarKwp}kWp
                </p>
                <p className="text-[7px] text-muted-foreground">
                  {scenario.paybackYears.toFixed(1)}yr payback
                </p>
              </div>
            ))}
          </div>
          
          {/* Quick comparison table */}
          <div className="space-y-0.5 text-[7px]">
            <div className="flex justify-between py-0.5 border-b border-dashed">
              <span className="text-muted-foreground">Investment</span>
              <div className="flex gap-2">
                {scenarioDataPreview.map((s) => (
                  <span key={s.name} className={`w-12 text-right ${s.isCurrent ? "font-bold text-emerald-600" : ""}`}>
                    R{Math.round(s.systemCost / 1000)}k
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-between py-0.5 border-b border-dashed">
              <span className="text-muted-foreground">Annual Savings</span>
              <div className="flex gap-2">
                {scenarioDataPreview.map((s) => (
                  <span key={s.name} className={`w-12 text-right ${s.isCurrent ? "font-bold text-emerald-600" : ""}`}>
                    R{Math.round(s.annualSavings / 1000)}k
                  </span>
                ))}
              </div>
            </div>
          </div>
          
          {/* Key insight */}
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-1.5 text-center">
            <p className="text-[7px] text-muted-foreground">Current design balances cost and returns</p>
          </div>
        </div>
      );

    default:
      return (
        <div className="text-center text-muted-foreground py-4">
          <FileText className="h-8 w-8 mx-auto mb-1 opacity-30" />
          <p className="text-[10px]">Content preview</p>
        </div>
      );
  }
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded p-2 text-center">
      <p className="font-bold text-[11px]">{value}</p>
      <p className="text-[8px] text-muted-foreground">{label}</p>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 border-b border-dashed last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
