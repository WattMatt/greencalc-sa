import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AggregationType = "daily" | "weekly" | "monthly";
export type DayTypeFilter = "all" | "weekday" | "weekend";

interface RawDataPoint {
  date: string;
  time: string;
  timestamp: string;
  value: number;
}

export interface MeterMetadata {
  id: string;
  shop_name: string | null;
  shop_number: string | null;
  site_id: string | null;
  site_name: string;
  category_id: string | null;
  area_sqm: number | null;
  date_range_start: string | null;
  date_range_end: string | null;
  detected_interval_minutes: number | null;
}

export interface MeterWithSite extends MeterMetadata {
  siteName: string; // Resolved site name from sites table
  categoryName: string | null;
}

export interface ComparisonDataPoint {
  label: string; // Hour (00-23), Day (Mon-Sun), or Month (Jan 2024)
  [meterId: string]: number | string; // Dynamic keys for each meter's value
}

export interface BaselineComparisonDataPoint {
  label: string;
  [meterId: string]: number | string; // Percentage difference from baseline
}

export interface MeterStats {
  meterId: string;
  meterName: string;
  siteName: string;
  avgValue: number;
  peakValue: number;
  totalKwh: number;
  vsGroupAvg: number; // Percentage difference from group average
  vsBaseline: number | null; // Percentage difference from baseline meter
  energyIntensity: number | null; // kWh/m² if area available
}

const CHART_COLORS = [
  "hsl(221, 83%, 53%)", // Blue
  "hsl(142, 71%, 45%)", // Green
  "hsl(0, 84%, 60%)",   // Red
  "hsl(38, 92%, 50%)",  // Orange
  "hsl(262, 83%, 58%)", // Purple
  "hsl(174, 84%, 32%)", // Teal
];

export function useCrossSiteComparison(
  selectedMeterIds: string[],
  aggregation: AggregationType,
  dayTypeFilter: DayTypeFilter,
  dateFrom?: Date,
  dateTo?: Date,
  baselineMeterId?: string | null
) {
  // Fetch all meters metadata for selection UI (without raw_data)
  const { data: allMeters = [], isLoading: isLoadingMeters } = useQuery({
    queryKey: ["meters-metadata"],
    queryFn: async () => {
      const { data: meters, error } = await supabase
        .from("scada_imports")
        .select(`
          id,
          shop_name,
          shop_number,
          site_id,
          site_name,
          category_id,
          area_sqm,
          date_range_start,
          date_range_end,
          detected_interval_minutes
        `)
        .order("site_name");

      if (error) throw error;

      // Fetch sites for proper naming
      const { data: sites } = await supabase
        .from("sites")
        .select("id, name");

      // Fetch categories
      const { data: categories } = await supabase
        .from("shop_type_categories")
        .select("id, name");

      const siteMap = new Map(sites?.map(s => [s.id, s.name]) || []);
      const categoryMap = new Map(categories?.map(c => [c.id, c.name]) || []);

      return (meters || []).map(m => ({
        ...m,
        siteName: m.site_id ? siteMap.get(m.site_id) || m.site_name : m.site_name,
        categoryName: m.category_id ? categoryMap.get(m.category_id) || null : null,
      })) as MeterWithSite[];
    },
  });

  // Fetch raw data only for selected meters
  const { data: metersWithData = [], isLoading: isLoadingData } = useQuery({
    queryKey: ["meters-raw-data", selectedMeterIds],
    queryFn: async () => {
      if (selectedMeterIds.length === 0) return [];

      const { data, error } = await supabase
        .from("scada_imports")
        .select(`
          id,
          shop_name,
          shop_number,
          site_id,
          site_name,
          category_id,
          area_sqm,
          date_range_start,
          date_range_end,
          detected_interval_minutes,
          raw_data
        `)
        .in("id", selectedMeterIds);

      if (error) throw error;

      // Fetch sites for proper naming
      const { data: sites } = await supabase
        .from("sites")
        .select("id, name");

      const siteMap = new Map(sites?.map(s => [s.id, s.name]) || []);

      return (data || []).map(m => ({
        ...m,
        siteName: m.site_id ? siteMap.get(m.site_id) || m.site_name : m.site_name,
      }));
    },
    enabled: selectedMeterIds.length > 0,
  });

  // Process and aggregate data
  const { chartData, baselineChartData, meterStats } = useMemo(() => {
    if (metersWithData.length === 0) {
      return { chartData: [], baselineChartData: [], meterStats: [] };
    }

    const processedMeters: Map<string, RawDataPoint[]> = new Map();

    // Parse raw data for each meter
    metersWithData.forEach(meter => {
      if (!meter.raw_data) return;

      let rawData: RawDataPoint[] = [];
      
      // Handle different raw_data formats
      if (Array.isArray(meter.raw_data)) {
        if (meter.raw_data.length > 0 && typeof meter.raw_data[0] === 'object') {
          const firstItem = meter.raw_data[0] as Record<string, unknown>;
          if ('csvContent' in firstItem) {
            // Parse CSV content - skip for now, use pre-processed profiles
            return;
          }
          rawData = meter.raw_data as unknown as RawDataPoint[];
        }
      }

      // Filter by date range if specified
      if (dateFrom || dateTo) {
        rawData = rawData.filter(point => {
          const pointDate = new Date(point.date || point.timestamp);
          if (dateFrom && pointDate < dateFrom) return false;
          if (dateTo && pointDate > dateTo) return false;
          return true;
        });
      }

      // Filter by day type
      if (dayTypeFilter !== "all") {
        rawData = rawData.filter(point => {
          const pointDate = new Date(point.date || point.timestamp);
          const dayOfWeek = pointDate.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          return dayTypeFilter === "weekend" ? isWeekend : !isWeekend;
        });
      }

      processedMeters.set(meter.id, rawData);
    });

    // Aggregate based on type
    let chartData: ComparisonDataPoint[] = [];
    const meterStatsMap: Map<string, { sum: number; count: number; peak: number; values: number[] }> = new Map();

    // Initialize stats tracking
    metersWithData.forEach(m => {
      meterStatsMap.set(m.id, { sum: 0, count: 0, peak: 0, values: [] });
    });

    if (aggregation === "daily") {
      // Hourly average profile (00-23)
      const hourlyData: Map<number, Map<string, number[]>> = new Map();
      
      for (let h = 0; h < 24; h++) {
        hourlyData.set(h, new Map());
        metersWithData.forEach(m => hourlyData.get(h)!.set(m.id, []));
      }

      processedMeters.forEach((points, meterId) => {
        points.forEach(point => {
          const hour = parseInt(point.time?.split(":")[0] || "0", 10);
          if (hour >= 0 && hour < 24) {
            hourlyData.get(hour)?.get(meterId)?.push(point.value);
          }
        });
      });

      chartData = Array.from({ length: 24 }, (_, hour) => {
        const dataPoint: ComparisonDataPoint = {
          label: `${hour.toString().padStart(2, "0")}:00`,
        };

        metersWithData.forEach(meter => {
          const values = hourlyData.get(hour)?.get(meter.id) || [];
          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          dataPoint[meter.id] = avg;

          // Update stats
          const stats = meterStatsMap.get(meter.id)!;
          stats.sum += avg;
          stats.count++;
          stats.peak = Math.max(stats.peak, avg);
          stats.values.push(avg);
        });

        return dataPoint;
      });

    } else if (aggregation === "weekly") {
      // Day of week pattern (Mon-Sun)
      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const dailyData: Map<number, Map<string, number[]>> = new Map();
      
      for (let d = 0; d < 7; d++) {
        dailyData.set(d, new Map());
        metersWithData.forEach(m => dailyData.get(d)!.set(m.id, []));
      }

      processedMeters.forEach((points, meterId) => {
        // Group points by date first, then sum for daily total
        const dailyTotals: Map<string, number> = new Map();
        
        points.forEach(point => {
          const dateKey = point.date || point.timestamp.split("T")[0];
          dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + point.value);
        });

        dailyTotals.forEach((total, dateStr) => {
          const date = new Date(dateStr);
          let dayIndex = date.getDay() - 1; // Mon = 0
          if (dayIndex < 0) dayIndex = 6; // Sun = 6
          dailyData.get(dayIndex)?.get(meterId)?.push(total);
        });
      });

      chartData = dayNames.map((dayName, index) => {
        const dataPoint: ComparisonDataPoint = { label: dayName };

        metersWithData.forEach(meter => {
          const values = dailyData.get(index)?.get(meter.id) || [];
          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          dataPoint[meter.id] = avg;

          const stats = meterStatsMap.get(meter.id)!;
          stats.sum += avg;
          stats.count++;
          stats.peak = Math.max(stats.peak, avg);
          stats.values.push(avg);
        });

        return dataPoint;
      });

    } else if (aggregation === "monthly") {
      // Month-over-month totals
      const monthlyData: Map<string, Map<string, number>> = new Map();

      processedMeters.forEach((points, meterId) => {
        points.forEach(point => {
          const date = new Date(point.date || point.timestamp);
          const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
          
          if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, new Map());
          }
          const monthMap = monthlyData.get(monthKey)!;
          monthMap.set(meterId, (monthMap.get(meterId) || 0) + point.value);
        });
      });

      // Sort months chronologically
      const sortedMonths = Array.from(monthlyData.keys()).sort();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      chartData = sortedMonths.map(monthKey => {
        const [year, month] = monthKey.split("-");
        const monthName = monthNames[parseInt(month, 10) - 1];
        const dataPoint: ComparisonDataPoint = { label: `${monthName} ${year}` };

        metersWithData.forEach(meter => {
          const value = monthlyData.get(monthKey)?.get(meter.id) || 0;
          dataPoint[meter.id] = value;

          const stats = meterStatsMap.get(meter.id)!;
          stats.sum += value;
          stats.count++;
          stats.peak = Math.max(stats.peak, value);
          stats.values.push(value);
        });

        return dataPoint;
      });
    }

    // Calculate group average for comparison
    const groupTotals = Array.from(meterStatsMap.values()).map(s => s.sum);
    const groupAvg = groupTotals.length > 0 ? groupTotals.reduce((a, b) => a + b, 0) / groupTotals.length : 0;

    // Get baseline stats if a baseline meter is selected
    const baselineStats = baselineMeterId ? meterStatsMap.get(baselineMeterId) : null;
    const baselineTotal = baselineStats?.sum || 0;

    // Build final stats
    const meterStats: MeterStats[] = metersWithData.map(meter => {
      const stats = meterStatsMap.get(meter.id)!;
      const avgValue = stats.count > 0 ? stats.sum / stats.count : 0;
      const vsGroupAvg = groupAvg > 0 ? ((stats.sum - groupAvg) / groupAvg) * 100 : 0;
      
      // Calculate vs baseline (null if this IS the baseline or no baseline selected)
      let vsBaseline: number | null = null;
      if (baselineMeterId && meter.id !== baselineMeterId && baselineTotal > 0) {
        vsBaseline = ((stats.sum - baselineTotal) / baselineTotal) * 100;
      }

      return {
        meterId: meter.id,
        meterName: meter.shop_name || meter.shop_number || "Unknown",
        siteName: meter.siteName,
        avgValue,
        peakValue: stats.peak,
        totalKwh: stats.sum,
        vsGroupAvg,
        vsBaseline,
        energyIntensity: meter.area_sqm ? stats.sum / meter.area_sqm : null,
      };
    });

    // Calculate baseline comparison chart data (percentage differences)
    let baselineChartData: BaselineComparisonDataPoint[] = [];
    if (baselineMeterId && chartData.length > 0) {
      baselineChartData = chartData.map(point => {
        const baselineValue = point[baselineMeterId];
        const baselineNum = typeof baselineValue === "number" ? baselineValue : 0;
        
        const newPoint: BaselineComparisonDataPoint = { label: point.label };
        
        metersWithData.forEach(meter => {
          if (meter.id === baselineMeterId) {
            // Baseline is always 0%
            newPoint[meter.id] = 0;
          } else {
            const meterValue = point[meter.id];
            const meterNum = typeof meterValue === "number" ? meterValue : 0;
            
            if (baselineNum > 0) {
              newPoint[meter.id] = ((meterNum - baselineNum) / baselineNum) * 100;
            } else {
              newPoint[meter.id] = 0;
            }
          }
        });
        
        return newPoint;
      });
    }

    return { chartData, baselineChartData, meterStats };
  }, [metersWithData, aggregation, dayTypeFilter, dateFrom, dateTo, baselineMeterId]);

  // Get unique sites and categories for filtering
  const sites = useMemo(() => {
    const siteSet = new Map<string, string>();
    allMeters.forEach(m => {
      if (m.site_id) {
        siteSet.set(m.site_id, m.siteName);
      }
    });
    return Array.from(siteSet.entries()).map(([id, name]) => ({ id, name }));
  }, [allMeters]);

  const categories = useMemo(() => {
    const catSet = new Map<string, string>();
    allMeters.forEach(m => {
      if (m.category_id && m.categoryName) {
        catSet.set(m.category_id, m.categoryName);
      }
    });
    return Array.from(catSet.entries()).map(([id, name]) => ({ id, name }));
  }, [allMeters]);

  // Get color for a meter
  const getMeterColor = (meterId: string): string => {
    const index = selectedMeterIds.indexOf(meterId);
    return CHART_COLORS[index % CHART_COLORS.length];
  };

  return {
    allMeters,
    sites,
    categories,
    chartData,
    baselineChartData,
    meterStats,
    getMeterColor,
    chartColors: CHART_COLORS,
    isLoading: isLoadingMeters || isLoadingData,
  };
}
