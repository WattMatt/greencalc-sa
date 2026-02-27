import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// TMY Data Types
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
  avgTemp?: number;
}

export interface PVGISSummary {
  peakGhi?: number;
  dailyGhiKwh: number;
  peakSunHours: number;
  avgTemp: number;
  annualGhiKwh: number;
}

export interface PVGISTMYResponse {
  success: boolean;
  source: "pvgis";
  dataType: "tmy";
  yearRange?: {
    start: number;
    end: number;
  };
  location: {
    latitude: number;
    longitude: number;
    elevation: number | null;
  };
  radiationDatabase: string;
  summary: PVGISSummary;
  typicalDay: PVGISTypicalDay;
  monthly: PVGISMonthly[];
  hourlyGhi8760?: number[];  // 8,760 hourly GHI values in W/m² (chronological)
  error?: string;
}

// Monthly Radiation Data Types
export interface PVGISMonthlyAverage {
  month: number;
  avgDailyGhi: number;
  avgDailyDni: number;
  avgDailyDhi: number;
  avgTemp: number;
  yearsAveraged: number;
}

export interface PVGISTypicalDay {
  normalizedProfile: number[];
  hourlyGhi: number[];
  hourlyDni: number[];
  hourlyDhi: number[];
  hourlyTemp: number[];
}

export interface PVGISMonthlyResponse {
  success: boolean;
  source: "pvgis";
  dataType: "monthly_radiation";
  yearRange: {
    start: number;
    end: number;
    yearsCount: number;
  };
  location: {
    latitude: number;
    longitude: number;
    elevation: number | null;
  };
  radiationDatabase: string;
  summary: PVGISSummary;
  typicalDay: PVGISTypicalDay;
  monthly: PVGISMonthlyAverage[];
  rawMonthlyData?: unknown[];
  error?: string;
}

// Legacy type alias for backward compatibility
export type PVGISResponse = PVGISTMYResponse;

export type PVGISDataType = "tmy" | "monthly_radiation";

interface UsePVGISProfileOptions {
  latitude: number | null;
  longitude: number | null;
  projectId?: string;
}

interface CachedSolarData {
  id: string;
  project_id: string;
  data_type: string;
  latitude: number;
  longitude: number;
  data_json: PVGISTMYResponse | PVGISMonthlyResponse;
  fetched_at: string;
}

export function usePVGISProfile() {
  const [tmyData, setTmyData] = useState<PVGISTMYResponse | null>(null);
  const [monthlyData, setMonthlyData] = useState<PVGISMonthlyResponse | null>(null);
  const [isLoadingTMY, setIsLoadingTMY] = useState(false);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(false);
  const [tmyError, setTmyError] = useState<string | null>(null);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);

  // Legacy compatibility - expose the TMY data as "data"
  const data = tmyData;
  const isLoading = isLoadingTMY;
  const error = tmyError;

  // Check cache for existing data
  const checkCache = useCallback(
    async (projectId: string, dataType: PVGISDataType, latitude: number, longitude: number) => {
      try {
        const { data: cached, error: cacheError } = await supabase
          .from("project_solar_data")
          .select("*")
          .eq("project_id", projectId)
          .eq("data_type", dataType)
          .single();

        if (cacheError || !cached) return null;

        // Check if coordinates have changed (within 0.001 degrees ~ 111m)
        const latDiff = Math.abs(cached.latitude - latitude);
        const lngDiff = Math.abs(cached.longitude - longitude);
        if (latDiff > 0.001 || lngDiff > 0.001) {
          console.log(`Cache invalidated: coords changed for ${dataType}`);
          return null;
        }

        console.log(`Using cached ${dataType} data for project ${projectId}`);
        return cached.data_json as unknown as PVGISTMYResponse | PVGISMonthlyResponse;
      } catch (err) {
        console.error("Error checking cache:", err);
        return null;
      }
    },
    []
  );

  // Save to cache
  const saveToCache = useCallback(
    async (
      projectId: string,
      dataType: PVGISDataType,
      latitude: number,
      longitude: number,
      dataJson: PVGISTMYResponse | PVGISMonthlyResponse
    ) => {
      try {
        // First try to update existing record
        const { data: existing } = await supabase
          .from("project_solar_data")
          .select("id")
          .eq("project_id", projectId)
          .eq("data_type", dataType)
          .single();

        if (existing) {
          // Update existing record
          await supabase
            .from("project_solar_data")
            .update({
              latitude,
              longitude,
              data_json: JSON.parse(JSON.stringify(dataJson)),
              fetched_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          console.log(`Updated cached ${dataType} data for project ${projectId}`);
        } else {
          // Insert new record
          await supabase
            .from("project_solar_data")
            .insert({
              project_id: projectId,
              data_type: dataType,
              latitude,
              longitude,
              data_json: JSON.parse(JSON.stringify(dataJson)),
              fetched_at: new Date().toISOString(),
            });

          console.log(`Cached ${dataType} data for project ${projectId}`);
        }
      } catch (err) {
        console.error("Error saving to cache:", err);
      }
    },
    []
  );

  // Fetch TMY data
  const fetchTMY = useCallback(
    async ({ latitude, longitude, projectId }: UsePVGISProfileOptions) => {
      if (!latitude || !longitude) {
        setTmyError("Location coordinates required");
        return null;
      }

      // Check cache first
      if (projectId) {
        const cached = await checkCache(projectId, "tmy", latitude, longitude);
        if (cached) {
          setTmyData(cached as PVGISTMYResponse);
          return cached as PVGISTMYResponse;
        }
      }

      setIsLoadingTMY(true);
      setTmyError(null);

      try {
        const { data: response, error: fnError } = await supabase.functions.invoke(
          "pvgis-tmy",
          {
            body: { latitude, longitude, startyear: 2005, endyear: 2023 },
          }
        );

        if (fnError) throw fnError;
        if (!response.success) throw new Error(response.error || "Failed to fetch PVGIS TMY data");

        setTmyData(response);
        toast.success("PVGIS TMY data loaded", {
          description: `Peak Sun Hours: ${response.summary.peakSunHours.toFixed(1)} h/day`,
        });

        // Save to cache
        if (projectId) {
          await saveToCache(projectId, "tmy", latitude, longitude, response);
        }

        return response as PVGISTMYResponse;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch PVGIS TMY data";
        setTmyError(errorMessage);
        toast.error("PVGIS TMY Error", { description: errorMessage });
        return null;
      } finally {
        setIsLoadingTMY(false);
      }
    },
    [checkCache, saveToCache]
  );

  // Fetch Monthly Radiation data (2005-2023 averaged)
  const fetchMonthlyRadiation = useCallback(
    async ({ latitude, longitude, projectId }: UsePVGISProfileOptions) => {
      if (!latitude || !longitude) {
        setMonthlyError("Location coordinates required");
        return null;
      }

      // Check cache first
      if (projectId) {
        const cached = await checkCache(projectId, "monthly_radiation", latitude, longitude);
        if (cached) {
          setMonthlyData(cached as PVGISMonthlyResponse);
          return cached as PVGISMonthlyResponse;
        }
      }

      setIsLoadingMonthly(true);
      setMonthlyError(null);

      try {
        const { data: response, error: fnError } = await supabase.functions.invoke(
          "pvgis-monthly",
          {
            body: { latitude, longitude, startyear: 2005, endyear: 2023 },
          }
        );

        if (fnError) throw fnError;
        if (!response.success) throw new Error(response.error || "Failed to fetch PVGIS monthly data");

        setMonthlyData(response);
        toast.success("PVGIS Monthly data loaded", {
          description: `19-year average: ${response.summary.peakSunHours.toFixed(1)} h/day`,
        });

        // Save to cache
        if (projectId) {
          await saveToCache(projectId, "monthly_radiation", latitude, longitude, response);
        }

        return response as PVGISMonthlyResponse;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch PVGIS monthly data";
        setMonthlyError(errorMessage);
        toast.error("PVGIS Monthly Error", { description: errorMessage });
        return null;
      } finally {
        setIsLoadingMonthly(false);
      }
    },
    [checkCache, saveToCache]
  );

  // Fetch both datasets in parallel
  const fetchBothDatasets = useCallback(
    async ({ latitude, longitude, projectId }: UsePVGISProfileOptions) => {
      if (!latitude || !longitude) return { tmy: null, monthly: null };

      const [tmy, monthly] = await Promise.all([
        fetchTMY({ latitude, longitude, projectId }),
        fetchMonthlyRadiation({ latitude, longitude, projectId }),
      ]);

      return { tmy, monthly };
    },
    [fetchTMY, fetchMonthlyRadiation]
  );

  // Legacy compatibility - fetchProfile is an alias for fetchTMY
  const fetchProfile = fetchTMY;

  const clearData = useCallback(() => {
    setTmyData(null);
    setMonthlyData(null);
    setTmyError(null);
    setMonthlyError(null);
  }, []);

  return {
    // Legacy API (backward compatible)
    data,
    isLoading,
    error,
    fetchProfile,
    clearData,

    // New API for both data types
    tmyData,
    monthlyData,
    isLoadingTMY,
    isLoadingMonthly,
    tmyError,
    monthlyError,
    fetchTMY,
    fetchMonthlyRadiation,
    fetchBothDatasets,
  };
}
