import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Table, Loader2, CheckCircle, Image, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { useReportAnalytics } from "@/hooks/useReportAnalytics";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
} from "recharts";
import type { ReportData, ReportBranding, ReportSegment, SegmentType } from "../types";

interface ReportExportProps {
  reportName: string;
  segments: ReportSegment[];
  branding?: ReportBranding;
  reportData: ReportData;
  disabled?: boolean;
}

// Hidden chart components for PDF capture
function HiddenDcAcChart({ data, chartRef }: { data: ReportData; chartRef: React.RefObject<HTMLDivElement> }) {
  return (
    <div 
      ref={chartRef} 
      style={{ 
        position: 'absolute', 
        left: '-9999px', 
        width: '600px', 
        height: '300px',
        backgroundColor: 'white',
        padding: '16px'
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.dcAcAnalysis.hourly_comparison}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} stroke="#6b7280" fontSize={10} />
          <YAxis stroke="#6b7280" fontSize={10} />
          <Legend wrapperStyle={{ fontSize: '10px' }} />
          <Area
            type="monotone"
            dataKey="baseline_kw"
            name="1:1 Baseline"
            stroke="#9ca3af"
            fill="#e5e7eb"
            strokeDasharray="5 5"
          />
          <Area
            type="monotone"
            dataKey="oversized_ac_kw"
            name="AC Output"
            stroke="#22c55e"
            fill="#22c55e"
            fillOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey="clipping_kw"
            name="Clipping"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function HiddenMonthlyChart({ data, chartRef }: { data: ReportData; chartRef: React.RefObject<HTMLDivElement> }) {
  return (
    <div 
      ref={chartRef} 
      style={{ 
        position: 'absolute', 
        left: '-9999px', 
        width: '600px', 
        height: '300px',
        backgroundColor: 'white',
        padding: '16px'
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.dcAcAnalysis.monthly_comparison}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" stroke="#6b7280" fontSize={10} />
          <YAxis stroke="#6b7280" fontSize={10} />
          <Legend wrapperStyle={{ fontSize: '10px' }} />
          <Bar dataKey="baseline_kwh" name="Baseline" fill="#9ca3af" />
          <Bar dataKey="oversized_kwh" name="Oversized" fill="#22c55e" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HiddenPaybackChart({ data, chartRef }: { data: ReportData; chartRef: React.RefObject<HTMLDivElement> }) {
  return (
    <div 
      ref={chartRef} 
      style={{ 
        position: 'absolute', 
        left: '-9999px', 
        width: '600px', 
        height: '300px',
        backgroundColor: 'white',
        padding: '16px'
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.financials.yearly_cashflows.slice(0, 15)}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" stroke="#6b7280" fontSize={10} />
          <YAxis 
            stroke="#6b7280" 
            fontSize={10}
            tickFormatter={(v) => `R${(v / 1000000).toFixed(1)}M`}
          />
          <Legend wrapperStyle={{ fontSize: '10px' }} />
          <Line
            type="monotone"
            dataKey="cumulative_savings"
            name="Cumulative Savings"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="cumulative_cost"
            name="System Cost"
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReportExport({ 
  reportName, 
  segments, 
  branding, 
  reportData,
  disabled 
}: ReportExportProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const { trackEvent } = useReportAnalytics();
  
  // Refs for chart capture
  const dcAcChartRef = useRef<HTMLDivElement>(null);
  const monthlyChartRef = useRef<HTMLDivElement>(null);
  const paybackChartRef = useRef<HTMLDivElement>(null);

  // Track view on mount
  useEffect(() => {
    trackEvent('view', { metadata: { reportName } });
  }, []);

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 34, g: 197, b: 94 };
  };

  const enabledSegments = segments.filter(s => s.enabled).sort((a, b) => a.order - b.order);

  const captureChart = useCallback(async (ref: React.RefObject<HTMLDivElement>): Promise<string | null> => {
    if (!ref.current) return null;
    try {
      // Wait for recharts to render
      await new Promise(resolve => setTimeout(resolve, 100));
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Chart capture error:', error);
      return null;
    }
  }, []);

  const exportToPDF = async () => {
    setExporting("pdf");
    try {
      const primaryColor = branding?.primary_color || "#22c55e";
      const secondaryColor = branding?.secondary_color || "#0f172a";
      const primary = hexToRgb(primaryColor);
      const secondary = hexToRgb(secondaryColor);
      
      // Capture charts first
      toast.info("Capturing charts...");
      const [dcAcImage, monthlyImage, paybackImage] = await Promise.all([
        captureChart(dcAcChartRef),
        captureChart(monthlyChartRef),
        captureChart(paybackChartRef),
      ]);

      const chartImages: Record<string, string | null> = {
        dcac_comparison: dcAcImage,
        monthly_yield: monthlyImage,
        payback_timeline: paybackImage,
      };

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;

      // ========== COVER PAGE ==========
      doc.setFillColor(secondary.r, secondary.g, secondary.b);
      doc.rect(0, 0, pageWidth, 60, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text(reportName || "Energy Analysis Report", 20, 35);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`${branding?.company_name || "Solar Energy Report"}`, 20, 50);

      doc.setTextColor(200, 200, 200);
      doc.setFontSize(10);
      doc.text(new Date().toLocaleDateString('en-ZA', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }), pageWidth - 60, 35);

      doc.setTextColor(0, 0, 0);
      yPos = 80;

      // Project Summary Card
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(20, yPos, pageWidth - 40, 45, 3, 3, 'F');
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text("Project Overview", 30, yPos + 12);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(`Site: ${reportData.project.name}`, 30, yPos + 25);
      doc.text(`Location: ${reportData.project.location || 'Not specified'}`, 30, yPos + 35);
      doc.text(`System: ${reportData.simulation.solar_capacity_kwp} kWp Solar`, pageWidth / 2, yPos + 25);
      doc.text(`Battery: ${reportData.simulation.battery_capacity_kwh} kWh`, pageWidth / 2, yPos + 35);
      
      yPos += 60;

      // ========== TABLE OF CONTENTS ==========
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text("Report Contents", 20, yPos);
      yPos += 10;

      const segmentNames: Record<SegmentType, string> = {
        executive_summary: "Executive Summary",
        dcac_comparison: "DC/AC Ratio Analysis",
        energy_flow: "Energy Flow Diagram",
        monthly_yield: "Monthly Yield Analysis",
        payback_timeline: "Payback Timeline",
        savings_breakdown: "Savings Breakdown",
        environmental_impact: "Environmental Impact",
        engineering_specs: "Engineering Specifications",
        custom_notes: "Notes & Annotations"
      };

      enabledSegments.forEach((segment, index) => {
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        doc.text(`${index + 1}. ${segmentNames[segment.type]}`, 30, yPos);
        doc.text(`Page ${index + 2}`, pageWidth - 40, yPos);
        yPos += 8;
      });

      // ========== SEGMENT PAGES ==========
      for (const segment of enabledSegments) {
        doc.addPage();
        yPos = 20;

        // Section header
        doc.setFillColor(primary.r, primary.g, primary.b);
        doc.rect(0, 0, pageWidth, 25, 'F');
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(segmentNames[segment.type], 20, 16);

        doc.setTextColor(0, 0, 0);
        yPos = 40;

        // Add chart image if available for this segment
        const chartImage = chartImages[segment.type];
        if (chartImage) {
          const imgWidth = pageWidth - 40;
          const imgHeight = imgWidth * 0.5; // 2:1 aspect ratio
          doc.addImage(chartImage, 'PNG', 20, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 15;
        }

        // Render segment content based on type
        switch (segment.type) {
          case "executive_summary":
            renderExecutiveSummary(doc, reportData, primary, yPos);
            break;
          case "dcac_comparison":
            renderDcAcAnalysis(doc, reportData, primary, yPos);
            break;
          case "payback_timeline":
            renderPaybackTimeline(doc, reportData, primary, yPos);
            break;
          case "engineering_specs":
            renderEngineeringSpecs(doc, reportData, primary, yPos);
            break;
          case "environmental_impact":
            renderEnvironmentalImpact(doc, reportData, primary, yPos);
            break;
          case "savings_breakdown":
            renderSavingsBreakdown(doc, reportData, primary, yPos);
            break;
          case "monthly_yield":
            renderMonthlyYield(doc, reportData, primary, yPos);
            break;
          default:
            doc.setFontSize(11);
            doc.setTextColor(100, 100, 100);
            doc.text("Content placeholder for this segment type.", 20, yPos);
        }
      }

      // ========== FOOTER ON ALL PAGES ==========
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(secondary.r, secondary.g, secondary.b);
        doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
        
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        const footerText = [
          branding?.contact_email,
          branding?.contact_phone,
          branding?.website
        ].filter(Boolean).join(" • ") || "Generated by Energy Analysis Platform";
        doc.text(footerText, pageWidth / 2, pageHeight - 4, { align: 'center' });
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 25, pageHeight - 4);
      }

      doc.save(`${reportName || "Report"}_${new Date().toISOString().split('T')[0]}.pdf`);
      trackEvent('export_pdf', { metadata: { reportName, segmentCount: enabledSegments.length } });
      toast.success("Report exported as PDF with charts");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    } finally {
      setExporting(null);
    }
  };

  const renderExecutiveSummary = (doc: jsPDF, data: ReportData, primary: { r: number; g: number; b: number }, yPos: number) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Key metrics grid
    const metrics = [
      { label: "Solar Capacity", value: `${data.simulation.solar_capacity_kwp} kWp` },
      { label: "Annual Generation", value: `${data.simulation.annual_solar_generation_kwh.toLocaleString()} kWh` },
      { label: "Annual Savings", value: `R ${data.financials.annual_savings.toLocaleString()}` },
      { label: "Payback Period", value: `${data.financials.payback_years.toFixed(1)} years` },
    ];

    const cardWidth = (pageWidth - 50) / 2;
    metrics.forEach((metric, i) => {
      const x = 20 + (i % 2) * (cardWidth + 10);
      const y = yPos + Math.floor(i / 2) * 35;
      
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(x, y, cardWidth, 30, 2, 2, 'F');
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(metric.label, x + 10, y + 12);
      
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primary.r, primary.g, primary.b);
      doc.text(metric.value, x + 10, y + 24);
    });

    // Summary text
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const summaryText = `This ${data.simulation.solar_capacity_kwp} kWp solar installation at ${data.project.name} is projected to generate ${data.simulation.annual_solar_generation_kwh.toLocaleString()} kWh annually. With a self-consumption rate of ${data.kpis.self_consumption_rate.toFixed(1)}% and grid independence of ${data.kpis.grid_independence.toFixed(1)}%, the system delivers estimated annual savings of R${data.financials.annual_savings.toLocaleString()} with a payback period of ${data.financials.payback_years.toFixed(1)} years.`;
    
    const splitText = doc.splitTextToSize(summaryText, pageWidth - 40);
    doc.text(splitText, 20, yPos + 85);
  };

  const renderDcAcAnalysis = (doc: jsPDF, data: ReportData, primary: { r: number; g: number; b: number }, yPos: number) => {
    const dcAc = data.dcAcAnalysis;
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(`DC/AC Ratio: ${data.simulation.dc_ac_ratio}%`, 20, yPos);
    yPos += 15;

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', '1:1 Baseline', 'Oversized DC', 'Difference']],
      body: [
        ['Annual Production (kWh)', dcAc.baseline_annual_kwh.toLocaleString(), dcAc.oversized_annual_kwh.toLocaleString(), `+${dcAc.net_gain_kwh.toLocaleString()}`],
        ['Clipping Loss (kWh)', '0', dcAc.clipping_loss_kwh.toLocaleString(), `${dcAc.clipping_percent.toFixed(1)}%`],
        ['Additional Capture (kWh)', '0', dcAc.additional_capture_kwh.toLocaleString(), '-'],
        ['Net Gain', '-', '-', `+${dcAc.net_gain_percent.toFixed(1)}%`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [primary.r, primary.g, primary.b], textColor: [255, 255, 255] },
      styles: { fontSize: 10 },
      margin: { left: 20, right: 20 },
    });
  };

  const renderPaybackTimeline = (doc: jsPDF, data: ReportData, primary: { r: number; g: number; b: number }, yPos: number) => {
    const fin = data.financials;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Year', 'Cumulative Savings (R)', 'Net Position (R)', 'Status']],
      body: fin.yearly_cashflows.slice(0, 15).map(cf => [
        cf.year.toString(),
        cf.cumulative_savings.toLocaleString(),
        cf.net_position.toLocaleString(),
        cf.net_position >= 0 ? '✓ Profit' : 'Investment'
      ]),
      theme: 'striped',
      headStyles: { fillColor: [primary.r, primary.g, primary.b], textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
      margin: { left: 20, right: 20 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primary.r, primary.g, primary.b);
    doc.text(`Breakeven at Year ${fin.payback_years.toFixed(1)} | 25-Year ROI: ${fin.roi_percent.toFixed(0)}%`, 20, finalY);
  };

  const renderEngineeringSpecs = (doc: jsPDF, data: ReportData, primary: { r: number; g: number; b: number }, yPos: number) => {
    const kpis = data.kpis;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Engineering KPI', 'Value', 'Description']],
      body: [
        ['Specific Yield', `${kpis.specific_yield.toFixed(0)} kWh/kWp`, 'Energy per installed DC capacity'],
        ['Performance Ratio', `${kpis.performance_ratio.toFixed(1)}%`, 'Actual vs theoretical output'],
        ['Capacity Factor', `${kpis.capacity_factor.toFixed(1)}%`, 'Average vs peak capacity'],
        ['LCOE', `R ${kpis.lcoe.toFixed(2)}/kWh`, 'Levelized cost of energy'],
        ['Self-Consumption Rate', `${kpis.self_consumption_rate.toFixed(1)}%`, 'PV energy used on-site'],
        ['Solar Coverage', `${kpis.solar_coverage.toFixed(1)}%`, 'Load met by PV'],
        ['Grid Independence', `${kpis.grid_independence.toFixed(1)}%`, 'Load met by PV+battery'],
        ['Peak Shaving', `${kpis.peak_shaving_kw.toFixed(1)} kW`, 'Peak demand reduction'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [primary.r, primary.g, primary.b], textColor: [255, 255, 255] },
      styles: { fontSize: 10 },
      margin: { left: 20, right: 20 },
    });
  };

  const renderEnvironmentalImpact = (doc: jsPDF, data: ReportData, primary: { r: number; g: number; b: number }, yPos: number) => {
    const env = data.environmental;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Environmental Metric', 'Annual Impact']],
      body: [
        ['CO₂ Emissions Avoided', `${env.co2_avoided_tons.toFixed(1)} tons`],
        ['Equivalent Trees Planted', `${env.trees_equivalent.toLocaleString()} trees`],
        ['Car Miles Avoided', `${env.car_miles_avoided.toLocaleString()} miles`],
        ['Homes Powered Equivalent', `${env.homes_powered_equivalent.toFixed(1)} homes`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [primary.r, primary.g, primary.b], textColor: [255, 255, 255] },
      styles: { fontSize: 11 },
      margin: { left: 20, right: 20 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Grid emission factor: ${env.grid_emission_factor} kg CO₂/kWh (South African grid average)`, 20, finalY);
  };

  const renderSavingsBreakdown = (doc: jsPDF, data: ReportData, primary: { r: number; g: number; b: number }, yPos: number) => {
    const fin = data.financials;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Financial Metric', 'Value']],
      body: [
        ['System Cost', `R ${fin.system_cost.toLocaleString()}`],
        ['Annual Grid Cost (Baseline)', `R ${fin.annual_grid_cost_baseline.toLocaleString()}`],
        ['Annual Grid Cost (With Solar)', `R ${fin.annual_grid_cost_with_solar.toLocaleString()}`],
        ['Annual Savings', `R ${fin.annual_savings.toLocaleString()}`],
        ['Simple Payback', `${fin.payback_years.toFixed(1)} years`],
        ['25-Year ROI', `${fin.roi_percent.toFixed(0)}%`],
        ['NPV (Net Present Value)', `R ${fin.npv.toLocaleString()}`],
        ['IRR (Internal Rate of Return)', `${fin.irr.toFixed(1)}%`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [primary.r, primary.g, primary.b], textColor: [255, 255, 255] },
      styles: { fontSize: 11 },
      margin: { left: 20, right: 20 },
    });
  };

  const renderMonthlyYield = (doc: jsPDF, data: ReportData, primary: { r: number; g: number; b: number }, yPos: number) => {
    const monthly = data.dcAcAnalysis.monthly_comparison;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Month', 'Production (kWh)', 'Oversized (kWh)', 'Gain (%)']],
      body: monthly.map(m => [
        m.month,
        m.baseline_kwh.toLocaleString(),
        m.oversized_kwh.toLocaleString(),
        `+${m.gain_percent.toFixed(1)}%`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [primary.r, primary.g, primary.b], textColor: [255, 255, 255] },
      styles: { fontSize: 10 },
      margin: { left: 20, right: 20 },
    });
  };

  const exportToExcel = () => {
    setExporting("excel");
    try {
      const sections: (string | number)[][] = [];

      // Header
      sections.push(["=== ENERGY ANALYSIS REPORT ==="]);
      sections.push([`Report: ${reportName}`]);
      sections.push([`Company: ${branding?.company_name || "N/A"}`]);
      sections.push([`Generated: ${new Date().toLocaleDateString('en-ZA')}`]);
      sections.push([]);

      // Project Summary
      sections.push(["=== PROJECT SUMMARY ==="]);
      sections.push(["Site Name", reportData.project.name]);
      sections.push(["Location", reportData.project.location || ""]);
      sections.push(["Total Area (m²)", reportData.project.total_area_sqm]);
      sections.push(["Connection Size (kVA)", reportData.project.connection_size_kva || ""]);
      sections.push(["Tenant Count", reportData.project.tenant_count]);
      sections.push([]);

      // System Configuration
      sections.push(["=== SYSTEM CONFIGURATION ==="]);
      sections.push(["Solar Capacity (kWp)", reportData.simulation.solar_capacity_kwp]);
      sections.push(["Battery Capacity (kWh)", reportData.simulation.battery_capacity_kwh]);
      sections.push(["Battery Power (kW)", reportData.simulation.battery_power_kw]);
      sections.push(["DC/AC Ratio (%)", reportData.simulation.dc_ac_ratio]);
      sections.push([]);

      // Energy Production
      sections.push(["=== ENERGY PRODUCTION ==="]);
      sections.push(["Annual Solar Generation (kWh)", reportData.simulation.annual_solar_generation_kwh]);
      sections.push(["Annual Consumption (kWh)", reportData.simulation.annual_consumption_kwh]);
      sections.push(["Self-Consumption (kWh)", reportData.simulation.self_consumption_kwh]);
      sections.push(["Grid Import (kWh)", reportData.simulation.grid_import_kwh]);
      sections.push(["Grid Export (kWh)", reportData.simulation.grid_export_kwh]);
      sections.push([]);

      // Engineering KPIs
      sections.push(["=== ENGINEERING KPIs ==="]);
      sections.push(["Specific Yield (kWh/kWp)", reportData.kpis.specific_yield]);
      sections.push(["Performance Ratio (%)", reportData.kpis.performance_ratio]);
      sections.push(["Capacity Factor (%)", reportData.kpis.capacity_factor]);
      sections.push(["LCOE (R/kWh)", reportData.kpis.lcoe]);
      sections.push(["Self-Consumption Rate (%)", reportData.kpis.self_consumption_rate]);
      sections.push(["Solar Coverage (%)", reportData.kpis.solar_coverage]);
      sections.push(["Grid Independence (%)", reportData.kpis.grid_independence]);
      sections.push(["Peak Shaving (kW)", reportData.kpis.peak_shaving_kw]);
      sections.push([]);

      // DC/AC Analysis
      sections.push(["=== DC/AC RATIO ANALYSIS ==="]);
      sections.push(["Baseline Annual (kWh)", reportData.dcAcAnalysis.baseline_annual_kwh]);
      sections.push(["Oversized Annual (kWh)", reportData.dcAcAnalysis.oversized_annual_kwh]);
      sections.push(["Clipping Loss (kWh)", reportData.dcAcAnalysis.clipping_loss_kwh]);
      sections.push(["Additional Capture (kWh)", reportData.dcAcAnalysis.additional_capture_kwh]);
      sections.push(["Net Gain (kWh)", reportData.dcAcAnalysis.net_gain_kwh]);
      sections.push(["Net Gain (%)", reportData.dcAcAnalysis.net_gain_percent]);
      sections.push([]);

      // Financial Summary
      sections.push(["=== FINANCIAL SUMMARY ==="]);
      sections.push(["System Cost (R)", reportData.financials.system_cost]);
      sections.push(["Annual Grid Cost Baseline (R)", reportData.financials.annual_grid_cost_baseline]);
      sections.push(["Annual Grid Cost With Solar (R)", reportData.financials.annual_grid_cost_with_solar]);
      sections.push(["Annual Savings (R)", reportData.financials.annual_savings]);
      sections.push(["Payback Period (years)", reportData.financials.payback_years]);
      sections.push(["ROI (%)", reportData.financials.roi_percent]);
      sections.push(["NPV (R)", reportData.financials.npv]);
      sections.push(["IRR (%)", reportData.financials.irr]);
      sections.push([]);

      // Environmental Impact
      sections.push(["=== ENVIRONMENTAL IMPACT ==="]);
      sections.push(["CO2 Avoided (tons/year)", reportData.environmental.co2_avoided_tons]);
      sections.push(["Equivalent Trees", reportData.environmental.trees_equivalent]);
      sections.push(["Car Miles Avoided", reportData.environmental.car_miles_avoided]);
      sections.push(["Homes Powered Equivalent", reportData.environmental.homes_powered_equivalent]);
      sections.push([]);

      // Monthly Yield Data
      sections.push(["=== MONTHLY YIELD DATA ==="]);
      sections.push(["Month", "Baseline (kWh)", "Oversized (kWh)", "Gain (kWh)", "Gain (%)"]);
      reportData.dcAcAnalysis.monthly_comparison.forEach(m => {
        sections.push([m.month, m.baseline_kwh, m.oversized_kwh, m.gain_kwh, m.gain_percent]);
      });
      sections.push([]);

      // Yearly Cashflow
      sections.push(["=== YEARLY CASHFLOW PROJECTION ==="]);
      sections.push(["Year", "Cumulative Savings (R)", "Cumulative Cost (R)", "Net Position (R)"]);
      reportData.financials.yearly_cashflows.forEach(cf => {
        sections.push([cf.year, cf.cumulative_savings, cf.cumulative_cost, cf.net_position]);
      });

      const csvContent = sections
        .map(row => row.map(cell => 
          typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
        ).join(","))
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${reportName || "Report"}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      trackEvent('export_excel', { metadata: { reportName } });
      toast.success("Report exported to Excel (CSV)");
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Failed to export Excel");
    } finally {
      setExporting(null);
    }
  };

  const exportToGoogleSheets = async () => {
    setExporting("sheets");
    try {
      toast.info("Exporting to Google Sheets...");
      
      const { data, error } = await supabase.functions.invoke('export-to-google-sheets', {
        body: {
          reportName: reportName || "Energy Report",
          reportData,
        },
      });

      if (error) throw error;

      if (data?.spreadsheetUrl) {
        trackEvent('export_sheets', { metadata: { reportName, spreadsheetUrl: data.spreadsheetUrl } });
        toast.success("Report exported to Google Sheets!", {
          action: {
            label: "Open",
            onClick: () => window.open(data.spreadsheetUrl, '_blank'),
          },
        });
      } else {
        throw new Error("No spreadsheet URL returned");
      }
    } catch (error: any) {
      console.error("Google Sheets export error:", error);
      toast.error(error.message || "Failed to export to Google Sheets");
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      {/* Hidden chart containers for PDF capture */}
      <HiddenDcAcChart data={reportData} chartRef={dcAcChartRef} />
      <HiddenMonthlyChart data={reportData} chartRef={monthlyChartRef} />
      <HiddenPaybackChart data={reportData} chartRef={paybackChartRef} />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Export Report</CardTitle>
          </div>
          <CardDescription>
            Download your report with visual charts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <CheckCircle className="h-4 w-4 text-primary" />
            <span>{enabledSegments.length} segments selected</span>
            <span className="text-muted-foreground">•</span>
            <Image className="h-4 w-4" />
            <span>Charts included</span>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={exportToPDF}
              disabled={disabled || exporting !== null}
              className="w-full"
            >
              {exporting === "pdf" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              PDF
            </Button>
            <Button
              variant="outline"
              onClick={exportToExcel}
              disabled={disabled || exporting !== null}
              className="w-full"
            >
              {exporting === "excel" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Table className="mr-2 h-4 w-4" />
              )}
              Excel
            </Button>
            <Button
              variant="outline"
              onClick={exportToGoogleSheets}
              disabled={disabled || exporting !== null}
              className="w-full"
            >
              {exporting === "sheets" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Sheets
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground space-y-1 mt-2">
            <p><strong>PDF:</strong> Cover page, TOC, visual charts</p>
            <p><strong>Excel:</strong> Spreadsheet format (offline)</p>
            <p><strong>Sheets:</strong> Export to Google Sheets</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
