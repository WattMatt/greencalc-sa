import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tenant } from "../types";

export interface RawDataEntry {
  raw_data: unknown;
  value_unit?: string | null;
}

export type RawDataMap = Record<string, RawDataEntry>;

interface UseRawScadaDataProps {
  tenants: Tenant[];
  enabled?: boolean;
}

/**
 * Fetches raw_data and value_unit from scada_imports for all tenant-linked meters.
 * Derives the set of scada_import IDs from tenants (direct + multi-meter).
 */
export function useRawScadaData({ tenants, enabled = true }: UseRawScadaDataProps) {
  const scadaIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of tenants) {
      if (t.scada_import_id) ids.add(t.scada_import_id);
      if (t.tenant_meters) {
        for (const m of t.tenant_meters) {
          if (m.scada_import_id) ids.add(m.scada_import_id);
        }
      }
    }
    return Array.from(ids);
  }, [tenants]);

  const { data: rawDataMap, isLoading } = useQuery({
    queryKey: ["tenant-raw-data", scadaIds],
    queryFn: async (): Promise<RawDataMap> => {
      if (scadaIds.length === 0) return {};

      const { data, error } = await supabase
        .from("scada_imports")
        .select("id, raw_data, value_unit")
        .in("id", scadaIds)
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
    enabled: enabled && scadaIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return { rawDataMap: rawDataMap || {}, isLoadingRawData: isLoading };
}
