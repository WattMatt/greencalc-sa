import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SolcastHourlyData {
  hour: number;
  ghi: number; // W/m²
  dni: number;
  dhi: number;
  airTemp: number;
  cloudOpacity: number;
}

export interface SolcastPVProfile {
  // Normalized hourly profile (0-1, where 1 = peak irradiance)
  normalizedProfile: number[];
  // Actual hourly GHI in W/m²
  hourlyGhi: number[];
  // Peak GHI of the day
  peakGhi: number;
  // Average daily GHI in kWh/m²
  dailyGhiKwh: number;
  // Peak Sun Hours
  peakSunHours: number;
  // Temperature for derating calculation
  hourlyTemp: number[];
  // Average temperature
  avgTemp: number;
  // Data source indicator
  source: "solcast" | "static";
  // Fetch timestamp
  fetchedAt: Date | null;
}

interface UseSolcastPVProfileOptions {
  latitude: number | null;
  longitude: number | null;
  enabled?: boolean;
}

// Default static profile when Solcast is unavailable
const STATIC_PV_PROFILE = [
  0.0, 0.0, 0.0, 0.0, 0.0, 0.02, 0.08, 0.2, 0.38, 0.58, 0.78, 0.92, 1.0, 0.98, 0.9, 0.75, 0.55, 0.32, 0.12, 0.02, 0.0, 0.0, 0.0, 0.0,
];

// Typical GHI values for static profile (W/m²)
const STATIC_HOURLY_GHI = STATIC_PV_PROFILE.map((v) => v * 1000);

export function useSolcastPVProfile({ latitude, longitude, enabled = true }: UseSolcastPVProfileOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solcastData, setSolcastData] = useState<SolcastHourlyData[] | null>(null);
  const [useSolcast, setUseSolcast] = useState(false);

  // Fetch Solcast data
  const fetchSolcastData = useCallback(async () => {
    if (!latitude || !longitude) {
      setError("Location coordinates required");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: response, error: fnError } = await supabase.functions.invoke("solcast-forecast", {
        body: {
          latitude,
          longitude,
          hours: 24, // Just get today's forecast
          period: "PT60M",
        },
      });

      if (fnError) throw fnError;
      if (!response.success) throw new Error(response.error || "Failed to fetch solar forecast");

      // Process hourly data into our format
      const hourlyData: SolcastHourlyData[] = [];

      // Group by hour and average
      const hourlyGroups: Record<number, SolcastHourlyData[]> = {};

      for (const forecast of response.hourly || []) {
        const periodEnd = new Date(forecast.period_end);
        const hour = periodEnd.getHours();

        if (!hourlyGroups[hour]) {
          hourlyGroups[hour] = [];
        }

        hourlyGroups[hour].push({
          hour,
          ghi: forecast.ghi || 0,
          dni: forecast.dni || 0,
          dhi: forecast.dhi || 0,
          airTemp: forecast.air_temp || 25,
          cloudOpacity: forecast.cloud_opacity || 0,
        });
      }

      // Average each hour's data
      for (let h = 0; h < 24; h++) {
        const group = hourlyGroups[h] || [];
        if (group.length > 0) {
          hourlyData.push({
            hour: h,
            ghi: group.reduce((s, d) => s + d.ghi, 0) / group.length,
            dni: group.reduce((s, d) => s + d.dni, 0) / group.length,
            dhi: group.reduce((s, d) => s + d.dhi, 0) / group.length,
            airTemp: group.reduce((s, d) => s + d.airTemp, 0) / group.length,
            cloudOpacity: group.reduce((s, d) => s + d.cloudOpacity, 0) / group.length,
          });
        } else {
          // Fill with zero for missing hours
          hourlyData.push({ hour: h, ghi: 0, dni: 0, dhi: 0, airTemp: 25, cloudOpacity: 0 });
        }
      }

      // Sort by hour
      hourlyData.sort((a, b) => a.hour - b.hour);

      setSolcastData(hourlyData);
      setUseSolcast(true);
      toast.success("Solcast irradiance data loaded");

      return hourlyData;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch Solcast data";
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [latitude, longitude]);

  // Generate PV profile from data
  const pvProfile = useMemo((): SolcastPVProfile => {
    if (useSolcast && solcastData && solcastData.length === 24) {
      const hourlyGhi = solcastData.map((d) => d.ghi);
      const hourlyTemp = solcastData.map((d) => d.airTemp);
      const peakGhi = Math.max(...hourlyGhi);

      // Normalize to 0-1 range
      const normalizedProfile = hourlyGhi.map((v) => (peakGhi > 0 ? v / peakGhi : 0));

      // Calculate daily totals
      const dailyGhiWh = hourlyGhi.reduce((sum, v) => sum + v, 0); // Wh/m²
      const dailyGhiKwh = dailyGhiWh / 1000;
      const peakSunHours = dailyGhiKwh; // PSH = kWh/m²/day

      return {
        normalizedProfile,
        hourlyGhi,
        peakGhi,
        dailyGhiKwh,
        peakSunHours,
        hourlyTemp,
        avgTemp: hourlyTemp.reduce((s, t) => s + t, 0) / 24,
        source: "solcast",
        fetchedAt: new Date(),
      };
    }

    // Return static profile
    return {
      normalizedProfile: STATIC_PV_PROFILE,
      hourlyGhi: STATIC_HOURLY_GHI,
      peakGhi: 1000,
      dailyGhiKwh: 5.5, // Typical for South Africa
      peakSunHours: 5.5,
      hourlyTemp: Array(24).fill(25),
      avgTemp: 25,
      source: "static",
      fetchedAt: null,
    };
  }, [useSolcast, solcastData]);

  // Toggle between Solcast and static
  const toggleSolcast = useCallback(
    (use: boolean) => {
      if (use && !solcastData) {
        fetchSolcastData();
      } else {
        setUseSolcast(use);
      }
    },
    [solcastData, fetchSolcastData]
  );

  // Clear and refetch
  const refetch = useCallback(() => {
    setSolcastData(null);
    fetchSolcastData();
  }, [fetchSolcastData]);

  return {
    pvProfile,
    isLoading,
    error,
    useSolcast,
    toggleSolcast,
    refetch,
    hasLocation: !!(latitude && longitude),
  };
}
