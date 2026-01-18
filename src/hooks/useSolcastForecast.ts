import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SolcastDailyForecast {
  date: string;
  ghi_kwh_m2: number;
  dni_kwh_m2: number;
  dhi_kwh_m2: number;
  air_temp_avg: number | null;
  air_temp_max: number | null;
  air_temp_min: number | null;
  cloud_opacity_avg: number | null;
  peak_sun_hours: number;
}

export interface SolcastHourlyForecast {
  period_end: string;
  ghi: number;
  dni: number;
  dhi: number;
  air_temp: number;
  cloud_opacity: number;
  azimuth: number;
  zenith: number;
}

export interface SolcastSummary {
  location: { latitude: number; longitude: number };
  forecast_period: {
    start: string | null;
    end: string | null;
    total_periods: number;
  };
  average_daily_ghi_kwh_m2: number;
  average_peak_sun_hours: number;
  total_forecast_days: number;
}

export interface SolcastForecastResponse {
  success: boolean;
  summary: SolcastSummary;
  daily: SolcastDailyForecast[];
  hourly: SolcastHourlyForecast[];
  error?: string;
}

interface UseSolcastForecastOptions {
  latitude: number;
  longitude: number;
  hours?: number;
  period?: string;
}

export function useSolcastForecast() {
  const [data, setData] = useState<SolcastForecastResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = useCallback(async (options: UseSolcastForecastOptions) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: response, error: fnError } = await supabase.functions.invoke('solcast-forecast', {
        body: {
          latitude: options.latitude,
          longitude: options.longitude,
          hours: options.hours || 168,
          period: options.period || 'PT60M',
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch solar forecast');
      }

      setData(response);
      return response;
    } catch (err: any) {
      let errorMessage = err.message || 'Failed to fetch solar forecast';
      
      // Handle Solcast API quota exceeded error gracefully
      if (errorMessage.includes('402') || errorMessage.includes('PaymentRequired') || errorMessage.includes('Transaction Limit')) {
        errorMessage = 'Solcast API quota exceeded. The simulation will use default solar profiles instead.';
        toast.warning(errorMessage, { duration: 6000 });
      } else {
        toast.error(errorMessage);
      }
      
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearData = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    data,
    isLoading,
    error,
    fetchForecast,
    clearData,
  };
}
