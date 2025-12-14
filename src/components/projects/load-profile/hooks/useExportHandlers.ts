import { useCallback, RefObject } from "react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { ChartDataPoint, DayOfWeek, getTOUPeriod, TOU_COLORS } from "../types";

interface UseExportHandlersProps {
  chartData: ChartDataPoint[];
  unit: string;
  showPVProfile: boolean;
  showBattery: boolean;
  selectedDay: DayOfWeek;
  isWeekend: boolean;
  totalDaily: number;
  peakHour: { val: number; hour: number };
  loadFactor: number;
  tenantsCount: number;
  tenantsWithScada: number;
  tenantsEstimated: number;
  chartRef: RefObject<HTMLDivElement>;
}

export function useExportHandlers({
  chartData,
  unit,
  showPVProfile,
  showBattery,
  selectedDay,
  isWeekend,
  totalDaily,
  peakHour,
  loadFactor,
  tenantsCount,
  tenantsWithScada,
  tenantsEstimated,
  chartRef,
}: UseExportHandlersProps) {
  const exportToCSV = useCallback(() => {
    const headers = ["Hour", `Load (${unit})`];
    if (showPVProfile) {
      headers.push("PV Generation", "Grid Import", "Grid Export", "Net Load");
    }
    if (showBattery) {
      headers.push("Battery Charge", "Battery Discharge", "Battery SoC");
    }
    headers.push("TOU Period");

    const rows = chartData.map((d, i) => {
      const row = [d.hour, d.total.toFixed(2)];
      if (showPVProfile) {
        row.push(
          (d.pvGeneration || 0).toFixed(2),
          (d.gridImport || 0).toFixed(2),
          (d.gridExport || 0).toFixed(2),
          (d.netLoad || 0).toFixed(2)
        );
      }
      if (showBattery) {
        row.push(
          (d.batteryCharge || 0).toFixed(2),
          (d.batteryDischarge || 0).toFixed(2),
          (d.batterySoC || 0).toFixed(2)
        );
      }
      row.push(TOU_COLORS[getTOUPeriod(i, isWeekend)].label);
      return row;
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `load-profile-${selectedDay.toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  }, [chartData, unit, showPVProfile, showBattery, selectedDay, isWeekend]);

  const exportToPDF = useCallback(() => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to export PDF");
      return;
    }

    const tableRows = chartData
      .map((d, i) => {
        const period = getTOUPeriod(i, isWeekend);
        return `
        <tr>
          <td style="padding: 4px 8px; border-bottom: 1px solid #eee;">${d.hour}</td>
          <td style="padding: 4px 8px; border-bottom: 1px solid #eee; text-align: right;">${d.total.toFixed(1)}</td>
          ${showPVProfile ? `<td style="padding: 4px 8px; border-bottom: 1px solid #eee; text-align: right;">${(d.pvGeneration || 0).toFixed(1)}</td>` : ""}
          ${showPVProfile ? `<td style="padding: 4px 8px; border-bottom: 1px solid #eee; text-align: right;">${(d.gridImport || 0).toFixed(1)}</td>` : ""}
          <td style="padding: 4px 8px; border-bottom: 1px solid #eee;">${TOU_COLORS[period].label}</td>
        </tr>
      `;
      })
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Load Profile Report - ${selectedDay}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          .meta { color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { text-align: left; padding: 8px; border-bottom: 2px solid #333; font-weight: 600; }
          .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
          .stat { background: #f5f5f5; padding: 12px; border-radius: 6px; }
          .stat-label { font-size: 12px; color: #666; }
          .stat-value { font-size: 20px; font-weight: 600; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Load Profile Report</h1>
        <p class="meta">${selectedDay} • ${isWeekend ? "Weekend" : "Weekday"} • Generated ${new Date().toLocaleDateString()}</p>
        
        <div class="stats">
          <div class="stat">
            <div class="stat-label">Daily ${unit}</div>
            <div class="stat-value">${Math.round(totalDaily).toLocaleString()}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Peak</div>
            <div class="stat-value">${Math.round(peakHour.val).toLocaleString()} ${unit}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Load Factor</div>
            <div class="stat-value">${loadFactor.toFixed(0)}%</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Hour</th>
              <th style="text-align: right;">Load (${unit})</th>
              ${showPVProfile ? '<th style="text-align: right;">PV Gen</th>' : ""}
              ${showPVProfile ? '<th style="text-align: right;">Grid Import</th>' : ""}
              <th>TOU Period</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <p style="color: #999; font-size: 12px; margin-top: 20px;">
          ${tenantsCount} tenants • ${tenantsWithScada} SCADA meters, ${tenantsEstimated} estimated
        </p>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
    toast.success("PDF ready for printing");
  }, [chartData, unit, selectedDay, isWeekend, totalDaily, peakHour, loadFactor, showPVProfile, tenantsCount, tenantsWithScada, tenantsEstimated]);

  const exportToPNG = useCallback(async () => {
    if (!chartRef.current) {
      toast.error("Chart not available");
      return;
    }

    try {
      toast.loading("Generating image...", { id: "png-export" });

      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
      });

      const link = document.createElement("a");
      link.download = `load-profile-${selectedDay.toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast.success("PNG exported successfully", { id: "png-export" });
    } catch (error) {
      console.error("PNG export error:", error);
      toast.error("Failed to export PNG", { id: "png-export" });
    }
  }, [selectedDay, chartRef]);

  const exportToSVG = useCallback(() => {
    if (!chartRef.current) {
      toast.error("Chart not available");
      return;
    }

    const svgElement = chartRef.current.querySelector("svg");
    if (!svgElement) {
      toast.error("Chart SVG not found");
      return;
    }

    try {
      const clonedSvg = svgElement.cloneNode(true) as SVGElement;

      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("width", "100%");
      rect.setAttribute("height", "100%");
      rect.setAttribute("fill", "white");
      clonedSvg.insertBefore(rect, clonedSvg.firstChild);

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clonedSvg);
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `load-profile-${selectedDay.toLowerCase()}.svg`;
      link.click();

      URL.revokeObjectURL(url);
      toast.success("SVG exported successfully");
    } catch (error) {
      console.error("SVG export error:", error);
      toast.error("Failed to export SVG");
    }
  }, [selectedDay, chartRef]);

  return {
    exportToCSV,
    exportToPDF,
    exportToPNG,
    exportToSVG,
  };
}
