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
  GripVertical,
  Wand2,
  RefreshCw,
  Scale
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
  { id: "sizing_comparison", label: "Sizing Alternatives", description: "Conservative vs aggressive options", icon: Scale },
  { id: "energy_flow", label: "Energy Flow", description: "System energy distribution", icon: Sparkles },
  { id: "monthly_yield", label: "Monthly Yield", description: "12-month generation forecast", icon: BarChart3 },
  { id: "payback_timeline", label: "Payback Timeline", description: "Financial ROI projection", icon: DollarSign },
  { id: "sensitivity_analysis", label: "Sensitivity Analysis", description: "ROI under different scenarios", icon: TrendingUp },
  { id: "environmental_impact", label: "Environmental Impact", description: "CO2 reduction metrics", icon: Leaf },
  { id: "engineering_specs", label: "Engineering Specs", description: "Technical specifications", icon: Settings2 },
];

// AI Narrative types
interface AIProposalNarrative {
  executive_summary?: { narrative: string; keyHighlights: string[] };
  tariff_analysis?: { narrative: string; keyHighlights: string[] };
  sizing_methodology?: { narrative: string; keyHighlights: string[] };
  investment_recommendation?: { narrative: string; keyHighlights: string[] };
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
  
  // AI Narrative state
  const [aiNarratives, setAiNarratives] = useState<AIProposalNarrative>({});
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
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

      const sectionsToGenerate = sectionType 
        ? [sectionType] 
        : ['executive_summary', 'tariff_analysis', 'sizing_methodology', 'investment_recommendation'];

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

        // Render content based on segment type with INFOGRAPHICS
        switch (segment.id) {
          case "executive_summary":
            // Extract project details
            const tariffInfo = projectDetails?.tariffs;
            const municipalityName = tariffInfo?.municipalities?.name;
            const tariffName = tariffInfo?.name;
            const buildingArea = projectDetails?.total_area_sqm;
            const connectionSize = projectDetails?.connection_size_kva;
            const location = projectDetails?.location;

            // Check for AI-generated narrative
            const aiSummary = aiNarrativeEnabled && aiNarratives.executive_summary?.narrative;
            
            if (aiSummary) {
              // AI-Generated Professional Narrative
              pdf.setFillColor(248, 250, 252);
              const narrativeBoxHeight = Math.min(120, 30 + aiSummary.length / 10);
              pdf.roundedRect(margin, yPos, pageWidth - 2 * margin, narrativeBoxHeight, 3, 3, "F");
              
              pdf.setFontSize(10);
              pdf.setTextColor(22, 101, 52);
              pdf.text("Executive Summary", margin + 5, yPos + 8);
              
              // AI badge
              pdf.setFillColor(220, 252, 231);
              pdf.roundedRect(pageWidth - margin - 35, yPos + 3, 30, 8, 2, 2, "F");
              pdf.setFontSize(6);
              pdf.setTextColor(22, 101, 52);
              pdf.text("AI-Generated", pageWidth - margin - 33, yPos + 8);
              
              pdf.setFontSize(9);
              pdf.setTextColor(60, 60, 60);
              
              // Wrap and render the AI narrative
              const maxLineWidth = pageWidth - 2 * margin - 10;
              const wrappedNarrative = pdf.splitTextToSize(aiSummary, maxLineWidth);
              const maxLines = Math.floor((narrativeBoxHeight - 15) / 4);
              const linesToRender = wrappedNarrative.slice(0, maxLines);
              pdf.text(linesToRender, margin + 5, yPos + 18);
              
              yPos += narrativeBoxHeight + 8;
            } else {
              // Fallback: Static summary
              pdf.setFillColor(248, 250, 252);
              pdf.roundedRect(margin, yPos, pageWidth - 2 * margin, 42, 3, 3, "F");
              pdf.setFontSize(10);
              pdf.setTextColor(0, 0, 0);
              pdf.text("Project Overview", margin + 5, yPos + 8);
              
              pdf.setFontSize(9);
              pdf.setTextColor(80, 80, 80);
              
              // Build dynamic summary text
              let summaryLine1 = `This proposal outlines a solar PV installation for ${projectName}`;
              if (location) summaryLine1 += `, located in ${location}`;
              if (buildingArea) summaryLine1 += `, covering ${Number(buildingArea).toLocaleString()} m² of building area`;
              summaryLine1 += ".";
              
              let summaryLine2 = `The system has been sized at ${simulationData.solarCapacityKwp} kWp`;
              if (connectionSize) summaryLine2 += ` against a ${connectionSize} kVA grid connection`;
              if (tariffName) {
                summaryLine2 += `, applying the ${tariffName} tariff`;
                if (municipalityName) summaryLine2 += ` (${municipalityName})`;
              }
              summaryLine2 += ".";

              // Wrap text for PDF
              const maxLineWidth = pageWidth - 2 * margin - 10;
              const wrappedLine1 = pdf.splitTextToSize(summaryLine1, maxLineWidth);
              const wrappedLine2 = pdf.splitTextToSize(summaryLine2, maxLineWidth);
              
              pdf.text(wrappedLine1, margin + 5, yPos + 18);
              pdf.text(wrappedLine2, margin + 5, yPos + 18 + wrappedLine1.length * 4.5);
              
              yPos += 50;
            }

            // Draw metric cards infographic
            const cardWidth = 50;
            const cardHeight = 32;
            const cardGap = 10;
            const cardY = yPos;
            
            // Solar capacity card
            pdf.setFillColor(240, 253, 244);
            pdf.roundedRect(margin, cardY, cardWidth, cardHeight, 3, 3, "F");
            pdf.setDrawColor(34, 197, 94);
            pdf.roundedRect(margin, cardY, cardWidth, cardHeight, 3, 3, "S");
            pdf.setFontSize(16);
            pdf.setTextColor(34, 197, 94);
            pdf.text(`${simulationData.solarCapacityKwp}`, margin + 5, cardY + 14);
            pdf.setFontSize(10);
            pdf.text("kWp", margin + 32, cardY + 14);
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text("Solar Capacity", margin + 5, cardY + 25);

            // Battery card
            pdf.setFillColor(239, 246, 255);
            pdf.roundedRect(margin + cardWidth + cardGap, cardY, cardWidth, cardHeight, 3, 3, "F");
            pdf.setDrawColor(59, 130, 246);
            pdf.roundedRect(margin + cardWidth + cardGap, cardY, cardWidth, cardHeight, 3, 3, "S");
            pdf.setFontSize(16);
            pdf.setTextColor(59, 130, 246);
            pdf.text(`${simulationData.batteryCapacityKwh}`, margin + cardWidth + cardGap + 5, cardY + 14);
            pdf.setFontSize(10);
            pdf.text("kWh", margin + cardWidth + cardGap + 32, cardY + 14);
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text("Battery Storage", margin + cardWidth + cardGap + 5, cardY + 25);

            // Savings card
            pdf.setFillColor(254, 252, 232);
            pdf.roundedRect(margin + 2 * (cardWidth + cardGap), cardY, cardWidth, cardHeight, 3, 3, "F");
            pdf.setDrawColor(234, 179, 8);
            pdf.roundedRect(margin + 2 * (cardWidth + cardGap), cardY, cardWidth, cardHeight, 3, 3, "S");
            pdf.setFontSize(13);
            pdf.setTextColor(161, 98, 7);
            pdf.text(`R${Math.round((simulationData.annualSavings || 0) / 1000)}k`, margin + 2 * (cardWidth + cardGap) + 5, cardY + 14);
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text("Annual Savings", margin + 2 * (cardWidth + cardGap) + 5, cardY + 25);

            yPos = cardY + cardHeight + 15;

            // Draw ROI gauge infographic
            pdf.setFontSize(11);
            pdf.setTextColor(0, 0, 0);
            pdf.text("Return on Investment", margin, yPos);
            yPos += 8;

            // Semi-circle gauge for ROI
            const gaugeX = pageWidth / 2;
            const gaugeY = yPos + 35;
            const gaugeRadius = 30;
            const roiPct = Math.min(100, simulationData.roiPercent || 0);
            
            // Draw filled gauge background
            pdf.setFillColor(240, 240, 240);
            pdf.ellipse(gaugeX, gaugeY, gaugeRadius, gaugeRadius / 2, "F");
            
            // Draw colored progress arc
            const progressAngle = 180 + (roiPct / 100) * 180;
            pdf.setDrawColor(34, 197, 94);
            pdf.setLineWidth(5);
            
            for (let angle = 180; angle < progressAngle; angle += 3) {
              const rad1 = (angle * Math.PI) / 180;
              const rad2 = ((angle + 3) * Math.PI) / 180;
              const x1 = gaugeX + gaugeRadius * Math.cos(rad1);
              const y1 = gaugeY + gaugeRadius * Math.sin(rad1) * 0.5;
              const x2 = gaugeX + gaugeRadius * Math.cos(rad2);
              const y2 = gaugeY + gaugeRadius * Math.sin(rad2) * 0.5;
              pdf.line(x1, y1, x2, y2);
            }

            // Center value
            pdf.setFontSize(20);
            pdf.setTextColor(34, 197, 94);
            pdf.text(`${Math.round(roiPct)}%`, gaugeX - 8, gaugeY + 4);
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text("ROI", gaugeX - 5, gaugeY + 10);

            yPos = gaugeY + 25;

            // Payback timeline bar
            pdf.setFontSize(10);
            pdf.setTextColor(0, 0, 0);
            pdf.text("Payback Timeline", margin, yPos);
            yPos += 7;
            
            const barWidth = pageWidth - 2 * margin;
            const paybackPct = Math.min(100, ((simulationData.paybackYears || 5) / 25) * 100);
            
            pdf.setFillColor(240, 240, 240);
            pdf.roundedRect(margin, yPos, barWidth, 8, 2, 2, "F");
            
            pdf.setFillColor(34, 197, 94);
            pdf.roundedRect(margin, yPos, barWidth * (paybackPct / 100), 8, 2, 2, "F");
            
            // Marker
            const markerX = margin + barWidth * (paybackPct / 100);
            pdf.setFillColor(22, 163, 74);
            pdf.circle(markerX, yPos + 4, 3, "F");
            
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.text("0 yrs", margin, yPos + 14);
            pdf.text(`${(simulationData.paybackYears || 5).toFixed(1)} yrs`, markerX - 8, yPos - 2);
            pdf.text("25 yrs", margin + barWidth - 10, yPos + 14);
            break;

          case "tariff_details":
            // TOU Clock Diagram
            pdf.setFontSize(12);
            pdf.setTextColor(0, 0, 0);
            pdf.text("Time-of-Use Rate Periods (Weekday)", margin, yPos);
            yPos += 10;
            
            // Draw 24-hour clock
            const clockX = pageWidth / 2;
            const clockY = yPos + 50;
            const clockRadius = 40;
            
            // Draw clock segments for each hour
            for (let hour = 0; hour < 24; hour++) {
              const startAngle = ((hour - 6) * 15 - 90) * Math.PI / 180;
              const endAngle = ((hour - 5) * 15 - 90) * Math.PI / 180;
              
              // Determine period color
              let color: [number, number, number];
              if ((hour >= 6 && hour < 8) || (hour >= 18 && hour < 21)) {
                color = [239, 68, 68]; // Peak - red
              } else if ((hour >= 8 && hour < 18) || (hour >= 21 && hour < 22)) {
                color = [245, 158, 11]; // Standard - amber
              } else {
                color = [34, 197, 94]; // Off-peak - green
              }
              
              pdf.setFillColor(...color);
              
              // Draw pie segment
              const innerRadius = clockRadius * 0.5;
              pdf.setDrawColor(255, 255, 255);
              pdf.setLineWidth(0.5);
              
              // Create wedge
              const x1 = clockX + innerRadius * Math.cos(startAngle);
              const y1 = clockY + innerRadius * Math.sin(startAngle);
              const x2 = clockX + clockRadius * Math.cos(startAngle);
              const y2 = clockY + clockRadius * Math.sin(startAngle);
              const x3 = clockX + clockRadius * Math.cos(endAngle);
              const y3 = clockY + clockRadius * Math.sin(endAngle);
              const x4 = clockX + innerRadius * Math.cos(endAngle);
              const y4 = clockY + innerRadius * Math.sin(endAngle);
              
              // Approximate wedge with triangle
              pdf.triangle(x1, y1, x2, y2, x3, y3, "F");
              pdf.triangle(x1, y1, x3, y3, x4, y4, "F");
            }
            
            // Center circle
            pdf.setFillColor(255, 255, 255);
            pdf.circle(clockX, clockY, clockRadius * 0.4, "F");
            
            // Hour labels
            pdf.setFontSize(6);
            pdf.setTextColor(80, 80, 80);
            [0, 6, 12, 18].forEach(hour => {
              const angle = ((hour - 6) * 15 - 90) * Math.PI / 180;
              const labelRadius = clockRadius + 8;
              const x = clockX + labelRadius * Math.cos(angle);
              const y = clockY + labelRadius * Math.sin(angle);
              pdf.text(`${hour}:00`, x - 6, y + 2);
            });
            
            // Legend
            yPos = clockY + clockRadius + 20;
            
            // Peak legend
            pdf.setFillColor(239, 68, 68);
            pdf.rect(margin, yPos, 8, 8, "F");
            pdf.setFontSize(9);
            pdf.setTextColor(0, 0, 0);
            pdf.text("Peak (06:00-08:00, 18:00-21:00)", margin + 12, yPos + 6);
            
            // Standard legend
            pdf.setFillColor(245, 158, 11);
            pdf.rect(margin + 80, yPos, 8, 8, "F");
            pdf.text("Standard (08:00-18:00, 21:00-22:00)", margin + 92, yPos + 6);
            
            yPos += 15;
            
            // Off-peak legend
            pdf.setFillColor(34, 197, 94);
            pdf.rect(margin, yPos, 8, 8, "F");
            pdf.text("Off-Peak (22:00-06:00)", margin + 12, yPos + 6);
            
            yPos += 20;
            
            // Seasonal calendar visual
            pdf.setFontSize(12);
            pdf.setTextColor(0, 0, 0);
            pdf.text("Seasonal Calendar", margin, yPos);
            yPos += 8;
            
            const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
            const monthWidth = (pageWidth - 2 * margin) / 12;
            
            months.forEach((m, i) => {
              const isWinter = i >= 5 && i <= 7;
              pdf.setFillColor(isWinter ? 239 : 34, isWinter ? 68 : 197, isWinter ? 68 : 94);
              pdf.roundedRect(margin + i * monthWidth, yPos, monthWidth - 2, 20, 2, 2, "F");
              pdf.setFontSize(10);
              pdf.setTextColor(255, 255, 255);
              pdf.text(m, margin + i * monthWidth + monthWidth / 2 - 3, yPos + 13);
            });
            
            yPos += 28;
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.setFillColor(239, 68, 68);
            pdf.rect(margin, yPos, 8, 8, "F");
            pdf.text("High Demand (Winter)", margin + 12, yPos + 6);
            pdf.setFillColor(34, 197, 94);
            pdf.rect(margin + 60, yPos, 8, 8, "F");
            pdf.text("Low Demand (Summer)", margin + 72, yPos + 6);
            break;

          case "dcac_comparison":
            // DC/AC Ratio gauge
            const dcacRatio = simulationData.dcAcRatio || 1.3;
            
            pdf.setFontSize(12);
            pdf.setTextColor(0, 0, 0);
            pdf.text("DC/AC Oversizing Ratio Analysis", margin, yPos);
            yPos += 15;
            
            // Draw horizontal ratio scale
            const scaleWidth = pageWidth - 2 * margin;
            const scaleHeight = 20;
            
            // Gradient bar (green -> yellow -> red)
            const segmentWidth = scaleWidth / 4;
            
            // Conservative (green)
            pdf.setFillColor(34, 197, 94);
            pdf.rect(margin, yPos, segmentWidth, scaleHeight, "F");
            
            // Optimal (lighter green)
            pdf.setFillColor(74, 222, 128);
            pdf.rect(margin + segmentWidth, yPos, segmentWidth, scaleHeight, "F");
            
            // Aggressive (yellow)
            pdf.setFillColor(250, 204, 21);
            pdf.rect(margin + 2 * segmentWidth, yPos, segmentWidth, scaleHeight, "F");
            
            // High (red)
            pdf.setFillColor(239, 68, 68);
            pdf.rect(margin + 3 * segmentWidth, yPos, segmentWidth, scaleHeight, "F");
            
            // Current ratio marker
            const ratioPosition = Math.min(1, Math.max(0, (dcacRatio - 1) / 0.6));
            const markerPosX = margin + ratioPosition * scaleWidth;
            
            pdf.setFillColor(0, 0, 0);
            pdf.triangle(markerPosX - 5, yPos - 3, markerPosX + 5, yPos - 3, markerPosX, yPos + 3, "F");
            pdf.setFontSize(10);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`${dcacRatio.toFixed(2)}:1`, markerPosX - 8, yPos - 8);
            
            // Scale labels
            yPos += scaleHeight + 5;
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.text("1.0", margin, yPos + 5);
            pdf.text("1.15", margin + segmentWidth - 5, yPos + 5);
            pdf.text("1.3", margin + 2 * segmentWidth - 3, yPos + 5);
            pdf.text("1.45", margin + 3 * segmentWidth - 5, yPos + 5);
            pdf.text("1.6+", margin + scaleWidth - 8, yPos + 5);
            
            // Category labels
            yPos += 12;
            pdf.setFontSize(8);
            pdf.text("Conservative", margin + segmentWidth / 2 - 15, yPos);
            pdf.text("Optimal", margin + 1.5 * segmentWidth - 10, yPos);
            pdf.text("Aggressive", margin + 2.5 * segmentWidth - 12, yPos);
            pdf.text("High Risk", margin + 3.5 * segmentWidth - 12, yPos);
            
            yPos += 20;
            
            // Energy capture visualization
            pdf.setFontSize(11);
            pdf.setTextColor(0, 0, 0);
            pdf.text("Daily Energy Capture Profile", margin, yPos);
            yPos += 10;
            
            // Draw sun path curve
            const graphWidth = scaleWidth;
            const graphHeight = 50;
            
            // Background
            pdf.setFillColor(250, 250, 250);
            pdf.rect(margin, yPos, graphWidth, graphHeight, "F");
            
            // Grid lines
            pdf.setDrawColor(230, 230, 230);
            pdf.setLineWidth(0.3);
            for (let i = 1; i < 4; i++) {
              pdf.line(margin, yPos + i * graphHeight / 4, margin + graphWidth, yPos + i * graphHeight / 4);
            }
            
            // Inverter limit line
            const inverterLimit = graphHeight * 0.7;
            pdf.setDrawColor(239, 68, 68);
            pdf.setLineWidth(1);
            pdf.line(margin, yPos + graphHeight - inverterLimit, margin + graphWidth, yPos + graphHeight - inverterLimit);
            
            // Solar production curve
            pdf.setDrawColor(34, 197, 94);
            pdf.setLineWidth(2);
            const points: Array<[number, number]> = [];
            for (let x = 0; x <= graphWidth; x += 3) {
              const hour = 5 + (x / graphWidth) * 14; // 5am to 7pm
              const normalizedHour = (hour - 12) / 7;
              const production = Math.max(0, 1 - normalizedHour * normalizedHour) * dcacRatio;
              const y = yPos + graphHeight - production * graphHeight * 0.5;
              points.push([margin + x, y]);
            }
            
            for (let i = 1; i < points.length; i++) {
              pdf.line(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
            }
            
            // Clipping area shading
            pdf.setFillColor(239, 68, 68, 0.3);
            
            yPos += graphHeight + 10;
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.text("5:00", margin, yPos);
            pdf.text("12:00", margin + graphWidth / 2 - 8, yPos);
            pdf.text("19:00", margin + graphWidth - 12, yPos);
            
            pdf.setFillColor(34, 197, 94);
            pdf.rect(margin + graphWidth - 60, yPos - 8, 6, 6, "F");
            pdf.text("Solar Output", margin + graphWidth - 50, yPos - 3);
            
            pdf.setFillColor(239, 68, 68);
            pdf.rect(margin + graphWidth - 60, yPos + 2, 6, 6, "F");
            pdf.text("Inverter Limit", margin + graphWidth - 50, yPos + 7);
            break;

          case "payback_timeline":
            const paybackYrs = simulationData.paybackYears || 5;
            const annualSave = simulationData.annualSavings || 250000;
            const systemCost = (simulationData.solarCapacityKwp || 100) * 12000;
            
            pdf.setFontSize(12);
            pdf.setTextColor(0, 0, 0);
            pdf.text("Investment Payback Analysis", margin, yPos);
            yPos += 15;
            
            // Draw cumulative cash flow chart
            const chartWidth = pageWidth - 2 * margin;
            const chartHeight = 80;
            
            // Background
            pdf.setFillColor(250, 250, 250);
            pdf.rect(margin, yPos, chartWidth, chartHeight, "F");
            
            // Zero line
            const zeroY = yPos + chartHeight * 0.4;
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.5);
            pdf.line(margin, zeroY, margin + chartWidth, zeroY);
            
            // Shade areas first (behind the line)
            const years = 10;
            const yearWidth = chartWidth / years;
            
            // Shade negative area (investment payback period)
            pdf.setFillColor(254, 226, 226);
            const paybackX = margin + (paybackYrs / years) * chartWidth;
            pdf.rect(margin, zeroY, paybackX - margin, 25, "F");
            
            // Shade positive area (profit period)
            pdf.setFillColor(220, 252, 231);
            pdf.rect(paybackX, yPos + 5, margin + chartWidth - paybackX, zeroY - yPos - 5, "F");
            
            // Draw cash flow curve
            pdf.setDrawColor(34, 197, 94);
            pdf.setLineWidth(2.5);
            
            const maxValue = annualSave * years;
            const minValue = -systemCost;
            const valueRange = maxValue - minValue;
            
            let prevXPay = margin;
            let prevYPay = zeroY + (systemCost / valueRange) * chartHeight * 0.4;
            
            for (let yr = 0; yr <= years; yr++) {
              const cumulative = annualSave * yr - systemCost;
              const x = margin + yr * yearWidth;
              const y = zeroY - (cumulative / valueRange) * chartHeight * 0.6;
              
              if (yr > 0) {
                pdf.line(prevXPay, prevYPay, x, y);
              }
              
              prevXPay = x;
              prevYPay = y;
            }
            
            // Break-even marker
            const breakEvenY = zeroY;
            pdf.setFillColor(34, 197, 94);
            pdf.circle(paybackX, breakEvenY, 4, "F");
            
            // Break-even label - position to the right of the marker
            pdf.setFontSize(9);
            pdf.setTextColor(34, 197, 94);
            const beText = `Year ${paybackYrs.toFixed(1)}`;
            pdf.text(beText, paybackX + 8, breakEvenY + 3);
            pdf.setFontSize(7);
            pdf.setTextColor(80, 80, 80);
            pdf.text("Break-even", paybackX + 8, breakEvenY + 11);
            
            // Y-axis labels
            yPos += chartHeight + 8;
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            for (let yr = 0; yr <= years; yr += 2) {
              pdf.text(`Y${yr}`, margin + yr * yearWidth - 3, yPos);
            }
            
            yPos += 15;
            
            // Summary cards
            const summaryY = yPos;
            const summaryCardWidth = (chartWidth - 20) / 3;
            
            // Initial investment card
            pdf.setFillColor(254, 226, 226);
            pdf.roundedRect(margin, summaryY, summaryCardWidth, 30, 3, 3, "F");
            pdf.setFontSize(11);
            pdf.setTextColor(185, 28, 28);
            pdf.text(`-R${(systemCost / 1000).toFixed(0)}k`, margin + 8, summaryY + 13);
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.text("Initial Investment", margin + 8, summaryY + 23);
            
            // Break-even card
            pdf.setFillColor(254, 249, 195);
            pdf.roundedRect(margin + summaryCardWidth + 10, summaryY, summaryCardWidth, 30, 3, 3, "F");
            pdf.setFontSize(11);
            pdf.setTextColor(161, 98, 7);
            pdf.text(`${paybackYrs.toFixed(1)} Years`, margin + summaryCardWidth + 18, summaryY + 13);
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.text("Payback Period", margin + summaryCardWidth + 18, summaryY + 23);
            
            // 25-year returns card
            const total25yr = annualSave * 25 - systemCost;
            pdf.setFillColor(220, 252, 231);
            pdf.roundedRect(margin + 2 * (summaryCardWidth + 10), summaryY, summaryCardWidth, 30, 3, 3, "F");
            pdf.setFontSize(11);
            pdf.setTextColor(22, 163, 74);
            pdf.text(`+R${(total25yr / 1000000).toFixed(1)}M`, margin + 2 * (summaryCardWidth + 10) + 8, summaryY + 13);
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.text("25-Year Returns", margin + 2 * (summaryCardWidth + 10) + 8, summaryY + 23);
            break;

          case "environmental_impact":
            const co2Tons = simulationData.co2AvoidedTons || 120;
            
            pdf.setFontSize(12);
            pdf.setTextColor(0, 0, 0);
            pdf.text("Environmental Impact Visualization", margin, yPos);
            yPos += 20;
            
            // CO2 circular infographic
            const envCenterX = pageWidth / 3;
            const envCenterY = yPos + 40;
            const envRadius = 35;
            
            // Outer ring
            pdf.setFillColor(220, 252, 231);
            pdf.circle(envCenterX, envCenterY, envRadius, "F");
            pdf.setFillColor(255, 255, 255);
            pdf.circle(envCenterX, envCenterY, envRadius * 0.65, "F");
            
            // CO2 text - use plain text for compatibility
            pdf.setFontSize(22);
            pdf.setTextColor(22, 163, 74);
            pdf.text(`${Math.round(co2Tons)}`, envCenterX - 12, envCenterY + 2);
            pdf.setFontSize(9);
            pdf.setTextColor(80, 80, 80);
            pdf.text("tonnes CO2", envCenterX - 16, envCenterY + 14);
            pdf.setFontSize(7);
            pdf.text("per year", envCenterX - 10, envCenterY + 22);
            
            // Trees visualization
            const treeCenterX = pageWidth * 2 / 3;
            const treeCenterY = envCenterY;
            const treesEquivEnv = Math.round(co2Tons * 45);
            
            // Tree icons (simplified)
            for (let i = 0; i < 9; i++) {
              const row = Math.floor(i / 3);
              const col = i % 3;
              const tx = treeCenterX - 20 + col * 20;
              const ty = treeCenterY - 20 + row * 18;
              
              // Tree trunk
              pdf.setFillColor(139, 69, 19);
              pdf.rect(tx + 3, ty + 8, 4, 8, "F");
              
              // Tree foliage
              pdf.setFillColor(34, 197, 94);
              pdf.triangle(tx, ty + 10, tx + 10, ty + 10, tx + 5, ty - 2, "F");
            }
            
            pdf.setFontSize(16);
            pdf.setTextColor(22, 163, 74);
            pdf.text(`${treesEquivEnv.toLocaleString()}`, treeCenterX - 18, treeCenterY + 40);
            pdf.setFontSize(9);
            pdf.setTextColor(80, 80, 80);
            pdf.text("Trees Equivalent", treeCenterX - 20, treeCenterY + 50);
            
            yPos = envCenterY + 70;
            
            // 25-year impact section with 3 cards
            pdf.setFontSize(11);
            pdf.setTextColor(0, 0, 0);
            pdf.text("25-Year Lifetime Impact", margin, yPos);
            yPos += 12;
            
            const impactCardWidth = (pageWidth - 2 * margin - 20) / 3;
            const lifetime25Env = co2Tons * 25;
            
            // CO2 card
            pdf.setFillColor(220, 252, 231);
            pdf.roundedRect(margin, yPos, impactCardWidth, 35, 4, 4, "F");
            pdf.setFontSize(14);
            pdf.setTextColor(22, 163, 74);
            pdf.text(`${Math.round(lifetime25Env / 1000).toLocaleString()}k`, margin + 8, yPos + 15);
            pdf.setFontSize(8);
            pdf.setTextColor(80, 80, 80);
            pdf.text("tonnes CO2", margin + 8, yPos + 25);

            // Trees card
            pdf.setFillColor(240, 253, 244);
            pdf.roundedRect(margin + impactCardWidth + 10, yPos, impactCardWidth, 35, 4, 4, "F");
            pdf.setFontSize(14);
            pdf.setTextColor(22, 163, 74);
            pdf.text(`${Math.round(lifetime25Env * 45 / 1000).toLocaleString()}k`, margin + impactCardWidth + 18, yPos + 15);
            pdf.setFontSize(8);
            pdf.setTextColor(80, 80, 80);
            pdf.text("trees planted", margin + impactCardWidth + 18, yPos + 25);

            // Cars card
            pdf.setFillColor(239, 246, 255);
            pdf.roundedRect(margin + 2 * (impactCardWidth + 10), yPos, impactCardWidth, 35, 4, 4, "F");
            pdf.setFontSize(14);
            pdf.setTextColor(37, 99, 235);
            pdf.text(`${Math.round(lifetime25Env / 4).toLocaleString()}`, margin + 2 * (impactCardWidth + 10) + 8, yPos + 15);
            pdf.setFontSize(8);
            pdf.setTextColor(80, 80, 80);
            pdf.text("cars off road", margin + 2 * (impactCardWidth + 10) + 8, yPos + 25);
            break;

          case "energy_flow":
            // Sankey-style energy flow diagram
            pdf.setFontSize(12);
            pdf.setTextColor(0, 0, 0);
            pdf.text("System Energy Distribution", margin, yPos);
            yPos += 15;

            const flowWidth = pageWidth - 2 * margin;
            const flowHeight = 120;
            const centerY = yPos + flowHeight / 2;
            const nodeWidth = 45;
            const nodeHeight = 50;
            
            // Calculate energy values
            const annualGen = (simulationData.solarCapacityKwp || 100) * 1600; // kWh/year
            const selfConsume = annualGen * 0.65; // 65% self-consumption
            const gridExport = annualGen * 0.35;
            const gridImport = annualGen * 0.15;
            const totalConsumption = selfConsume + gridImport;

            // Source node - Solar
            const solarX = margin;
            pdf.setFillColor(250, 204, 21);
            pdf.roundedRect(solarX, centerY - 35, nodeWidth, 70, 4, 4, "F");
            pdf.setFontSize(9);
            pdf.setTextColor(0, 0, 0);
            pdf.text("Solar", solarX + 10, centerY - 20);
            pdf.text("Generation", solarX + 5, centerY - 10);
            pdf.setFontSize(14);
            pdf.setTextColor(161, 98, 7);
            pdf.text(`${Math.round(annualGen / 1000)}`, solarX + 10, centerY + 5);
            pdf.setFontSize(8);
            pdf.text("MWh/yr", solarX + 10, centerY + 15);

            // Building/Load node - center
            const buildingX = pageWidth / 2 - nodeWidth / 2;
            pdf.setFillColor(219, 234, 254);
            pdf.roundedRect(buildingX, centerY - 30, nodeWidth, 60, 4, 4, "F");
            pdf.setFontSize(9);
            pdf.setTextColor(0, 0, 0);
            pdf.text("Building", buildingX + 8, centerY - 15);
            pdf.text("Load", buildingX + 13, centerY - 5);
            pdf.setFontSize(14);
            pdf.setTextColor(37, 99, 235);
            pdf.text(`${Math.round(totalConsumption / 1000)}`, buildingX + 10, centerY + 10);
            pdf.setFontSize(8);
            pdf.text("MWh/yr", buildingX + 10, centerY + 20);

            // Grid node - right
            const gridX = pageWidth - margin - nodeWidth;
            pdf.setFillColor(229, 231, 235);
            pdf.roundedRect(gridX, centerY - 25, nodeWidth, 50, 4, 4, "F");
            pdf.setFontSize(9);
            pdf.setTextColor(0, 0, 0);
            pdf.text("Grid", gridX + 15, centerY - 10);
            pdf.setFontSize(11);
            pdf.setTextColor(107, 114, 128);
            pdf.text(`${Math.round(gridExport / 1000)}`, gridX + 8, centerY + 8);
            pdf.setFontSize(7);
            pdf.text("MWh export", gridX + 6, centerY + 17);

            // Flow arrows with curved paths
            pdf.setLineWidth(3);
            
            // Solar to Building (self-consumption) - main flow
            pdf.setDrawColor(34, 197, 94);
            const flow1Width = (selfConsume / annualGen) * 30;
            pdf.setLineWidth(Math.max(2, flow1Width / 5));
            pdf.line(solarX + nodeWidth, centerY, buildingX, centerY);
            // Arrow head
            pdf.setFillColor(34, 197, 94);
            pdf.triangle(buildingX - 2, centerY - 4, buildingX - 2, centerY + 4, buildingX + 3, centerY, "F");
            
            // Solar to Grid (export) - upper flow
            pdf.setDrawColor(245, 158, 11);
            pdf.setLineWidth(2);
            const exportY = centerY - 20;
            pdf.line(solarX + nodeWidth, centerY - 15, solarX + nodeWidth + 20, exportY);
            pdf.line(solarX + nodeWidth + 20, exportY, gridX, exportY);
            pdf.setFillColor(245, 158, 11);
            pdf.triangle(gridX - 2, exportY - 3, gridX - 2, exportY + 3, gridX + 3, exportY, "F");
            
            // Grid to Building (import) - lower flow  
            if (gridImport > 0) {
              pdf.setDrawColor(156, 163, 175);
              pdf.setLineWidth(1.5);
              const importY = centerY + 20;
              pdf.line(gridX, importY, buildingX + nodeWidth + 5, importY);
              pdf.line(buildingX + nodeWidth + 5, importY, buildingX + nodeWidth, centerY + 10);
              pdf.setFillColor(156, 163, 175);
              pdf.triangle(buildingX + nodeWidth + 2, centerY + 7, buildingX + nodeWidth + 2, centerY + 13, buildingX + nodeWidth - 3, centerY + 10, "F");
            }

            yPos += flowHeight + 15;

            // Flow legend
            pdf.setLineWidth(0.5);
            pdf.setFontSize(8);
            
            pdf.setFillColor(34, 197, 94);
            pdf.rect(margin, yPos, 12, 4, "F");
            pdf.setTextColor(0, 0, 0);
            pdf.text(`Self-consumption: ${Math.round(selfConsume / 1000)} MWh (${Math.round(selfConsume / annualGen * 100)}%)`, margin + 16, yPos + 3);
            
            pdf.setFillColor(245, 158, 11);
            pdf.rect(margin + 85, yPos, 12, 4, "F");
            pdf.text(`Grid export: ${Math.round(gridExport / 1000)} MWh`, margin + 101, yPos + 3);
            
            if (gridImport > 0) {
              pdf.setFillColor(156, 163, 175);
              pdf.rect(margin + 150, yPos, 12, 4, "F");
              pdf.text(`Grid import: ${Math.round(gridImport / 1000)} MWh`, margin + 166, yPos + 3);
            }
            break;

          case "monthly_yield":
            // 12-month generation forecast bar chart
            pdf.setFontSize(12);
            pdf.setTextColor(0, 0, 0);
            pdf.text("12-Month Solar Generation Forecast", margin, yPos);
            yPos += 15;

            const chartW = pageWidth - 2 * margin;
            const chartH = 90;
            const barAreaH = 70;
            
            // Monthly generation profile (typical for South Africa)
            const monthlyFactors = [1.1, 1.05, 0.95, 0.85, 0.75, 0.7, 0.72, 0.8, 0.9, 1.0, 1.05, 1.1];
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const annualKwh = (simulationData.solarCapacityKwp || 100) * 1600;
            const avgMonthly = annualKwh / 12;
            const monthlyGen = monthlyFactors.map(f => avgMonthly * f);
            const maxMonthly = Math.max(...monthlyGen);
            
            // Chart background
            pdf.setFillColor(250, 250, 250);
            pdf.rect(margin, yPos, chartW, barAreaH, "F");
            
            // Grid lines
            pdf.setDrawColor(230, 230, 230);
            pdf.setLineWidth(0.3);
            for (let i = 1; i <= 4; i++) {
              const gridY = yPos + barAreaH - (i / 4) * barAreaH;
              pdf.line(margin, gridY, margin + chartW, gridY);
            }

            // Draw bars
            const barW = (chartW - 24) / 12;
            const barGap = 2;
            
            monthlyGen.forEach((gen, i) => {
              const barH = (gen / maxMonthly) * (barAreaH - 10);
              const barX = margin + i * barW + barGap;
              const barY = yPos + barAreaH - barH;
              
              // Summer months (Oct-Mar) in green, winter (Apr-Sep) in lighter green
              const isSummer = i >= 9 || i <= 2;
              pdf.setFillColor(isSummer ? 34 : 74, isSummer ? 197 : 222, isSummer ? 94 : 128);
              pdf.roundedRect(barX, barY, barW - barGap * 2, barH, 1, 1, "F");
              
              // Value label on top
              if (i % 2 === 0) {
                pdf.setFontSize(6);
                pdf.setTextColor(100, 100, 100);
                pdf.text(`${Math.round(gen / 1000)}k`, barX + 2, barY - 2);
              }
            });

            // X-axis labels
            yPos += barAreaH + 3;
            pdf.setFontSize(7);
            pdf.setTextColor(80, 80, 80);
            monthNames.forEach((month, i) => {
              pdf.text(month, margin + i * barW + barW / 2 - 5, yPos + 5);
            });

            yPos += 15;

            // Summary stats
            pdf.setFillColor(240, 253, 244);
            pdf.roundedRect(margin, yPos, chartW / 3 - 5, 25, 3, 3, "F");
            pdf.setFontSize(10);
            pdf.setTextColor(22, 163, 74);
            pdf.text(`${Math.round(annualKwh / 1000).toLocaleString()} MWh`, margin + 8, yPos + 10);
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.text("Annual Generation", margin + 8, yPos + 18);

            pdf.setFillColor(254, 249, 195);
            pdf.roundedRect(margin + chartW / 3, yPos, chartW / 3 - 5, 25, 3, 3, "F");
            pdf.setFontSize(10);
            pdf.setTextColor(161, 98, 7);
            pdf.text(`${Math.round(avgMonthly / 1000)} MWh`, margin + chartW / 3 + 8, yPos + 10);
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.text("Monthly Average", margin + chartW / 3 + 8, yPos + 18);

            pdf.setFillColor(239, 246, 255);
            pdf.roundedRect(margin + 2 * chartW / 3, yPos, chartW / 3 - 5, 25, 3, 3, "F");
            pdf.setFontSize(10);
            pdf.setTextColor(37, 99, 235);
            pdf.text("1,600 kWh/kWp", margin + 2 * chartW / 3 + 5, yPos + 10);
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.text("Specific Yield", margin + 2 * chartW / 3 + 8, yPos + 18);

            yPos += 35;

            // Legend
            pdf.setFontSize(7);
            pdf.setFillColor(34, 197, 94);
            pdf.rect(margin, yPos, 8, 6, "F");
            pdf.text("Summer months (higher yield)", margin + 12, yPos + 5);
            pdf.setFillColor(74, 222, 128);
            pdf.rect(margin + 70, yPos, 8, 6, "F");
            pdf.text("Winter months (lower yield)", margin + 82, yPos + 5);
            break;

          case "sensitivity_analysis":
            // Sensitivity Analysis - ROI under different scenarios
            const baseSysCost = (simulationData.solarCapacityKwp || 100) * 12000;
            const baseAnnualSavings = simulationData.annualSavings || 250000;
            const basePayback = simulationData.paybackYears || 5;
            
            pdf.setFontSize(12);
            pdf.setTextColor(0, 0, 0);
            pdf.text("ROI Sensitivity Analysis", margin, yPos);
            yPos += 8;
            pdf.setFontSize(9);
            pdf.setTextColor(100, 100, 100);
            pdf.text("How payback period changes with different electricity escalation rates and system costs", margin, yPos);
            yPos += 15;

            // Electricity Escalation Impact
            pdf.setFontSize(11);
            pdf.setTextColor(0, 0, 0);
            pdf.text("Electricity Tariff Escalation Impact", margin, yPos);
            yPos += 10;

            const escalationRates = [0, 5, 10, 15, 20];
            const escBarWidth = (pageWidth - 2 * margin - 40) / escalationRates.length;
            const escBarMaxHeight = 50;
            
            // Calculate payback for each escalation rate
            const escPaybacks = escalationRates.map(rate => {
              if (rate === 0) return basePayback;
              // With escalation, savings grow each year, so payback is shorter
              let cumSavings = 0;
              let year = 0;
              let annualSave = baseAnnualSavings;
              while (cumSavings < baseSysCost && year < 25) {
                year++;
                cumSavings += annualSave;
                annualSave *= (1 + rate / 100);
              }
              return year + (baseSysCost - (cumSavings - annualSave)) / annualSave;
            });
            const maxEscPayback = Math.max(...escPaybacks, basePayback);

            // Draw bars
            escalationRates.forEach((rate, i) => {
              const paybackVal = escPaybacks[i];
              const barHeight = (paybackVal / maxEscPayback) * escBarMaxHeight;
              const barX = margin + i * escBarWidth;
              const barY = yPos + escBarMaxHeight - barHeight;
              
              // Color gradient - green for lower payback
              const greenIntensity = Math.max(0, 1 - paybackVal / maxEscPayback);
              pdf.setFillColor(
                Math.round(239 * (1 - greenIntensity) + 34 * greenIntensity),
                Math.round(68 * (1 - greenIntensity) + 197 * greenIntensity),
                Math.round(68 * (1 - greenIntensity) + 94 * greenIntensity)
              );
              pdf.roundedRect(barX + 5, barY, escBarWidth - 10, barHeight, 2, 2, "F");
              
              // Value on top
              pdf.setFontSize(8);
              pdf.setTextColor(0, 0, 0);
              pdf.text(`${paybackVal.toFixed(1)}y`, barX + escBarWidth / 2 - 6, barY - 3);
              
              // Label below
              pdf.setFontSize(7);
              pdf.setTextColor(100, 100, 100);
              pdf.text(`${rate}%`, barX + escBarWidth / 2 - 4, yPos + escBarMaxHeight + 8);
            });

            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.text("Annual tariff increase →", margin, yPos + escBarMaxHeight + 18);
            
            yPos += escBarMaxHeight + 30;

            // System Cost Impact
            pdf.setFontSize(11);
            pdf.setTextColor(0, 0, 0);
            pdf.text("System Cost Variation Impact", margin, yPos);
            yPos += 10;

            const costVariations = [-20, -10, 0, 10, 20];
            const costBarWidth = (pageWidth - 2 * margin - 40) / costVariations.length;
            
            // Calculate payback for each cost variation
            const costPaybacks = costVariations.map(pct => {
              const adjustedCost = baseSysCost * (1 + pct / 100);
              return adjustedCost / baseAnnualSavings;
            });
            const maxCostPayback = Math.max(...costPaybacks);

            // Draw bars
            costVariations.forEach((pct, i) => {
              const paybackVal = costPaybacks[i];
              const barHeight = (paybackVal / maxCostPayback) * escBarMaxHeight;
              const barX = margin + i * costBarWidth;
              const barY = yPos + escBarMaxHeight - barHeight;
              
              // Color - green for lower payback
              const greenIntensity = Math.max(0, 1 - paybackVal / maxCostPayback);
              pdf.setFillColor(
                Math.round(239 * (1 - greenIntensity) + 34 * greenIntensity),
                Math.round(68 * (1 - greenIntensity) + 197 * greenIntensity),
                Math.round(68 * (1 - greenIntensity) + 94 * greenIntensity)
              );
              pdf.roundedRect(barX + 5, barY, costBarWidth - 10, barHeight, 2, 2, "F");
              
              // Value on top
              pdf.setFontSize(8);
              pdf.setTextColor(0, 0, 0);
              pdf.text(`${paybackVal.toFixed(1)}y`, barX + costBarWidth / 2 - 6, barY - 3);
              
              // Label below
              pdf.setFontSize(7);
              pdf.setTextColor(pct === 0 ? 34 : 100, pct === 0 ? 197 : 100, pct === 0 ? 94 : 100);
              const label = pct === 0 ? "Base" : `${pct > 0 ? "+" : ""}${pct}%`;
              pdf.text(label, barX + costBarWidth / 2 - 8, yPos + escBarMaxHeight + 8);
            });

            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.text("System cost variation →", margin, yPos + escBarMaxHeight + 18);
            
            yPos += escBarMaxHeight + 30;

            // Summary insight box
            pdf.setFillColor(240, 253, 244);
            pdf.roundedRect(margin, yPos, pageWidth - 2 * margin, 30, 3, 3, "F");
            pdf.setDrawColor(34, 197, 94);
            pdf.roundedRect(margin, yPos, pageWidth - 2 * margin, 30, 3, 3, "S");
            
            pdf.setFontSize(9);
            pdf.setTextColor(22, 101, 52);
            pdf.text("Key Insight", margin + 8, yPos + 10);
            pdf.setFontSize(8);
            pdf.setTextColor(60, 60, 60);
            const escImpact = (escPaybacks[0] - escPaybacks[4]).toFixed(1);
            const costImpact = (costPaybacks[4] - costPaybacks[0]).toFixed(1);
            pdf.text(`A 20% tariff escalation reduces payback by ${escImpact} years. A 20% system cost reduction improves payback by ${costImpact} years.`, margin + 8, yPos + 22);
            break;

          case "engineering_specs":
            pdf.setFontSize(12);
            pdf.text("Technical Specifications", margin, yPos);
            yPos += 10;
            
            // System diagram
            const diagY = yPos;
            const diagHeight = 60;
            const boxWidth = 45;
            const boxHeight = 30;
            
            // PV Array box
            pdf.setFillColor(254, 249, 195);
            pdf.roundedRect(margin, diagY + 15, boxWidth, boxHeight, 3, 3, "F");
            pdf.setDrawColor(234, 179, 8);
            pdf.roundedRect(margin, diagY + 15, boxWidth, boxHeight, 3, 3, "S");
            pdf.setFontSize(8);
            pdf.setTextColor(0, 0, 0);
            pdf.text("PV Array", margin + 8, diagY + 28);
            pdf.setFontSize(10);
            pdf.setTextColor(161, 98, 7);
            pdf.text(`${simulationData.solarCapacityKwp}kWp`, margin + 8, diagY + 38);
            
            // Arrow
            pdf.setDrawColor(150, 150, 150);
            pdf.setLineWidth(1);
            pdf.line(margin + boxWidth + 5, diagY + 30, margin + boxWidth + 20, diagY + 30);
            pdf.triangle(margin + boxWidth + 20, diagY + 27, margin + boxWidth + 20, diagY + 33, margin + boxWidth + 25, diagY + 30, "F");
            
            // Inverter box
            const invX = margin + boxWidth + 30;
            pdf.setFillColor(239, 246, 255);
            pdf.roundedRect(invX, diagY + 15, boxWidth, boxHeight, 3, 3, "F");
            pdf.setDrawColor(59, 130, 246);
            pdf.roundedRect(invX, diagY + 15, boxWidth, boxHeight, 3, 3, "S");
            pdf.setFontSize(8);
            pdf.setTextColor(0, 0, 0);
            pdf.text("Inverter", invX + 10, diagY + 28);
            pdf.setFontSize(10);
            pdf.setTextColor(37, 99, 235);
            const inverterSize = Math.round((simulationData.solarCapacityKwp || 100) / (simulationData.dcAcRatio || 1.3));
            pdf.text(`${inverterSize}kW`, invX + 12, diagY + 38);
            
            // Arrow to grid/battery
            pdf.setDrawColor(150, 150, 150);
            pdf.line(invX + boxWidth + 5, diagY + 30, invX + boxWidth + 20, diagY + 30);
            
            // Battery box (if applicable)
            if (simulationData.batteryCapacityKwh > 0) {
              const batX = invX + boxWidth + 25;
              pdf.setFillColor(240, 253, 244);
              pdf.roundedRect(batX, diagY + 15, boxWidth, boxHeight, 3, 3, "F");
              pdf.setDrawColor(34, 197, 94);
              pdf.roundedRect(batX, diagY + 15, boxWidth, boxHeight, 3, 3, "S");
              pdf.setFontSize(8);
              pdf.setTextColor(0, 0, 0);
              pdf.text("Battery", batX + 10, diagY + 28);
              pdf.setFontSize(10);
              pdf.setTextColor(22, 163, 74);
              pdf.text(`${simulationData.batteryCapacityKwh}kWh`, batX + 6, diagY + 38);
            }
            
            yPos = diagY + diagHeight + 15;
            
            // Specs table with visual highlights
            autoTable(pdf, {
              startY: yPos,
              head: [["Component", "Specification", "Notes"]],
              body: [
                ["PV Array Size", `${simulationData.solarCapacityKwp} kWp`, "DC capacity"],
                ["DC/AC Ratio", `${(simulationData.dcAcRatio || 1.3).toFixed(2)}:1`, "Oversizing factor"],
                ["Inverter Capacity", `${inverterSize} kW`, "AC capacity"],
                ["Battery Storage", `${simulationData.batteryCapacityKwh} kWh`, "Usable capacity"],
                ["Performance Ratio", "80-82%", "Expected annual"],
                ["Specific Yield", "~1,600 kWh/kWp/yr", "South Africa avg"],
              ],
              theme: "striped",
              headStyles: { fillColor: [34, 197, 94] },
              margin: { left: margin, right: margin },
            });
            break;

          case "sizing_comparison":
            // Sizing Alternatives Comparison Table
            pdf.setFontSize(12);
            pdf.setTextColor(0, 0, 0);
            pdf.text("System Sizing Alternatives Comparison", margin, yPos);
            yPos += 8;
            pdf.setFontSize(9);
            pdf.setTextColor(100, 100, 100);
            pdf.text("Comparison of conservative, current, and aggressive system sizing options", margin, yPos);
            yPos += 12;

            // Calculate scenarios based on current system
            const currentKwp = simulationData.solarCapacityKwp || 100;
            const currentBattery = simulationData.batteryCapacityKwh || 50;
            const currentSavings = simulationData.annualSavings || 250000;
            const currentPayback = simulationData.paybackYears || 5;
            const costPerKwp = 12000; // R/kWp
            const batteryPerKwh = 6000; // R/kWh

            // Define scenarios
            const scenarios = [
              {
                name: "Conservative",
                description: "Lower upfront cost, reduced risk",
                solarKwp: Math.round(currentKwp * 0.7),
                batteryKwh: Math.round(currentBattery * 0.5),
                factor: 0.65,
              },
              {
                name: "Current Design",
                description: "Balanced performance and investment",
                solarKwp: currentKwp,
                batteryKwh: currentBattery,
                factor: 1.0,
              },
              {
                name: "Aggressive",
                description: "Maximum energy independence",
                solarKwp: Math.round(currentKwp * 1.35),
                batteryKwh: Math.round(currentBattery * 2),
                factor: 1.4,
              },
            ];

            // Scenario cards at top
            const scenarioCardWidth = (pageWidth - 2 * margin - 20) / 3;
            scenarios.forEach((scenario, i) => {
              const cardX = margin + i * (scenarioCardWidth + 10);
              const isCurrentScenario = scenario.name === "Current Design";
              
              // Card background
              pdf.setFillColor(isCurrentScenario ? 240 : 250, isCurrentScenario ? 253 : 250, isCurrentScenario ? 244 : 250);
              pdf.roundedRect(cardX, yPos, scenarioCardWidth, 50, 4, 4, "F");
              if (isCurrentScenario) {
                pdf.setDrawColor(34, 197, 94);
                pdf.setLineWidth(1.5);
                pdf.roundedRect(cardX, yPos, scenarioCardWidth, 50, 4, 4, "S");
              }
              
              // Scenario name
              pdf.setFontSize(11);
              pdf.setTextColor(isCurrentScenario ? 22 : 80, isCurrentScenario ? 163 : 80, isCurrentScenario ? 74 : 80);
              pdf.text(scenario.name, cardX + 8, yPos + 14);
              
              // Description
              pdf.setFontSize(7);
              pdf.setTextColor(120, 120, 120);
              pdf.text(scenario.description, cardX + 8, yPos + 24);
              
              // Solar capacity
              pdf.setFontSize(14);
              pdf.setTextColor(isCurrentScenario ? 34 : 100, isCurrentScenario ? 197 : 100, isCurrentScenario ? 94 : 100);
              pdf.text(`${scenario.solarKwp} kWp`, cardX + 8, yPos + 42);
            });

            yPos += 60;

            // Detailed comparison table
            const scenarioData = scenarios.map((s) => {
              const systemCost = s.solarKwp * costPerKwp + s.batteryKwh * batteryPerKwh;
              const annualSavingsScenario = Math.round(currentSavings * s.factor);
              const paybackYears = systemCost / annualSavingsScenario;
              const roi25yr = ((annualSavingsScenario * 25 - systemCost) / systemCost) * 100;
              const co2Avoided = Math.round(s.solarKwp * 1.2);
              
              return {
                ...s,
                systemCost,
                annualSavings: annualSavingsScenario,
                paybackYears,
                roi25yr,
                co2Avoided,
              };
            });

            autoTable(pdf, {
              startY: yPos,
              head: [["Metric", "Conservative", "Current Design", "Aggressive"]],
              body: [
                ["Solar Capacity", `${scenarioData[0].solarKwp} kWp`, `${scenarioData[1].solarKwp} kWp`, `${scenarioData[2].solarKwp} kWp`],
                ["Battery Storage", `${scenarioData[0].batteryKwh} kWh`, `${scenarioData[1].batteryKwh} kWh`, `${scenarioData[2].batteryKwh} kWh`],
                ["System Cost", `R${Math.round(scenarioData[0].systemCost / 1000)}k`, `R${Math.round(scenarioData[1].systemCost / 1000)}k`, `R${Math.round(scenarioData[2].systemCost / 1000)}k`],
                ["Annual Savings", `R${Math.round(scenarioData[0].annualSavings / 1000)}k`, `R${Math.round(scenarioData[1].annualSavings / 1000)}k`, `R${Math.round(scenarioData[2].annualSavings / 1000)}k`],
                ["Payback Period", `${scenarioData[0].paybackYears.toFixed(1)} yrs`, `${scenarioData[1].paybackYears.toFixed(1)} yrs`, `${scenarioData[2].paybackYears.toFixed(1)} yrs`],
                ["25-Year ROI", `${Math.round(scenarioData[0].roi25yr)}%`, `${Math.round(scenarioData[1].roi25yr)}%`, `${Math.round(scenarioData[2].roi25yr)}%`],
                ["CO₂ Avoided/yr", `${scenarioData[0].co2Avoided} tonnes`, `${scenarioData[1].co2Avoided} tonnes`, `${scenarioData[2].co2Avoided} tonnes`],
              ],
              theme: "grid",
              headStyles: { fillColor: [34, 197, 94], textColor: 255 },
              columnStyles: {
                0: { fontStyle: "bold", cellWidth: 35 },
                1: { halign: "center" },
                2: { halign: "center", fillColor: [240, 253, 244] },
                3: { halign: "center" },
              },
              margin: { left: margin, right: margin },
            });

            // Get final Y position after table
            const tableEndY = (pdf as any).lastAutoTable?.finalY || yPos + 70;

            // Key insight box
            pdf.setFillColor(239, 246, 255);
            pdf.roundedRect(margin, tableEndY + 10, pageWidth - 2 * margin, 25, 4, 4, "F");
            pdf.setFontSize(9);
            pdf.setTextColor(37, 99, 235);
            pdf.text("Recommendation", margin + 8, tableEndY + 22);
            pdf.setFontSize(8);
            pdf.setTextColor(60, 60, 60);
            const recText = `The Current Design offers the optimal balance between investment (R${Math.round(scenarioData[1].systemCost / 1000)}k) and returns (${scenarioData[1].paybackYears.toFixed(1)}-year payback). Consider the Aggressive option for maximum energy independence.`;
            const wrappedRec = pdf.splitTextToSize(recText, pageWidth - 2 * margin - 16);
            pdf.text(wrappedRec, margin + 8, tableEndY + 30);
            break;

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
                        projectDetails={projectDetails}
                        projectName={projectName}
                        aiNarratives={aiNarratives}
                        aiNarrativeEnabled={aiNarrativeEnabled}
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

// Preview content for each segment type - matches PDF infographics
function SegmentPreviewContent({ 
  segmentId, 
  simulationData,
  projectDetails,
  projectName,
  aiNarratives,
  aiNarrativeEnabled
}: { 
  segmentId: SegmentType; 
  simulationData: any;
  projectDetails?: any;
  projectName?: string;
  aiNarratives?: AIProposalNarrative;
  aiNarrativeEnabled?: boolean;
}) {
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
      
      // Check for AI narrative
      const aiSummary = aiNarrativeEnabled && aiNarratives?.executive_summary?.narrative;
      
      return (
        <div className="space-y-2 text-xs">
          {/* Project Overview - AI or Static */}
          {aiSummary ? (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg p-2 space-y-1 border border-emerald-200/50 dark:border-emerald-800/50">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[9px] text-emerald-700 dark:text-emerald-400">Executive Summary</p>
                <Badge variant="secondary" className="text-[6px] h-4 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                  <Wand2 className="h-2 w-2 mr-0.5" />
                  AI
                </Badge>
              </div>
              <p className="text-[7px] text-muted-foreground leading-relaxed line-clamp-6">
                {aiSummary}
              </p>
            </div>
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
      return (
        <div className="space-y-3">
          {/* Ratio scale with marker */}
          <div>
            <div className="flex items-center justify-between text-[9px] mb-1">
              <span>DC/AC Ratio</span>
              <span className="font-bold text-primary">{ratio.toFixed(2)}:1</span>
            </div>
            <div className="relative h-4 rounded-full overflow-hidden flex">
              <div className="flex-1 bg-emerald-500" />
              <div className="flex-1 bg-emerald-400" />
              <div className="flex-1 bg-amber-400" />
              <div className="flex-1 bg-red-500" />
            </div>
            {/* Marker */}
            <div className="relative h-3">
              <div 
                className="absolute -top-1 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-foreground"
                style={{ left: `${ratioPosition}%`, transform: "translateX(-50%)" }}
              />
            </div>
            <div className="grid grid-cols-4 text-[7px] text-center text-muted-foreground">
              <span>1.0</span>
              <span>1.15</span>
              <span>1.3</span>
              <span>1.6+</span>
            </div>
          </div>
          
          {/* Energy capture curve */}
          <div>
            <p className="text-[9px] font-medium mb-1">Daily Energy Capture</p>
            <div className="relative h-10 bg-muted/50 rounded overflow-hidden">
              {/* Inverter limit line */}
              <div className="absolute left-0 right-0 top-[30%] h-px bg-destructive" />
              {/* Solar curve */}
              <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
                <path
                  d={`M 0 40 Q 25 ${40 - ratio * 25} 50 ${40 - ratio * 28} Q 75 ${40 - ratio * 25} 100 40`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-primary"
                />
              </svg>
            </div>
            <div className="flex justify-between text-[7px] text-muted-foreground mt-0.5">
              <span>5:00</span>
              <span>12:00</span>
              <span>19:00</span>
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
      const lifetime25 = co2 * 25;
      
      return (
        <div className="space-y-3">
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
          
          {/* 25-year impact bar */}
          <div className="bg-emerald-100 dark:bg-emerald-950/40 rounded-lg p-2 text-center">
            <p className="text-[8px] text-muted-foreground">25-Year Lifetime Impact</p>
            <p className="text-sm font-bold text-emerald-600">{lifetime25.toLocaleString()} tonnes CO₂</p>
          </div>
        </div>
      );

    case "energy_flow":
      const annualGenFlow = (simulationData.solarCapacityKwp || 100) * 1600;
      const selfConsumeFlow = annualGenFlow * 0.65;
      const gridExportFlow = annualGenFlow * 0.35;
      
      return (
        <div className="space-y-2">
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
