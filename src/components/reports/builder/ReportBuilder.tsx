import React, { useState, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  GripVertical
} from "lucide-react";
import { ReportData, ReportSegment, SegmentType } from "../types";
import { Separator } from "@/components/ui/separator";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  { id: "energy_flow", label: "Energy Flow", description: "System energy distribution", icon: Sparkles },
  { id: "monthly_yield", label: "Monthly Yield", description: "12-month generation forecast", icon: BarChart3 },
  { id: "payback_timeline", label: "Payback Timeline", description: "Financial ROI projection", icon: DollarSign },
  { id: "environmental_impact", label: "Environmental Impact", description: "CO2 reduction metrics", icon: Leaf },
  { id: "engineering_specs", label: "Engineering Specs", description: "Technical specifications", icon: Settings2 },
];

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
  className?: string;
}

export function ReportBuilder({
  projectName = "Solar Project",
  projectId,
  simulationData: initialSimulationData,
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
  const totalPages = Math.ceil(enabledSegments.length / 2) + 1;

  // Generate PDF
  const handleGeneratePDF = async () => {
    if (enabledSegments.length === 0) {
      toast.error("Please select at least one segment");
      return;
    }

    setIsGenerating(true);
    
    try {
      const pdf = new jsPDF("portrait", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;

      // Cover Page
      pdf.setFillColor(34, 197, 94); // Primary green
      pdf.rect(0, 0, pageWidth, 60, "F");
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(28);
      pdf.text(projectName, margin, 35);
      
      pdf.setFontSize(14);
      pdf.text("Solar Energy Proposal", margin, 48);
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(12);
      
      // Key metrics on cover
      const metricsY = 80;
      pdf.setFontSize(24);
      pdf.setTextColor(34, 197, 94);
      pdf.text(`${simulationData.solarCapacityKwp} kWp`, margin, metricsY);
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Solar Capacity", margin, metricsY + 8);

      pdf.setFontSize(24);
      pdf.setTextColor(34, 197, 94);
      pdf.text(`${simulationData.batteryCapacityKwh} kWh`, margin + 60, metricsY);
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Battery Storage", margin + 60, metricsY + 8);

      pdf.setFontSize(24);
      pdf.setTextColor(34, 197, 94);
      pdf.text(`R${Math.round(simulationData.annualSavings || 0).toLocaleString()}`, margin + 120, metricsY);
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Annual Savings", margin + 120, metricsY + 8);

      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, pageHeight - 20);
      pdf.text(`Page 1 of ${totalPages}`, pageWidth - margin - 20, pageHeight - 20);

      // Content pages
      let pageNum = 2;
      for (const segment of enabledSegments) {
        pdf.addPage();
        
        // Header
        pdf.setFillColor(245, 245, 245);
        pdf.rect(0, 0, pageWidth, 25, "F");
        pdf.setFontSize(16);
        pdf.setTextColor(0, 0, 0);
        pdf.text(segment.label, margin, 17);
        
        let yPos = 40;

        // Render content based on segment type
        switch (segment.id) {
          case "executive_summary":
            pdf.setFontSize(12);
            pdf.text("System Overview", margin, yPos);
            yPos += 10;
            
            autoTable(pdf, {
              startY: yPos,
              head: [["Metric", "Value"]],
              body: [
                ["Solar Capacity", `${simulationData.solarCapacityKwp} kWp`],
                ["Battery Storage", `${simulationData.batteryCapacityKwh} kWh`],
                ["DC/AC Ratio", `${(simulationData.dcAcRatio || 1.3).toFixed(2)}:1`],
                ["Annual Savings", `R${Math.round(simulationData.annualSavings || 0).toLocaleString()}`],
                ["Payback Period", `${(simulationData.paybackYears || 0).toFixed(1)} years`],
                ["ROI", `${Math.round(simulationData.roiPercent || 0)}%`],
              ],
              theme: "striped",
              headStyles: { fillColor: [34, 197, 94] },
              margin: { left: margin, right: margin },
            });
            break;

          case "tariff_details":
            pdf.setFontSize(12);
            pdf.text("TOU Period Definitions (FY2026)", margin, yPos);
            yPos += 10;
            
            autoTable(pdf, {
              startY: yPos,
              head: [["Period", "Weekday", "Saturday", "Sunday"]],
              body: [
                ["Peak", "06:00-08:00, 18:00-21:00", "07:00-12:00, 18:00-20:00", "—"],
                ["Standard", "08:00-18:00, 21:00-22:00", "12:00-18:00, 20:00-22:00", "—"],
                ["Off-Peak", "22:00-06:00", "22:00-07:00", "All Day"],
              ],
              theme: "striped",
              headStyles: { fillColor: [34, 197, 94] },
              margin: { left: margin, right: margin },
            });
            
            yPos = (pdf as any).lastAutoTable.finalY + 15;
            pdf.text("Seasonal Calendar", margin, yPos);
            yPos += 8;
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            pdf.text("High Demand (Winter): June - August", margin, yPos);
            yPos += 6;
            pdf.text("Low Demand (Summer): September - May", margin, yPos);
            break;

          case "dcac_comparison":
            pdf.setFontSize(12);
            pdf.text(`DC/AC Ratio: ${(simulationData.dcAcRatio || 1.3).toFixed(2)}:1`, margin, yPos);
            yPos += 10;
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            pdf.text("A higher DC/AC ratio (oversizing) captures more energy in morning", margin, yPos);
            yPos += 5;
            pdf.text("and afternoon hours, improving overall ROI despite minor clipping losses.", margin, yPos);
            
            yPos += 15;
            autoTable(pdf, {
              startY: yPos,
              head: [["Ratio Range", "Classification", "Clipping Risk", "ROI Impact"]],
              body: [
                ["1.0 - 1.1", "Conservative", "None", "Baseline"],
                ["1.1 - 1.3", "Optimal", "Minimal (<2%)", "Best ROI"],
                ["1.3 - 1.5", "Aggressive", "Moderate (2-5%)", "Higher yield"],
                [">1.5", "High", "Significant (>5%)", "Diminishing returns"],
              ],
              theme: "striped",
              headStyles: { fillColor: [34, 197, 94] },
              margin: { left: margin, right: margin },
            });
            break;

          case "payback_timeline":
            const payback = simulationData.paybackYears || 5;
            pdf.setFontSize(12);
            pdf.text(`Break-even: Year ${payback.toFixed(1)}`, margin, yPos);
            yPos += 15;
            
            autoTable(pdf, {
              startY: yPos,
              head: [["Year", "Cumulative Savings", "Net Position"]],
              body: Array.from({ length: 10 }, (_, i) => {
                const year = i + 1;
                const savings = (simulationData.annualSavings || 250000) * year;
                const cost = (simulationData.solarCapacityKwp || 100) * 12000;
                return [
                  `Year ${year}`,
                  `R${savings.toLocaleString()}`,
                  savings >= cost ? `+R${(savings - cost).toLocaleString()}` : `-R${(cost - savings).toLocaleString()}`
                ];
              }),
              theme: "striped",
              headStyles: { fillColor: [34, 197, 94] },
              margin: { left: margin, right: margin },
            });
            break;

          case "environmental_impact":
            const co2 = simulationData.co2AvoidedTons || 120;
            pdf.setFontSize(12);
            pdf.text("Environmental Benefits", margin, yPos);
            yPos += 10;
            
            autoTable(pdf, {
              startY: yPos,
              head: [["Metric", "Annual", "25-Year Lifetime"]],
              body: [
                ["CO₂ Avoided", `${Math.round(co2)} tonnes`, `${Math.round(co2 * 25).toLocaleString()} tonnes`],
                ["Trees Equivalent", `${Math.round(co2 * 45)}`, `${Math.round(co2 * 45 * 25).toLocaleString()}`],
                ["Cars Off Road", `${Math.round(co2 / 4)}`, `${Math.round(co2 / 4 * 25)}`],
              ],
              theme: "striped",
              headStyles: { fillColor: [34, 197, 94] },
              margin: { left: margin, right: margin },
            });
            break;

          case "engineering_specs":
            pdf.setFontSize(12);
            pdf.text("Technical Specifications", margin, yPos);
            yPos += 10;
            
            autoTable(pdf, {
              startY: yPos,
              head: [["Component", "Specification"]],
              body: [
                ["PV Array Size", `${simulationData.solarCapacityKwp} kWp`],
                ["DC/AC Ratio", `${(simulationData.dcAcRatio || 1.3).toFixed(2)}:1`],
                ["Inverter Size", `${Math.round((simulationData.solarCapacityKwp || 100) / (simulationData.dcAcRatio || 1.3))} kW`],
                ["Battery Capacity", `${simulationData.batteryCapacityKwh} kWh`],
                ["Battery Power", `${Math.round((simulationData.batteryCapacityKwh || 50) / 2)} kW`],
                ["Expected Performance Ratio", "80-82%"],
                ["Specific Yield", "~1,600 kWh/kWp/year"],
              ],
              theme: "striped",
              headStyles: { fillColor: [34, 197, 94] },
              margin: { left: margin, right: margin },
            });
            break;

          case "energy_flow":
          case "monthly_yield":
          default:
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            pdf.text(segment.description, margin, yPos);
            break;
        }

        // Footer
        pdf.setFontSize(10);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 20);
        pageNum++;
      }

      // Save PDF
      pdf.save(`${reportName.replace(/\s+/g, "_")}.pdf`);
      toast.success("PDF generated successfully!");
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

        {/* Right: WYSIWYG PDF Preview */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">PDF Preview</h3>
            <Badge variant="outline">{totalPages} pages</Badge>
          </div>
          
          <ScrollArea className="h-[600px] rounded-lg border bg-muted/20 p-4">
            <div className="space-y-4 max-w-md mx-auto">
              {/* Cover Page */}
              <div className="aspect-[8.5/11] bg-background rounded-lg shadow-md overflow-hidden">
                {/* Green header */}
                <div className="bg-primary h-20 p-4">
                  <h2 className="text-xl font-bold text-primary-foreground">{projectName}</h2>
                  <p className="text-sm text-primary-foreground/80">Solar Energy Proposal</p>
                </div>
                
                <div className="p-4 space-y-4">
                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <Sun className="h-6 w-6 mx-auto text-primary mb-1" />
                      <p className="text-lg font-bold">{simulationData.solarCapacityKwp}</p>
                      <p className="text-[10px] text-muted-foreground">kWp Solar</p>
                    </div>
                    <div>
                      <Battery className="h-6 w-6 mx-auto text-primary mb-1" />
                      <p className="text-lg font-bold">{simulationData.batteryCapacityKwh}</p>
                      <p className="text-[10px] text-muted-foreground">kWh Battery</p>
                    </div>
                    <div>
                      <DollarSign className="h-6 w-6 mx-auto text-primary mb-1" />
                      <p className="text-lg font-bold">R{Math.round((simulationData.annualSavings || 0) / 1000)}k</p>
                      <p className="text-[10px] text-muted-foreground">Annual Savings</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Contents */}
                  <div>
                    <p className="text-xs font-medium mb-2">Contents</p>
                    <div className="space-y-1">
                      {enabledSegments.map((seg, i) => (
                        <div key={seg.id} className="flex items-center gap-2 text-[10px]">
                          <span className="text-muted-foreground">{i + 1}.</span>
                          <span>{seg.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-2 text-center">
                  <p className="text-[9px] text-muted-foreground">
                    Generated {new Date().toLocaleDateString()} • Page 1 of {totalPages}
                  </p>
                </div>
              </div>

              {/* Content Pages */}
              {enabledSegments.map((segment, index) => {
                const Icon = segment.icon;
                
                return (
                  <div
                    key={segment.id}
                    className="aspect-[8.5/11] bg-background rounded-lg shadow-md overflow-hidden flex flex-col"
                  >
                    {/* Page header */}
                    <div className="bg-muted/50 px-4 py-2 border-b flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">{segment.label}</h3>
                    </div>

                    {/* Page content */}
                    <div className="flex-1 p-4">
                      <SegmentPreviewContent 
                        segmentId={segment.id} 
                        simulationData={simulationData} 
                      />
                    </div>

                    {/* Page footer */}
                    <div className="px-4 py-2 border-t text-center">
                      <p className="text-[9px] text-muted-foreground">
                        Page {index + 2} of {totalPages}
                      </p>
                    </div>
                  </div>
                );
              })}

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
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

// Preview content for each segment type
function SegmentPreviewContent({ 
  segmentId, 
  simulationData 
}: { 
  segmentId: SegmentType; 
  simulationData: any;
}) {
  switch (segmentId) {
    case "executive_summary":
      return (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <MetricBox label="Solar Capacity" value={`${simulationData.solarCapacityKwp} kWp`} />
            <MetricBox label="Battery" value={`${simulationData.batteryCapacityKwh} kWh`} />
            <MetricBox label="Annual Savings" value={`R${Math.round(simulationData.annualSavings || 0).toLocaleString()}`} />
            <MetricBox label="Payback" value={`${(simulationData.paybackYears || 0).toFixed(1)} years`} />
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            This proposal outlines a comprehensive solar PV solution designed to reduce grid dependency
            and achieve significant cost savings through renewable energy generation.
          </p>
        </div>
      );

    case "tariff_details":
      return (
        <div className="space-y-2 text-[9px]">
          <p className="font-medium text-[10px]">TOU Periods (Weekday)</p>
          <div className="grid grid-cols-3 gap-1 text-center">
            <div className="bg-destructive/10 rounded p-1.5 border border-destructive/20">
              <p className="font-bold text-destructive">Peak</p>
              <p className="text-muted-foreground">06:00-08:00</p>
              <p className="text-muted-foreground">18:00-21:00</p>
            </div>
            <div className="bg-amber-500/10 rounded p-1.5 border border-amber-500/20">
              <p className="font-bold text-amber-600">Standard</p>
              <p className="text-muted-foreground">08:00-18:00</p>
              <p className="text-muted-foreground">21:00-22:00</p>
            </div>
            <div className="bg-emerald-500/10 rounded p-1.5 border border-emerald-500/20">
              <p className="font-bold text-emerald-600">Off-Peak</p>
              <p className="text-muted-foreground">22:00-06:00</p>
            </div>
          </div>
          <div className="mt-2">
            <p className="font-medium text-[10px]">Seasonal Calendar</p>
            <div className="grid grid-cols-12 gap-0.5 mt-1">
              {['J','F','M','A','M','J','J','A','S','O','N','D'].map((m, i) => (
                <div 
                  key={m + i}
                  className={`text-center rounded p-0.5 text-[7px] ${
                    i >= 5 && i <= 7 
                      ? 'bg-destructive/20 text-destructive font-medium' 
                      : 'bg-emerald-500/20 text-emerald-600'
                  }`}
                >
                  {m}
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case "dcac_comparison":
      const ratio = simulationData.dcAcRatio || 1.3;
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px]">
            <span>DC/AC Ratio</span>
            <span className="font-bold text-primary">{ratio.toFixed(2)}:1</span>
          </div>
          <div className="h-2 bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 rounded-full relative">
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-background border-2 border-primary rounded-full"
              style={{ left: `${Math.min(100, Math.max(0, (ratio - 1) * 100))}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-1 text-center text-[8px]">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded p-1">
              <p className="font-bold text-emerald-600">Optimal</p>
              <p className="text-muted-foreground">1.1-1.3</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded p-1">
              <p className="font-bold text-amber-600">High</p>
              <p className="text-muted-foreground">1.3-1.5</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 rounded p-1">
              <p className="font-bold text-red-600">Clipping</p>
              <p className="text-muted-foreground">&gt;1.5</p>
            </div>
          </div>
        </div>
      );

    case "payback_timeline":
      const payback = simulationData.paybackYears || 5;
      const pct = Math.min(100, (payback / 25) * 100);
      return (
        <div className="space-y-2">
          <div className="relative h-6 bg-muted rounded overflow-hidden">
            <div className="absolute left-0 top-0 h-full bg-emerald-500/40" style={{ width: `${pct}%` }} />
            <div className="absolute top-0 w-0.5 h-full bg-primary" style={{ left: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[9px]">
            <span>Start</span>
            <span className="font-bold text-emerald-600">Break-even: Year {payback.toFixed(1)}</span>
            <span>25 Yrs</span>
          </div>
        </div>
      );

    case "environmental_impact":
      const co2 = simulationData.co2AvoidedTons || 120;
      return (
        <div className="text-center space-y-2">
          <div className="flex justify-center gap-6">
            <div>
              <Leaf className="h-8 w-8 mx-auto text-emerald-500 mb-1" />
              <p className="text-lg font-bold text-emerald-600">{Math.round(co2)}</p>
              <p className="text-[9px] text-muted-foreground">tonnes CO₂/yr</p>
            </div>
            <div>
              <span className="text-2xl">🌳</span>
              <p className="text-lg font-bold">{Math.round(co2 * 45)}</p>
              <p className="text-[9px] text-muted-foreground">trees equivalent</p>
            </div>
          </div>
        </div>
      );

    case "engineering_specs":
      return (
        <div className="space-y-1 text-[9px]">
          <SpecRow label="PV Modules" value={`${simulationData.solarCapacityKwp} kWp`} />
          <SpecRow label="DC/AC Ratio" value={`${(simulationData.dcAcRatio || 1.3).toFixed(2)}:1`} />
          <SpecRow label="Battery" value={`${simulationData.batteryCapacityKwh} kWh`} />
          <SpecRow label="Expected PR" value="80-82%" />
          <SpecRow label="Specific Yield" value="~1,600 kWh/kWp/yr" />
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
