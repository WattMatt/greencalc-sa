import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { daysInMonth } from "@/components/projects/generation/generationUtils";

export interface GenerationReading {
  timestamp: string;
  actual_kwh: number | null;
  building_load_kwh: number | null;
  source: string | null;
}

/**
 * Shared hook that paginates through generation_readings for a given month.
 * Both PerformanceChart and PerformanceSummaryTable consume the same cached query.
 */
export function useGenerationReadings(projectId: string, year: number, month: number, enabled = true) {
  const days = daysInMonth(month, year);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01T00:00:00`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(days).padStart(2, "0")}T23:59:59`;

  return useQuery({
    queryKey: ["generation-readings", projectId, year, month],
    queryFn: async () => {
      const allReadings: GenerationReading[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("generation_readings")
          .select("timestamp, actual_kwh, building_load_kwh, source")
          .eq("project_id", projectId)
          .gte("timestamp", startDate)
          .lte("timestamp", endDate)
          .order("timestamp", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allReadings.push(...(data ?? []));
        hasMore = (data?.length ?? 0) === pageSize;
        from += pageSize;
      }
      return allReadings;
    },
    enabled,
  });
}
