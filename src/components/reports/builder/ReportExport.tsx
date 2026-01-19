import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Table, Loader2, CheckCircle, Image, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { pdfMake, COLORS, loadImageAsBase64, formatCurrency, defaultStyles } from "@/lib/pdfmake/pdfmakeConfig";
import { createBasicTable, createKeyValueTable, createCashflowTable, createMetricsGrid, createTOUTable, createSectionHeader, createComparisonTable, createMonthlyTable, createFinancialTable } from "@/lib/pdfmake/tables";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
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
  projectId?: string;
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

// Segment titles for display
const SEGMENT_TITLES: Record<SegmentType, string> = {
  executive_summary: "Executive Summary",
  dcac_comparison: "DC/AC Ratio Analysis",
  energy_flow: "Energy Flow Diagram",
  monthly_yield: "Monthly Yield Analysis",
  payback_timeline: "Payback Timeline",
  sensitivity_analysis: "Sensitivity Analysis",
  savings_breakdown: "Savings Breakdown",
  environmental_impact: "Environmental Impact",
  engineering_specs: "Engineering Specifications",
  ai_infographics: "AI Infographics",
  tariff_details: "Tariff Analysis",
  sizing_comparison: "Sizing Alternatives",
  custom_notes: "Notes & Annotations"
};

export function ReportExport({ 
  reportName, 
  segments, 
  branding, 
  reportData,
  projectId,
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

  const enabledSegments = segments.filter(s => s.enabled).sort((a, b) => a.order - b.order);

  const captureChart = useCallback(async (ref: React.RefObject<HTMLDivElement>): Promise<string | null> => {
    if (!ref.current) return null;
    try {
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

  // Fetch cached infographics from storage
  const fetchCachedInfographics = async (): Promise<Map<string, string>> => {
    const infographics = new Map<string, string>();
    if (!projectId) return infographics;

    const types = ["executive", "system", "savings", "environmental", "engineering"];
    
    for (const type of types) {
      const cacheKey = `${reportData.simulation.solar_capacity_kwp}-${reportData.simulation.battery_capacity_kwh}-${reportData.financials.annual_savings}-${type}`.replace(/\./g, '_');
      const filePath = `${projectId}/${cacheKey}.png`;
      
      const { data: urlData } = supabase.storage
        .from('report-infographics')
        .getPublicUrl(filePath);

      try {
        const response = await fetch(urlData.publicUrl, { method: 'HEAD' });
        if (response.ok) {
          infographics.set(type, urlData.publicUrl);
        }
      } catch {
        // Infographic not cached, skip
      }
    }

    return infographics;
  };

  const exportToPDF = async () => {
    setExporting("pdf");
    try {
      const primaryColor = branding?.primary_color || COLORS.primary;
      
      // Capture charts in parallel
      toast.info("Preparing report assets...");
      const [dcAcImage, monthlyImage, paybackImage, cachedInfographics] = await Promise.all([
        captureChart(dcAcChartRef),
        captureChart(monthlyChartRef),
        captureChart(paybackChartRef),
        fetchCachedInfographics(),
      ]);

      const chartImages: Record<string, string | null> = {
        dcac_comparison: dcAcImage,
        monthly_yield: monthlyImage,
        payback_timeline: paybackImage,
      };

      // Build document content
      const content: Content[] = [];

      // ========== COVER PAGE ==========
      content.push(
        {
          canvas: [
            {
              type: 'rect',
              x: 0,
              y: 0,
              w: 595,
              h: 80,
              color: COLORS.secondary,
            }
          ],
          absolutePosition: { x: 0, y: 0 }
        },
        {
          text: reportName || "Energy Analysis Report",
          fontSize: 28,
          bold: true,
          color: COLORS.white,
          margin: [0, 20, 0, 5],
        },
        {
          text: branding?.company_name || "Solar Energy Report",
          fontSize: 12,
          color: COLORS.white,
          margin: [0, 0, 0, 30],
        },
        {
          text: new Date().toLocaleDateString('en-ZA', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          fontSize: 10,
          color: COLORS.muted,
          margin: [0, 0, 0, 20],
        }
      );

      // Project summary card
      content.push(
        createSectionHeader("Project Overview"),
        createKeyValueTable([
          { key: "Site", value: reportData.project.name },
          { key: "Location", value: reportData.project.location || "Not specified" },
          { key: "Solar System", value: `${reportData.simulation.solar_capacity_kwp} kWp` },
          { key: "Battery", value: `${reportData.simulation.battery_capacity_kwh} kWh` },
        ]),
        { text: "", margin: [0, 10, 0, 0] }
      );

      // Table of Contents
      content.push(
        createSectionHeader("Report Contents"),
        {
          ul: enabledSegments.map((seg, idx) => ({
            text: `${idx + 1}. ${SEGMENT_TITLES[seg.type]}`,
            fontSize: 11,
            color: COLORS.secondary,
            margin: [0, 3, 0, 3] as [number, number, number, number],
          })),
          margin: [20, 0, 0, 20] as [number, number, number, number],
        }
      );

      // ========== SEGMENT PAGES ==========
      for (const segment of enabledSegments) {
        content.push({ text: '', pageBreak: 'before' });
        
        // Section header
        content.push(
          {
            canvas: [
              {
                type: 'rect',
                x: 0,
                y: 0,
                w: 595,
                h: 35,
                color: primaryColor,
              }
            ],
            absolutePosition: { x: 0, y: 0 }
          },
          {
            text: SEGMENT_TITLES[segment.type],
            fontSize: 16,
            bold: true,
            color: COLORS.white,
            margin: [0, 0, 0, 30],
          }
        );

        // Add chart image if available
        const chartImage = chartImages[segment.type];
        if (chartImage) {
          content.push({
            image: chartImage,
            width: 515,
            margin: [0, 10, 0, 15] as [number, number, number, number],
          });
        }

        // Render segment-specific content
        switch (segment.type) {
          case "executive_summary":
            content.push(...renderExecutiveSummary(reportData));
            break;
          case "dcac_comparison":
            content.push(...renderDcAcAnalysis(reportData));
            break;
          case "payback_timeline":
            content.push(...renderPaybackTimeline(reportData));
            break;
          case "engineering_specs":
            content.push(...renderEngineeringSpecs(reportData));
            break;
          case "environmental_impact":
            content.push(...renderEnvironmentalImpact(reportData));
            break;
          case "savings_breakdown":
            content.push(...renderSavingsBreakdown(reportData));
            break;
          case "monthly_yield":
            content.push(...renderMonthlyYield(reportData));
            break;
          case "tariff_details":
            content.push(...await renderTariffDetails(reportData, projectId));
            break;
          default:
            content.push({
              text: "Content for this segment type.",
              fontSize: 11,
              color: COLORS.muted,
              margin: [0, 10, 0, 10] as [number, number, number, number],
            });
        }
      }

      // Build PDF definition
      const docDefinition: TDocumentDefinitions = {
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 50],
        content,
        styles: defaultStyles,
        footer: (currentPage, pageCount) => ({
          columns: [
            {
              text: [
                branding?.contact_email,
                branding?.contact_phone,
                branding?.website
              ].filter(Boolean).join(" • ") || "Generated by Energy Analysis Platform",
              fontSize: 8,
              color: COLORS.muted,
              alignment: 'center',
            },
            {
              text: `Page ${currentPage} of ${pageCount}`,
              fontSize: 8,
              color: COLORS.muted,
              alignment: 'right',
              margin: [0, 0, 40, 0],
            }
          ],
          margin: [40, 10, 40, 0],
        }),
        info: {
          title: reportName || 'Energy Analysis Report',
          author: branding?.company_name || 'Energy Platform',
        },
      };

      pdfMake.createPdf(docDefinition).download(
        `${reportName || "Report"}_${new Date().toISOString().split('T')[0]}.pdf`
      );

      trackEvent('export_pdf', { metadata: { reportName, segmentCount: enabledSegments.length } });
      toast.success("Report exported as PDF");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    } finally {
      setExporting(null);
    }
  };

  // Render functions for each segment type
  function renderExecutiveSummary(data: ReportData): Content[] {
    return [
      createMetricsGrid([
        { label: "Solar Capacity", value: `${data.simulation.solar_capacity_kwp} kWp` },
        { label: "Annual Generation", value: `${data.simulation.annual_solar_generation_kwh.toLocaleString()} kWh` },
        { label: "Annual Savings", value: formatCurrency(data.financials.annual_savings) },
        { label: "Payback Period", value: `${data.financials.payback_years.toFixed(1)} years` },
      ]),
      {
        text: `This ${data.simulation.solar_capacity_kwp} kWp solar installation at ${data.project.name} is projected to generate ${data.simulation.annual_solar_generation_kwh.toLocaleString()} kWh annually. With a self-consumption rate of ${data.kpis.self_consumption_rate.toFixed(1)}% and grid independence of ${data.kpis.grid_independence.toFixed(1)}%, the system delivers estimated annual savings of ${formatCurrency(data.financials.annual_savings)} with a payback period of ${data.financials.payback_years.toFixed(1)} years.`,
        fontSize: 10,
        color: COLORS.secondary,
        margin: [0, 15, 0, 10] as [number, number, number, number],
        lineHeight: 1.4,
      },
    ];
  }

  function renderDcAcAnalysis(data: ReportData): Content[] {
    const dcAc = data.dcAcAnalysis;
    return [
      {
        text: `DC/AC Ratio: ${data.simulation.dc_ac_ratio}%`,
        fontSize: 11,
        bold: true,
        color: COLORS.secondary,
        margin: [0, 0, 0, 10] as [number, number, number, number],
      },
      createComparisonTable(
        ["Metric", "1:1 Baseline", "Oversized DC", "Difference"],
        [
          {
            metric: "Annual Production (kWh)",
            before: dcAc.baseline_annual_kwh.toLocaleString(),
            after: dcAc.oversized_annual_kwh.toLocaleString(),
            difference: `+${dcAc.net_gain_kwh.toLocaleString()}`,
          },
          {
            metric: "Clipping Loss (kWh)",
            before: "0",
            after: dcAc.clipping_loss_kwh.toLocaleString(),
            difference: `${dcAc.clipping_percent.toFixed(1)}%`,
          },
          {
            metric: "Additional Capture (kWh)",
            before: "0",
            after: dcAc.additional_capture_kwh.toLocaleString(),
            difference: "-",
          },
          {
            metric: "Net Gain",
            before: "-",
            after: "-",
            difference: `+${dcAc.net_gain_percent.toFixed(1)}%`,
          },
        ]
      ),
    ];
  }

  function renderPaybackTimeline(data: ReportData): Content[] {
    const fin = data.financials;
    return [
      createCashflowTable(
        fin.yearly_cashflows.slice(0, 15).map(cf => ({
          year: cf.year,
          cumulative_savings: cf.cumulative_savings,
          cumulative_cost: cf.cumulative_cost,
          net_position: cf.net_position,
        }))
      ),
      {
        text: `Breakeven at Year ${fin.payback_years.toFixed(1)} | 25-Year ROI: ${fin.roi_percent.toFixed(0)}%`,
        fontSize: 12,
        bold: true,
        color: COLORS.primary,
        margin: [0, 15, 0, 0] as [number, number, number, number],
      },
    ];
  }

  function renderEngineeringSpecs(data: ReportData): Content[] {
    const kpis = data.kpis;
    return [
      createBasicTable(
        ["Engineering KPI", "Value", "Description"],
        [
          ["Specific Yield", `${kpis.specific_yield.toFixed(0)} kWh/kWp`, "Energy per installed DC capacity"],
          ["Performance Ratio", `${kpis.performance_ratio.toFixed(1)}%`, "Actual vs theoretical output"],
          ["Capacity Factor", `${kpis.capacity_factor.toFixed(1)}%`, "Average vs peak capacity"],
          ["LCOE", `R ${kpis.lcoe.toFixed(2)}/kWh`, "Levelized cost of energy"],
          ["Self-Consumption Rate", `${kpis.self_consumption_rate.toFixed(1)}%`, "PV energy used on-site"],
          ["Solar Coverage", `${kpis.solar_coverage.toFixed(1)}%`, "Load met by PV"],
          ["Grid Independence", `${kpis.grid_independence.toFixed(1)}%`, "Load met by PV+battery"],
          ["Peak Shaving", `${kpis.peak_shaving_kw.toFixed(1)} kW`, "Peak demand reduction"],
        ]
      ),
    ];
  }

  function renderEnvironmentalImpact(data: ReportData): Content[] {
    const env = data.environmental;
    return [
      createKeyValueTable([
        { key: "CO₂ Emissions Avoided", value: `${env.co2_avoided_tons.toFixed(1)} tons` },
        { key: "Equivalent Trees Planted", value: `${env.trees_equivalent.toLocaleString()} trees` },
        { key: "Car Miles Avoided", value: `${env.car_miles_avoided.toLocaleString()} miles` },
        { key: "Homes Powered Equivalent", value: `${env.homes_powered_equivalent.toFixed(1)} homes` },
      ]),
      {
        text: `Grid emission factor: ${env.grid_emission_factor} kg CO₂/kWh (South African grid average)`,
        fontSize: 9,
        color: COLORS.muted,
        margin: [0, 10, 0, 0] as [number, number, number, number],
      },
    ];
  }

  function renderSavingsBreakdown(data: ReportData): Content[] {
    const fin = data.financials;
    return [
      createFinancialTable([
        { label: "System Cost", value: fin.system_cost, format: "currency" },
        { label: "Annual Grid Cost (Baseline)", value: fin.annual_grid_cost_baseline, format: "currency" },
        { label: "Annual Grid Cost (With Solar)", value: fin.annual_grid_cost_with_solar, format: "currency" },
        { label: "Annual Savings", value: fin.annual_savings, format: "currency" },
        { label: "Simple Payback", value: fin.payback_years, format: "years" },
        { label: "25-Year ROI", value: fin.roi_percent, format: "percentage" },
        { label: "NPV (Net Present Value)", value: fin.npv, format: "currency" },
        { label: "IRR (Internal Rate of Return)", value: fin.irr, format: "percentage" },
      ]),
    ];
  }

  function renderMonthlyYield(data: ReportData): Content[] {
    const monthly = data.dcAcAnalysis.monthly_comparison;
    return [
      createMonthlyTable(
        monthly.map(m => ({
          month: m.month,
          values: [
            m.baseline_kwh.toLocaleString(),
            m.oversized_kwh.toLocaleString(),
            `+${m.gain_percent.toFixed(1)}%`,
          ],
        })),
        ["Month", "Production (kWh)", "Oversized (kWh)", "Gain (%)"]
      ),
    ];
  }

  async function renderTariffDetails(data: ReportData, pId?: string): Promise<Content[]> {
    const content: Content[] = [];
    
    let tariffName = "Not specified";
    let tariffType = "N/A";
    let tariffFamily = "";
    let transmissionZone = "";
    let voltageLevel = "";
    let fixedCharges: { key: string; value: string }[] = [];
    let touRates: { season: string; period: string; rate: string; demand: string }[] = [];

    if (pId) {
      try {
        const { data: project } = await supabase
          .from("projects")
          .select("tariff_id")
          .eq("id", pId)
          .single();

        if (project?.tariff_id) {
          const { data: tariff } = await supabase
            .from("tariffs")
            .select(`
              name,
              tariff_type,
              tariff_family,
              transmission_zone,
              voltage_level,
              generation_capacity_charge,
              demand_charge_per_kva,
              network_access_charge,
              reactive_energy_charge,
              fixed_monthly_charge
            `)
            .eq("id", project.tariff_id)
            .single();

          if (tariff) {
            tariffName = tariff.name;
            tariffType = tariff.tariff_type || "N/A";
            tariffFamily = tariff.tariff_family || "";
            transmissionZone = tariff.transmission_zone || "";
            voltageLevel = tariff.voltage_level || "";

            if (tariff.generation_capacity_charge) {
              fixedCharges.push({ key: "Generation Capacity (GCC)", value: `R${tariff.generation_capacity_charge.toFixed(2)}/kVA` });
            }
            if (tariff.demand_charge_per_kva) {
              fixedCharges.push({ key: "Demand Charge", value: `R${tariff.demand_charge_per_kva.toFixed(2)}/kVA` });
            }
            if (tariff.network_access_charge) {
              fixedCharges.push({ key: "Network Access", value: `R${tariff.network_access_charge.toFixed(2)}` });
            }
            if (tariff.reactive_energy_charge) {
              fixedCharges.push({ key: "Reactive Energy", value: `R${tariff.reactive_energy_charge.toFixed(2)}/kVArh` });
            }
            if (tariff.fixed_monthly_charge) {
              fixedCharges.push({ key: "Fixed Monthly", value: `R${tariff.fixed_monthly_charge.toFixed(2)}` });
            }
          }

          const { data: touPeriods } = await supabase
            .from("tou_periods")
            .select("season, time_of_use, rate_per_kwh, demand_charge_per_kva")
            .eq("tariff_id", project.tariff_id)
            .order("season")
            .order("time_of_use");

          if (touPeriods && touPeriods.length > 0) {
            touRates = touPeriods.map(p => ({
              season: p.season,
              period: p.time_of_use,
              rate: `${(p.rate_per_kwh * 100).toFixed(2)}c`,
              demand: p.demand_charge_per_kva ? `R${p.demand_charge_per_kva.toFixed(2)}` : "-",
            }));
          }
        }
      } catch (error) {
        console.error("Error fetching tariff data:", error);
      }
    }

    content.push(
      {
        text: `Selected Tariff: ${tariffName}`,
        fontSize: 12,
        bold: true,
        color: COLORS.primary,
        margin: [0, 0, 0, 5] as [number, number, number, number],
      },
      {
        text: [tariffFamily, transmissionZone, voltageLevel].filter(Boolean).join(" • ") || `Type: ${tariffType}`,
        fontSize: 10,
        color: COLORS.muted,
        margin: [0, 0, 0, 15] as [number, number, number, number],
      }
    );

    if (fixedCharges.length > 0) {
      content.push(
        createSectionHeader("Fixed Monthly Charges"),
        createKeyValueTable(fixedCharges),
        { text: "", margin: [0, 10, 0, 0] }
      );
    }

    if (touRates.length > 0) {
      content.push(
        createSectionHeader("Time-of-Use Energy Rates"),
        createBasicTable(
          ["Season", "Period", "Energy Rate", "Demand"],
          touRates.map(r => [r.season, r.period, r.rate, r.demand])
        ),
        { text: "", margin: [0, 10, 0, 0] }
      );
    }

    // TOU Period Definitions - use basic table for custom layout
    content.push(
      createSectionHeader("TOU Period Definitions (FY2026)"),
      createBasicTable(
        ["Period", "Weekday Hours", "Saturday", "Sunday"],
        [
          ["Peak", "06:00-08:00, 18:00-21:00", "07:00-12:00, 18:00-20:00", "None"],
          ["Standard", "08:00-18:00, 21:00-22:00", "12:00-18:00, 20:00-22:00", "18:00-21:00"],
          ["Off-Peak", "22:00-06:00", "22:00-07:00", "21:00-18:00 (all other)"],
        ]
      ),
      {
        text: "⚡ Solar Impact: System generates during Peak hours (06:00-08:00, 18:00-21:00), offsetting the highest-cost energy periods.",
        fontSize: 10,
        italics: true,
        color: COLORS.primary,
        margin: [0, 15, 0, 0] as [number, number, number, number],
      }
    );

    return content;
  }

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
