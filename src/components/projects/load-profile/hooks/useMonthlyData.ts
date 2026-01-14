import { useMemo } from "react";
import { Tenant, ShopType, ChartDataPoint, DisplayUnit, RawDataPoint } from "../types";

interface UseMonthlyDataProps {
  tenants: Tenant[];
  shopTypes: ShopType[];
  selectedMonth: string | null; // format: "YYYY-MM"
  displayUnit: DisplayUnit;
  powerFactor: number;
}

interface MonthlyStats {
  totalKwh: number;
  peakKw: number;
  avgDailyKwh: number;
  daysWithData: number;
  totalDataPoints: number;
}

interface AvailableMonth {
  value: string; // "YYYY-MM"
  label: string; // "Jan 2025"
  daysWithData: number;
  totalKwh: number;
}

// Parse raw_data which might be in different formats
function parseRawData(rawData: unknown): RawDataPoint[] {
  if (!rawData) return [];
  
  if (Array.isArray(rawData) && rawData.length > 0) {
    const firstItem = rawData[0];
    
    // Check if it's already in the correct format
    if (firstItem.date && firstItem.time && 'value' in firstItem) {
      return rawData as RawDataPoint[];
    }
    
    // Check if it's the CSV format { csvContent: "..." }
    if (firstItem.csvContent && typeof firstItem.csvContent === 'string') {
      const parsed: RawDataPoint[] = [];
      const lines = firstItem.csvContent.split('\n');
      
      let headerIndex = -1;
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        if (lines[i].toLowerCase().includes('rdate') || lines[i].toLowerCase().includes('date')) {
          headerIndex = i;
          break;
        }
      }
      
      if (headerIndex === -1) return [];
      
      for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',');
        if (parts.length >= 3) {
          const date = parts[0];
          const time = parts[1];
          const kwhValue = parseFloat(parts[2]) || 0;
          
          if (date && time && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            parsed.push({
              date,
              time,
              timestamp: `${date}T${time}`,
              value: kwhValue,
            });
          }
        }
      }
      
      return parsed;
    }
  }
  
  return [];
}

export function useMonthlyData({
  tenants,
  selectedMonth,
  displayUnit,
  powerFactor,
}: Omit<UseMonthlyDataProps, 'shopTypes'> & { shopTypes?: ShopType[] }) {
  // Get available months from all tenants with SCADA data
  const availableMonths = useMemo((): AvailableMonth[] => {
    const monthMap = new Map<string, { dates: Set<string>; totalKwh: number }>();
    
    tenants.forEach((tenant) => {
      const rawData = parseRawData(tenant.scada_imports?.raw_data);
      if (!rawData.length) return;
      
      rawData.forEach((point) => {
        if (!point.date) return;
        const month = point.date.substring(0, 7); // "YYYY-MM"
        
        if (!monthMap.has(month)) {
          monthMap.set(month, { dates: new Set(), totalKwh: 0 });
        }
        
        const monthData = monthMap.get(month)!;
        monthData.dates.add(point.date);
        monthData.totalKwh += point.value || 0;
      });
    });
    
    return Array.from(monthMap.entries())
      .map(([month, data]) => {
        const [year, monthNum] = month.split('-');
        const date = new Date(parseInt(year), parseInt(monthNum) - 1);
        return {
          value: month,
          label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          daysWithData: data.dates.size,
          totalKwh: data.totalKwh,
        };
      })
      .sort((a, b) => b.value.localeCompare(a.value)); // Most recent first
  }, [tenants]);

  // Calculate stats for selected month
  const monthlyStats = useMemo((): MonthlyStats | null => {
    if (!selectedMonth) return null;
    
    let totalKwh = 0;
    let peakKw = 0;
    const allDates = new Set<string>();
    let totalDataPoints = 0;
    
    tenants.forEach((tenant) => {
      const rawData = parseRawData(tenant.scada_imports?.raw_data);
      if (!rawData.length) return;
      
      const tenantArea = Number(tenant.area_sqm) || 0;
      const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
      const areaScaleFactor = scadaArea > 0 ? tenantArea / scadaArea : 1;
      
      rawData.forEach((point) => {
        if (!point.date?.startsWith(selectedMonth)) return;
        
        allDates.add(point.date);
        const scaledValue = (point.value || 0) * areaScaleFactor;
        totalKwh += scaledValue;
        
        // For half-hour readings, peak kW = kWh * 2
        const kw = scaledValue * 2;
        if (kw > peakKw) peakKw = kw;
        
        totalDataPoints++;
      });
    });
    
    const daysWithData = allDates.size;
    const avgDailyKwh = daysWithData > 0 ? totalKwh / daysWithData : 0;
    
    return {
      totalKwh,
      peakKw,
      avgDailyKwh,
      daysWithData,
      totalDataPoints,
    };
  }, [tenants, selectedMonth]);

  // Calculate hourly chart data averaged across the selected month
  const chartData = useMemo((): ChartDataPoint[] | null => {
    if (!selectedMonth) return null;
    
    // Aggregate hourly data across all days in the month
    const hourlyTotals: { [key: string]: { [tenantKey: string]: number; count: number } } = {};
    
    for (let h = 0; h < 24; h++) {
      const hourLabel = `${h.toString().padStart(2, "0")}:00`;
      hourlyTotals[hourLabel] = { count: 0 };
    }
    
    const allDatesInMonth = new Set<string>();
    
    tenants.forEach((tenant) => {
      const rawData = parseRawData(tenant.scada_imports?.raw_data);
      const tenantArea = Number(tenant.area_sqm) || 0;
      
      if (rawData.length) {
        const monthData = rawData.filter((point) => point.date?.startsWith(selectedMonth));
        if (monthData.length === 0) return;
        
        const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
        const areaScaleFactor = scadaArea > 0 ? tenantArea / scadaArea : 1;
        const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;
        
        monthData.forEach((point) => {
          if (!point.date || !point.time) return;
          allDatesInMonth.add(point.date);
          
          const hour = parseInt(point.time.split(":")[0], 10);
          if (hour >= 0 && hour < 24) {
            const hourLabel = `${hour.toString().padStart(2, "0")}:00`;
            const scaledValue = (point.value || 0) * areaScaleFactor;
            
            hourlyTotals[hourLabel][key] = (hourlyTotals[hourLabel][key] || 0) + scaledValue;
            hourlyTotals[hourLabel].count = Math.max(hourlyTotals[hourLabel].count, allDatesInMonth.size);
          }
        });
      }
    });
    
    const daysInMonth = allDatesInMonth.size;
    if (daysInMonth === 0) return null;
    
    // Calculate averaged hourly profile
    const result: ChartDataPoint[] = [];
    
    for (let h = 0; h < 24; h++) {
      const hourLabel = `${h.toString().padStart(2, "0")}:00`;
      const hourData = hourlyTotals[hourLabel];
      
      const dataPoint: ChartDataPoint = { hour: hourLabel, total: 0 };
      
      Object.keys(hourData).forEach((key) => {
        if (key === 'count') return;
        
        // Average across days in the month
        const avgKwh = hourData[key] / daysInMonth;
        const value = displayUnit === "kwh" ? avgKwh : avgKwh / powerFactor;
        
        dataPoint[key] = value;
        dataPoint.total += value;
      });
      
      result.push(dataPoint);
    }
    
    return result;
  }, [tenants, selectedMonth, displayUnit, powerFactor]);

  const hasRawData = availableMonths.length > 0;

  return {
    chartData,
    availableMonths,
    monthlyStats,
    hasRawData,
  };
}
