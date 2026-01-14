import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, isValid } from "date-fns";

interface RawDataPoint {
  timestamp?: string;
  date?: string;
  time?: string;
  value: number;
}

interface MonthlyData {
  month: string; // YYYY-MM format
  label: string; // "Jan 2024" format
  totalKwh: number;
  days: number;
  avgDailyKwh: number;
  peakKw: number;
  dataPoints: number;
}

interface UseMonthlyConsumptionResult {
  isLoading: boolean;
  months: MonthlyData[];
  selectedMonth: string | null;
  setSelectedMonth: (month: string | null) => void;
  selectedMonthData: MonthlyData | null;
  availableMonths: { value: string; label: string }[];
}

// Parse various date formats
function parseDateTime(timestamp?: string, date?: string, time?: string): Date | null {
  // Try timestamp first
  if (timestamp) {
    // Handle ISO format
    if (timestamp.includes('T')) {
      const d = parseISO(timestamp);
      if (isValid(d)) return d;
    }
    
    // Try DD/MM/YYYY HH:mm:ss format
    const match = timestamp.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*(\d{1,2})?:?(\d{2})?:?(\d{2})?/);
    if (match) {
      const [, day, month, year, hour, min, sec] = match;
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour || '0'),
        parseInt(min || '0'),
        parseInt(sec || '0')
      );
    }
  }
  
  // Try date + time
  if (date) {
    const dateTimeStr = time ? `${date} ${time}` : date;
    const d = new Date(dateTimeStr);
    if (isValid(d)) return d;
    
    // DD/MM/YYYY format
    const match = dateTimeStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
  }
  
  return null;
}

// Parse embedded CSV content from raw_data
function parseEmbeddedCSV(csvContent: string): RawDataPoint[] {
  const lines = csvContent.split('\n').filter(l => l.trim() && !l.toLowerCase().startsWith('sep='));
  if (lines.length < 2) return [];
  
  // Find header row (skip empty lines)
  let headerIdx = 0;
  while (headerIdx < lines.length && !lines[headerIdx].includes(',')) headerIdx++;
  if (headerIdx >= lines.length) return [];
  
  const headers = lines[headerIdx].split(',').map(h => h.trim().toLowerCase());
  const dateCol = headers.findIndex(h => h.includes('date') || h === 'timestamp');
  const valueCol = headers.findIndex(h => h.includes('kwh') || h.includes('p14') || h.includes('value') || h.includes('active'));
  
  if (dateCol === -1) return [];
  const valIdx = valueCol === -1 ? 1 : valueCol;
  
  const points: RawDataPoint[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length <= Math.max(dateCol, valIdx)) continue;
    
    const value = parseFloat(cols[valIdx]?.replace(/[^\d.-]/g, '') || '0');
    if (!isNaN(value)) {
      points.push({
        timestamp: cols[dateCol],
        value
      });
    }
  }
  
  return points;
}

export function useMonthlyConsumption(meterId: string | null): UseMonthlyConsumptionResult {
  const [isLoading, setIsLoading] = useState(false);
  const [rawData, setRawData] = useState<RawDataPoint[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Fetch raw data when meter changes
  useEffect(() => {
    if (!meterId) {
      setRawData([]);
      return;
    }

    const fetchRawData = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("scada_imports")
          .select("raw_data")
          .eq("id", meterId)
          .single();

        if (error) throw error;

        if (data?.raw_data) {
          let points: RawDataPoint[] = [];
          
          // Handle different raw_data formats - cast to unknown first for type safety
          const rawDataAny = data.raw_data as unknown;
          
          if (Array.isArray(rawDataAny)) {
            // Check if it's an array with embedded CSV
            const firstItem = rawDataAny[0] as Record<string, unknown> | undefined;
            if (rawDataAny.length === 1 && firstItem?.csvContent && typeof firstItem.csvContent === 'string') {
              points = parseEmbeddedCSV(firstItem.csvContent);
            } else if (rawDataAny.length > 0 && firstItem?.timestamp) {
              // Array of data points - map to ensure correct structure
              points = rawDataAny.map((item: unknown) => {
                const record = item as Record<string, unknown>;
                return {
                  timestamp: record.timestamp as string | undefined,
                  date: record.date as string | undefined,
                  time: record.time as string | undefined,
                  value: typeof record.value === 'number' ? record.value : 0
                };
              });
            }
          }
          
          setRawData(points);
        }
      } catch (err) {
        console.error("Failed to fetch raw data:", err);
        setRawData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRawData();
  }, [meterId]);

  // Calculate monthly totals from raw data
  const months = useMemo(() => {
    if (rawData.length === 0) return [];

    const monthlyMap = new Map<string, { total: number; peak: number; days: Set<string>; count: number }>();

    for (const point of rawData) {
      const date = parseDateTime(point.timestamp, point.date, point.time);
      if (!date || !isValid(date)) continue;

      const monthKey = format(date, 'yyyy-MM');
      const dayKey = format(date, 'yyyy-MM-dd');
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { total: 0, peak: 0, days: new Set(), count: 0 });
      }
      
      const monthData = monthlyMap.get(monthKey)!;
      monthData.total += point.value;
      monthData.peak = Math.max(monthData.peak, point.value);
      monthData.days.add(dayKey);
      monthData.count++;
    }

    // Convert to sorted array
    const result: MonthlyData[] = [];
    const sortedKeys = Array.from(monthlyMap.keys()).sort();
    
    for (const key of sortedKeys) {
      const data = monthlyMap.get(key)!;
      const days = data.days.size;
      
      // Only include months with actual data (more than a few days)
      if (days >= 5) {
        result.push({
          month: key,
          label: format(parseISO(`${key}-01`), 'MMM yyyy'),
          totalKwh: data.total,
          days,
          avgDailyKwh: days > 0 ? data.total / days : 0,
          peakKw: data.peak,
          dataPoints: data.count
        });
      }
    }

    return result;
  }, [rawData]);

  // Auto-select most recent complete month if not set
  useEffect(() => {
    if (months.length > 0 && !selectedMonth) {
      // Find most recent month with good coverage (>20 days)
      const goodMonths = months.filter(m => m.days >= 20);
      if (goodMonths.length > 0) {
        setSelectedMonth(goodMonths[goodMonths.length - 1].month);
      } else {
        setSelectedMonth(months[months.length - 1].month);
      }
    }
  }, [months, selectedMonth]);

  const selectedMonthData = useMemo(() => {
    if (!selectedMonth) return null;
    return months.find(m => m.month === selectedMonth) || null;
  }, [months, selectedMonth]);

  const availableMonths = useMemo(() => {
    return months.map(m => ({
      value: m.month,
      label: `${m.label} (${m.days}d)`
    }));
  }, [months]);

  return {
    isLoading,
    months,
    selectedMonth,
    setSelectedMonth,
    selectedMonthData,
    availableMonths
  };
}