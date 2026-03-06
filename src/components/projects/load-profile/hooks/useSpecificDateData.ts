import { useMemo } from "react";
import { Tenant, ShopType, ChartDataPoint, DisplayUnit, RawDataPoint } from "../types";

interface UseSpecificDateDataProps {
  tenants: Tenant[];
  shopTypes: ShopType[];
  selectedDate: Date | null;
  displayUnit: DisplayUnit;
  powerFactor: number;
}

interface AvailableDateRange {
  startDate: Date | null;
  endDate: Date | null;
  availableDates: Date[];
}

/** Direct cast – data is normalised at write time */
function castRawData(rawData: unknown): RawDataPoint[] {
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return [];
  const first = rawData[0];
  if (first.date && first.time && "value" in first) return rawData as RawDataPoint[];
  return [];
}

export function useSpecificDateData({
  tenants,
  shopTypes,
  selectedDate,
  displayUnit,
  powerFactor,
}: UseSpecificDateDataProps) {
  const availableDateRange = useMemo((): AvailableDateRange => {
    const allDates = new Set<string>();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    tenants.forEach((tenant) => {
      const rawData = castRawData(tenant.scada_imports?.raw_data);
      if (!rawData.length) return;

      rawData.forEach((point) => {
        if (!point.date) return;
        allDates.add(point.date);
        const date = new Date(point.date);
        if (!minDate || date < minDate) minDate = date;
        if (!maxDate || date > maxDate) maxDate = date;
      });
    });

    const availableDates = Array.from(allDates)
      .map((d) => new Date(d))
      .sort((a, b) => a.getTime() - b.getTime());

    return { startDate: minDate, endDate: maxDate, availableDates };
  }, [tenants]);

  const hasRawData = useMemo(() => {
    return tenants.some((tenant) => {
      const rawData = castRawData(tenant.scada_imports?.raw_data);
      return rawData.length > 0;
    });
  }, [tenants]);

  const chartData = useMemo((): ChartDataPoint[] | null => {
    if (!selectedDate) return null;

    const dateStr = selectedDate.toISOString().split("T")[0];
    const hourlyData: { 
      hour: string; 
      total: number; 
      _counts: { [key: string]: number };
      [key: string]: number | string | { [key: string]: number };
    }[] = [];

    for (let h = 0; h < 24; h++) {
      const hourLabel = `${h.toString().padStart(2, "0")}:00`;
      hourlyData.push({ hour: hourLabel, total: 0, _counts: {} });
    }

    let hasDataForDate = false;

    tenants.forEach((tenant) => {
      const rawData = castRawData(tenant.scada_imports?.raw_data);
      const tenantArea = Number(tenant.area_sqm) || 0;

      if (rawData.length) {
        const dateData = rawData.filter((point) => point.date === dateStr);

        if (dateData.length > 0) {
          hasDataForDate = true;
          const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
          const areaScaleFactor = scadaArea > 0 ? tenantArea / scadaArea : 1;
          const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;

          dateData.forEach((point) => {
            const hour = parseInt(point.time?.split(":")[0] || "0", 10);
            if (hour >= 0 && hour < 24) {
              const kwValue = (point.value || 0) * areaScaleFactor;
              hourlyData[hour][key] = ((hourlyData[hour][key] as number) || 0) + kwValue;
              hourlyData[hour]._counts[key] = (hourlyData[hour]._counts[key] || 0) + 1;
            }
          });
        }
      } else {
        const shopType = tenant.shop_type_id
          ? shopTypes.find((st) => st.id === tenant.shop_type_id)
          : null;

        const isWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
        const monthlyKwh = tenant.monthly_kwh_override || (shopType?.kwh_per_sqm_month || 50) * tenantArea;
        const dailyKwh = monthlyKwh / 30;
        const profile = isWeekend
          ? shopType?.load_profile_weekend || shopType?.load_profile_weekday
          : shopType?.load_profile_weekday;
        const profileArray = profile?.length === 24 ? profile.map(Number) : Array(24).fill(4.17);
        const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;

        for (let h = 0; h < 24; h++) {
          const hourlyKwh = dailyKwh * (profileArray[h] / 100);
          hourlyData[h][key] = ((hourlyData[h][key] as number) || 0) + hourlyKwh;
          hourlyData[h]._counts[key] = 1;
        }
      }
    });

    if (!hasDataForDate) return null;

    return hourlyData.map((hourData) => {
      const result: ChartDataPoint = { hour: hourData.hour as string, total: 0 };
      const counts = hourData._counts as { [key: string]: number };
      
      Object.keys(hourData).forEach((key) => {
        if (key === "hour" || key === "_counts" || key === "total") return;
        
        const sumValue = hourData[key] as number;
        const count = counts[key] || 1;
        const avgKw = sumValue / count;
        
        const value = displayUnit === "kw" ? avgKw : avgKw / powerFactor;
        result[key] = value;
        result.total += value;
      });
      return result;
    });
  }, [tenants, shopTypes, selectedDate, displayUnit, powerFactor]);

  return { chartData, availableDateRange, hasRawData };
}
