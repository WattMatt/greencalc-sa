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

/** Direct cast – data is normalised at write time */
function castRawData(rawData: unknown): RawDataPoint[] {
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return [];
  const first = rawData[0];
  if (first.date && first.time && "value" in first) return rawData as RawDataPoint[];
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
      const rawData = castRawData(tenant.scada_imports?.raw_data);
      if (!rawData.length) return;
      
      rawData.forEach((point) => {
        if (!point.date) return;
        const month = point.date.substring(0, 7);
        
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
      .sort((a, b) => b.value.localeCompare(a.value));
  }, [tenants]);

  // Calculate stats for selected month
  const monthlyStats = useMemo((): MonthlyStats | null => {
    if (!selectedMonth) return null;
    
    let totalKwh = 0;
    let peakKw = 0;
    const allDates = new Set<string>();
    let totalDataPoints = 0;
    
    tenants.forEach((tenant) => {
      const rawData = castRawData(tenant.scada_imports?.raw_data);
      if (!rawData.length) return;
      
      const tenantArea = Number(tenant.area_sqm) || 0;
      const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
      const areaScaleFactor = scadaArea > 0 ? tenantArea / scadaArea : 1;
      
      rawData.forEach((point) => {
        if (!point.date?.startsWith(selectedMonth)) return;
        
        allDates.add(point.date);
        const scaledValue = (point.value || 0) * areaScaleFactor;
        totalKwh += scaledValue;
        
        const kw = scaledValue * 2;
        if (kw > peakKw) peakKw = kw;
        
        totalDataPoints++;
      });
    });
    
    const daysWithData = allDates.size;
    const avgDailyKwh = daysWithData > 0 ? totalKwh / daysWithData : 0;
    
    return { totalKwh, peakKw, avgDailyKwh, daysWithData, totalDataPoints };
  }, [tenants, selectedMonth]);

  // Calculate hourly chart data averaged across the selected month
  const chartData = useMemo((): ChartDataPoint[] | null => {
    if (!selectedMonth) return null;
    
    const hourlyTotals: Map<string, { sums: Map<string, number>; counts: Map<string, number> }> = new Map();
    
    for (let h = 0; h < 24; h++) {
      const hourLabel = `${h.toString().padStart(2, "0")}:00`;
      hourlyTotals.set(hourLabel, { sums: new Map(), counts: new Map() });
    }
    
    const allDatesInMonth = new Set<string>();
    
    tenants.forEach((tenant) => {
      const rawData = castRawData(tenant.scada_imports?.raw_data);
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
            
            const hourData = hourlyTotals.get(hourLabel)!;
            hourData.sums.set(key, (hourData.sums.get(key) || 0) + scaledValue);
            hourData.counts.set(key, (hourData.counts.get(key) || 0) + 1);
          }
        });
      }
    });
    
    const daysInMonth = allDatesInMonth.size;
    if (daysInMonth === 0) return null;
    
    const result: ChartDataPoint[] = [];
    
    for (let h = 0; h < 24; h++) {
      const hourLabel = `${h.toString().padStart(2, "0")}:00`;
      const hourData = hourlyTotals.get(hourLabel)!;
      
      const dataPoint: ChartDataPoint = { hour: hourLabel, total: 0 };
      
      hourData.sums.forEach((sumValue, key) => {
        const readingCount = hourData.counts.get(key) || 1;
        const avgKw = sumValue / readingCount;
        const value = displayUnit === "kw" ? avgKw : avgKw / powerFactor;
        
        dataPoint[key] = value;
        dataPoint.total += value;
      });
      
      result.push(dataPoint);
    }
    
    return result;
  }, [tenants, selectedMonth, displayUnit, powerFactor]);

  const hasRawData = availableMonths.length > 0;

  return { chartData, availableMonths, monthlyStats, hasRawData };
}
