import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

export type RawDataMap = Record<string, unknown>;

interface UseRawScadaDataProps {
  projectId: string | undefined;
  enabled?: boolean;
}

/**
 * Fetches raw_data from scada_imports on demand (only when the Load Profile
 * or Envelope tab is visible). Returns a map of scada_import_id -> raw_data.
 *
 * This keeps the main tenant query lightweight by not including the large
 * raw_data payload (~28k rows per meter).
 */
export function useRawScadaData({ projectId, enabled = true }: UseRawScadaDataProps) {
  const { data: rawDataMap, isLoading } = useQuery({
    queryKey: ["tenant-raw-data", projectId],
    queryFn: async (): Promise<RawDataMap> => {
      if (!projectId) return {};

      // Fetch all scada_imports that belong to this project and have raw_data
      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, raw_data")
        .eq("project_id", projectId)
        .not("raw_data", "is", null);

      if (error) throw error;
      if (!data) return {};

      const map: RawDataMap = {};
      for (const row of data) {
        if (row.raw_data) {
          map[row.id] = row.raw_data;
        }
      }
      return map;
    },
    enabled: !!projectId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes – raw data rarely changes
  });

  return { rawDataMap: rawDataMap || {}, isLoadingRawData: isLoading };
}
