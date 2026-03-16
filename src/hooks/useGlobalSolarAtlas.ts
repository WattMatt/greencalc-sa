import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GSAAnnualData {
  PVOUT_csi: number;
  GHI: number;
  DNI: number;
  DIF: number;
  GTI_opta: number;
  OPTA: number;
  TEMP: number;
  ELE: number;
}

export interface GSAMonthlyData {
  PVOUT_csi: number[];
  GHI: number[];
  DNI: number[];
  DIF: number[];
  GTI_opta: number[];
  TEMP: number[];
}

export interface GSAResponse {
  success: boolean;
  annual: { data: GSAAnnualData };
  monthly: { data: GSAMonthlyData };
}

export function useGlobalSolarAtlas() {
  const [data, setData] = useState<GSAResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (latitude: number, longitude: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: response, error: fnError } = await supabase.functions.invoke('global-solar-atlas', {
        body: { latitude, longitude },
      });

      if (fnError) throw fnError;
      if (!response?.success) throw new Error(response?.error || 'Failed to fetch Global Solar Atlas data');

      setData(response);
      toast.success('Global Solar Atlas data loaded');
      return response;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch solar data';
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearData = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, isLoading, error, fetchData, clearData };
}
