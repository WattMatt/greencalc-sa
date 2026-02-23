import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

export interface RawDataEntry {
  raw_data: unknown;
  value_unit?: string | null;
}

export type RawDataMap = Record<string, RawDataEntry>;

interface UseRawScadaDataProps {
  projectId: string | undefined;
  enabled?: boolean;
}

/**
 * Fetches raw_data and value_unit from scada_imports on demand.
 * Returns a map of scada_import_id -> { raw_data, value_unit }.
 */
export function useRawScadaData({ projectId, enabled = true }: UseRawScadaDataProps) {
  const { data: rawDataMap, isLoading } = useQuery({
    queryKey: ["tenant-raw-data", projectId],
    queryFn: async (): Promise<RawDataMap> => {
      if (!projectId) return {};

      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, raw_data, value_unit")
        .eq("project_id", projectId)
        .not("raw_data", "is", null);

      if (error) throw error;
      if (!data) return {};

      const map: RawDataMap = {};
      for (const row of data) {
        if (row.raw_data) {
          map[row.id] = {
            raw_data: row.raw_data,
            value_unit: (row as Record<string, unknown>).value_unit as string | null,
          };
        }
      }
      return map;
    },
    enabled: !!projectId && enabled,
    staleTime: 5 * 60 * 1000,
  });

  return { rawDataMap: rawDataMap || {}, isLoadingRawData: isLoading };
}
