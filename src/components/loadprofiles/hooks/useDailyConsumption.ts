import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isValid, addDays, subDays } from "date-fns";

interface RawDataPoint {
  timestamp?: string;
  date?: string;
  time?: string;
  value: number;
}

interface HourlyValue {
  hour: number;
  value: number;
  readings: number;
}

interface DailyData {
  date: string; // YYYY-MM-DD format
  label: string; // "Mon, Jan 15" format
  dayOfWeek: number; // 0=Sun, 6=Sat
  isWeekend: boolean;
  totalKwh: number;
  peakKw: number;
  peakHour: number;
  hourlyProfile: number[]; // 24 values
  dataPoints: number;
}

interface UseDailyConsumptionResult {
  isLoading: boolean;
  days: DailyData[];
  selectedDate: string | null;
  setSelectedDate: (date: string | null) => void;
  selectedDayData: DailyData | null;
  navigateDay: (direction: 'prev' | 'next') => void;
  dateRange: { start: string | null; end: string | null };
  currentIndex: number;
  totalDays: number;
}

// Parse various date formats
const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

function parseDateTime(timestamp?: string, date?: string, time?: string): { date: Date; hour: number; minute: number } | null {
  // Try timestamp first
  if (timestamp) {
    // Handle ISO format
    if (timestamp.includes('T')) {
      const d = parseISO(timestamp);
      if (isValid(d)) return { date: d, hour: d.getHours(), minute: d.getMinutes() };
    }
    
    // Try "DD Mon YYYY HH:mm" format (e.g. "09 Nov 2022 11:00")
    const textMonthMatch = timestamp.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (textMonthMatch) {
      const [, dayStr, monStr, yearStr, hourStr, minStr] = textMonthMatch;
      const monthIdx = MONTH_NAMES[monStr.toLowerCase()];
      if (monthIdx !== undefined) {
        const d = new Date(parseInt(yearStr), monthIdx, parseInt(dayStr), parseInt(hourStr), parseInt(minStr));
        if (isValid(d)) return { date: d, hour: parseInt(hourStr), minute: parseInt(minStr) };
      }
    }
    
    // Try DD/MM/YYYY HH:mm:ss or YYYY-MM-DD HH:mm:ss format
    const match = timestamp.match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      const [, p1, p2, p3, hour, min] = match;
      let year: number, month: number, day: number;
      
      // Auto-detect format
      const n1 = parseInt(p1), n2 = parseInt(p2), n3 = parseInt(p3);
      if (n1 > 31) {
        // YYYY-MM-DD
        year = n1; month = n2; day = n3;
      } else if (n3 > 31) {
        // DD/MM/YYYY
        day = n1; month = n2; year = n3;
      } else {
        // Assume DD/MM/YYYY
        day = n1; month = n2; year = n3;
      }
      
      const d = new Date(year, month - 1, day, parseInt(hour), parseInt(min));
      if (isValid(d)) return { date: d, hour: parseInt(hour), minute: parseInt(min) };
    }
  }
  
  // Try date + time
  if (date) {
    const dateTimeStr = time ? `${date} ${time}` : date;
    
    // DD Mon YYYY format
    const textMonthMatch = dateTimeStr.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (textMonthMatch) {
      const [, dayStr, monStr, yearStr, hourStr, minStr] = textMonthMatch;
      const monthIdx = MONTH_NAMES[monStr.toLowerCase()];
      if (monthIdx !== undefined) {
        const d = new Date(parseInt(yearStr), monthIdx, parseInt(dayStr), parseInt(hourStr || '0'), parseInt(minStr || '0'));
        if (isValid(d)) return { date: d, hour: parseInt(hourStr || '0'), minute: parseInt(minStr || '0') };
      }
    }
    
    // DD/MM/YYYY format
    const match = dateTimeStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (match) {
      const [, day, month, year, hour, min] = match;
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour || '0'), parseInt(min || '0'));
      if (isValid(d)) return { date: d, hour: parseInt(hour || '0'), minute: parseInt(min || '0') };
    }
  }
  
  return null;
}

// Parse embedded CSV content from raw_data
function parseEmbeddedCSV(csvContent: string): RawDataPoint[] {
  const lines = csvContent.split('\n').filter(l => l.trim() && !l.toLowerCase().startsWith('sep='));
  if (lines.length < 2) return [];
  
  // Find header row by looking for expected column names (Time, Date, kWh, etc.)
  // Skip metadata rows like "pnpscada.com,36724794A"
  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].toLowerCase();
    // Check if this line contains typical header column names
    if (line.includes('time') || line.includes('date') || line.includes('rdate') || 
        line.includes('kwh') || line.includes('timestamp')) {
      headerIdx = i;
      break;
    }
  }
  
  if (headerIdx === -1 || headerIdx >= lines.length) {
    console.warn('[useDailyConsumption] No header row found in CSV');
    return [];
  }
  
  const headers = lines[headerIdx].split(',').map(h => h.trim().toLowerCase());
  console.log('[useDailyConsumption] Headers found:', headers);
  
  // Look for date/time column - include 'time' as a valid column name
  const dateCol = headers.findIndex(h => 
    h.includes('date') || h === 'timestamp' || h === 'time' || h.includes('rdate')
  );
  // Look for kWh value column - prioritize "p1 (kwh)" or just "kwh" or first value after time
  const valueCol = headers.findIndex(h => 
    h.includes('kwh') || h.includes('p1') || h.includes('p14') || h.includes('value') || h.includes('active')
  );
  
  console.log('[useDailyConsumption] dateCol:', dateCol, 'valueCol:', valueCol, 'total lines:', lines.length);
  
  if (dateCol === -1) {
    console.warn('[useDailyConsumption] No date column found');
    return [];
  }
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
  
  console.log('[useDailyConsumption] Parsed points:', points.length, 'Sample:', points[0]);
  return points;
}

export function useDailyConsumption(meterId: string | null): UseDailyConsumptionResult {
  const [isLoading, setIsLoading] = useState(false);
  const [rawData, setRawData] = useState<RawDataPoint[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
          
          const rawDataAny = data.raw_data as unknown;
          
          if (Array.isArray(rawDataAny)) {
            const firstItem = rawDataAny[0] as Record<string, unknown> | undefined;
            if (rawDataAny.length === 1 && firstItem?.csvContent && typeof firstItem.csvContent === 'string') {
              points = parseEmbeddedCSV(firstItem.csvContent);
            } else if (rawDataAny.length > 0 && firstItem?.timestamp) {
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

  // Calculate daily data from raw data
  const days = useMemo(() => {
    if (rawData.length === 0) return [];

    const dailyMap = new Map<string, { 
      hourlyValues: Map<number, { total: number; count: number }>;
      total: number;
      peak: number;
      peakHour: number;
      count: number;
      date: Date;
    }>();

    for (const point of rawData) {
      const parsed = parseDateTime(point.timestamp, point.date, point.time);
      if (!parsed) continue;

      const dayKey = format(parsed.date, 'yyyy-MM-dd');
      
      if (!dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, { 
          hourlyValues: new Map(),
          total: 0, 
          peak: 0, 
          peakHour: 0,
          count: 0,
          date: new Date(parsed.date.getFullYear(), parsed.date.getMonth(), parsed.date.getDate())
        });
      }
      
      const dayData = dailyMap.get(dayKey)!;
      dayData.total += point.value;
      dayData.count++;
      
      // Track hourly values
      if (!dayData.hourlyValues.has(parsed.hour)) {
        dayData.hourlyValues.set(parsed.hour, { total: 0, count: 0 });
      }
      const hourData = dayData.hourlyValues.get(parsed.hour)!;
      hourData.total += point.value;
      hourData.count++;
      
      // Track peak (use hourly average for peak calculation)
      const hourlyAvg = hourData.total / hourData.count;
      if (hourlyAvg > dayData.peak) {
        dayData.peak = hourlyAvg;
        dayData.peakHour = parsed.hour;
      }
    }

    // Convert to sorted array
    const result: DailyData[] = [];
    const sortedKeys = Array.from(dailyMap.keys()).sort();
    
    for (const key of sortedKeys) {
      const data = dailyMap.get(key)!;
      const dayOfWeek = data.date.getDay();
      
      // Build 24-hour profile - AVERAGE readings within each hour for kW (power) data
      const hourlyProfile: number[] = [];
      for (let h = 0; h < 24; h++) {
        const hourData = data.hourlyValues.get(h);
        // For kW (power) readings, use the AVERAGE of readings within the hour
        hourlyProfile.push(hourData ? hourData.total / hourData.count : 0);
      }
      
      // Calculate correct totalKwh from kW readings
      // For 30-min intervals (2 readings/hour), each kW reading represents 0.5 kWh
      // For 15-min intervals (4 readings/hour), each kW reading represents 0.25 kWh
      const readingsPerDay = data.count;
      const avgReadingsPerHour = readingsPerDay / 24;
      const intervalHours = avgReadingsPerHour > 1 ? 1 / avgReadingsPerHour : 1;
      const totalKwh = data.total * intervalHours;
      
      result.push({
        date: key,
        label: format(data.date, 'EEE, MMM d'),
        dayOfWeek,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        totalKwh,
        peakKw: data.peak,
        peakHour: data.peakHour,
        hourlyProfile,
        dataPoints: data.count
      });
    }

    return result;
  }, [rawData]);

  // Auto-select most recent day if not set
  useEffect(() => {
    if (days.length > 0 && !selectedDate) {
      setSelectedDate(days[days.length - 1].date);
    }
  }, [days, selectedDate]);

  const selectedDayData = useMemo(() => {
    if (!selectedDate) return null;
    return days.find(d => d.date === selectedDate) || null;
  }, [days, selectedDate]);

  const currentIndex = useMemo(() => {
    if (!selectedDate) return -1;
    return days.findIndex(d => d.date === selectedDate);
  }, [days, selectedDate]);

  const navigateDay = (direction: 'prev' | 'next') => {
    if (days.length === 0) return;
    
    const newIndex = direction === 'prev' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(days.length - 1, currentIndex + 1);
    
    setSelectedDate(days[newIndex].date);
  };

  const dateRange = useMemo(() => ({
    start: days.length > 0 ? days[0].date : null,
    end: days.length > 0 ? days[days.length - 1].date : null
  }), [days]);

  return {
    isLoading,
    days,
    selectedDate,
    setSelectedDate,
    selectedDayData,
    navigateDay,
    dateRange,
    currentIndex,
    totalDays: days.length
  };
}
