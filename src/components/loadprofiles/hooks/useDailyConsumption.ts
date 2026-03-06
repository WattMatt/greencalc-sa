import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface NormalisedPoint {
  date: string;
  time: string;
  value: number;
}

interface DailyData {
  date: string;
  label: string;
  dayOfWeek: number;
  isWeekend: boolean;
  totalKwh: number;
  peakKw: number;
  peakHour: number;
  hourlyProfile: number[];
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

/** Direct cast – data is normalised at write time */
function castRawData(rawData: unknown): NormalisedPoint[] {
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return [];
  const first = rawData[0];
  if (first.date && first.time && "value" in first) return rawData as NormalisedPoint[];
  return [];
}

export function useDailyConsumption(meterId: string | null): UseDailyConsumptionResult {
  const [isLoading, setIsLoading] = useState(false);
  const [rawData, setRawData] = useState<NormalisedPoint[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
          setRawData(castRawData(data.raw_data));
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
      if (!point.date || !point.time) continue;
      
      const hour = parseInt(point.time.split(":")[0] || "0", 10);
      if (hour < 0 || hour >= 24) continue;
      
      const dayKey = point.date;
      const dateParts = dayKey.split("-");
      if (dateParts.length !== 3) continue;
      
      if (!dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, { 
          hourlyValues: new Map(),
          total: 0, 
          peak: 0, 
          peakHour: 0,
          count: 0,
          date: new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]))
        });
      }
      
      const dayData = dailyMap.get(dayKey)!;
      dayData.total += point.value;
      dayData.count++;
      
      if (!dayData.hourlyValues.has(hour)) {
        dayData.hourlyValues.set(hour, { total: 0, count: 0 });
      }
      const hourData = dayData.hourlyValues.get(hour)!;
      hourData.total += point.value;
      hourData.count++;
      
      const hourlyAvg = hourData.total / hourData.count;
      if (hourlyAvg > dayData.peak) {
        dayData.peak = hourlyAvg;
        dayData.peakHour = hour;
      }
    }

    const result: DailyData[] = [];
    const sortedKeys = Array.from(dailyMap.keys()).sort();
    
    for (const key of sortedKeys) {
      const data = dailyMap.get(key)!;
      const dayOfWeek = data.date.getDay();
      
      const hourlyProfile: number[] = [];
      for (let h = 0; h < 24; h++) {
        const hourData = data.hourlyValues.get(h);
        hourlyProfile.push(hourData ? hourData.total / hourData.count : 0);
      }
      
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
