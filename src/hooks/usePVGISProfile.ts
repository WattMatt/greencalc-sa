import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PVGISTypicalDay {
  normalizedProfile: number[];
  hourlyGhi: number[];
  hourlyDni: number[];
  hourlyDhi: number[];
  hourlyTemp: number[];
}

export interface PVGISMonthly {
  month: number;
  avgDailyGhi: number;
  avgDailyDni: number;
}

export interface PVGISSummary {
  peakGhi: number;
  dailyGhiKwh: number;
  peakSunHours: number;
  avgTemp: number;
  annualGhiKwh: number;
}

export interface PVGISResponse {
  success: boolean;
  source: "pvgis";
  dataType: "tmy";
  location: {
    latitude: number;
    longitude: number;
    elevation: number | null;
  };
  radiationDatabase: string;
  summary: PVGISSummary;
  typicalDay: PVGISTypicalDay;
  monthly: PVGISMonthly[];
  error?: string;
}

interface UsePVGISProfileOptions {
  latitude: number | null;
  longitude: number | null;
}

export function usePVGISProfile() {
  const [data, setData] = useState<PVGISResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(
    async ({ latitude, longitude }: UsePVGISProfileOptions) => {
      if (!latitude || !longitude) {
        setError("Location coordinates required");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data: response, error: fnError } = await supabase.functions.invoke(
          "pvgis-tmy",
          {
            body: { latitude, longitude },
          }
        );

        if (fnError) throw fnError;
        if (!response.success) throw new Error(response.error || "Failed to fetch PVGIS data");

        setData(response);
        toast.success("PVGIS TMY data loaded", {
          description: `Peak Sun Hours: ${response.summary.peakSunHours.toFixed(1)} h/day`,
        });

        return response;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch PVGIS data";
        setError(errorMessage);
        toast.error("PVGIS Error", { description: errorMessage });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearData = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    data,
    isLoading,
    error,
    fetchProfile,
    clearData,
  };
}
