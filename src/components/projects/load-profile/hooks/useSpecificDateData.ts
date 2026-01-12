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

export function useSpecificDateData({
  tenants,
  shopTypes,
  selectedDate,
  displayUnit,
  powerFactor,
}: UseSpecificDateDataProps) {
  // Get available dates from all tenants with SCADA data
  const availableDateRange = useMemo((): AvailableDateRange => {
    const allDates = new Set<string>();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    tenants.forEach((tenant) => {
      const rawData = tenant.scada_imports?.raw_data as RawDataPoint[] | undefined;
      if (!rawData?.length) return;

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

  // Check if any tenants have raw SCADA data
  const hasRawData = useMemo(() => {
    return tenants.some((tenant) => {
      const rawData = tenant.scada_imports?.raw_data as RawDataPoint[] | undefined;
      return rawData && rawData.length > 0;
    });
  }, [tenants]);

  // Calculate chart data for a specific date
  const chartData = useMemo((): ChartDataPoint[] | null => {
    if (!selectedDate) return null;

    const dateStr = selectedDate.toISOString().split("T")[0];
    const hourlyData: { hour: string; total: number; [key: string]: number | string }[] = [];

    // Initialize hourly buckets
    for (let h = 0; h < 24; h++) {
      const hourLabel = `${h.toString().padStart(2, "0")}:00`;
      hourlyData.push({ hour: hourLabel, total: 0 });
    }

    let hasDataForDate = false;

    tenants.forEach((tenant) => {
      const rawData = tenant.scada_imports?.raw_data as RawDataPoint[] | undefined;
      const tenantArea = Number(tenant.area_sqm) || 0;

      if (rawData?.length) {
        // Filter data for the selected date
        const dateData = rawData.filter((point) => point.date === dateStr);

        if (dateData.length > 0) {
          hasDataForDate = true;
          const scadaArea = tenant.scada_imports?.area_sqm || tenantArea;
          const areaScaleFactor = scadaArea > 0 ? tenantArea / scadaArea : 1;

          dateData.forEach((point) => {
            const hour = parseInt(point.time?.split(":")[0] || "0", 10);
            if (hour >= 0 && hour < 24) {
              const kwhValue = (point.value || 0) * areaScaleFactor;
              const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;
              hourlyData[hour][key] = ((hourlyData[hour][key] as number) || 0) + kwhValue;
              hourlyData[hour].total += kwhValue;
            }
          });
        }
      } else {
        // Fallback to shop type estimates for tenants without SCADA data
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

        for (let h = 0; h < 24; h++) {
          const hourlyKwh = dailyKwh * (profileArray[h] / 100);
          const key = tenant.name.length > 15 ? tenant.name.slice(0, 15) + "…" : tenant.name;
          hourlyData[h][key] = ((hourlyData[h][key] as number) || 0) + hourlyKwh;
          hourlyData[h].total += hourlyKwh;
        }
      }
    });

    if (!hasDataForDate) return null;

    // Convert to display unit
    return hourlyData.map((hourData) => {
      const result: ChartDataPoint = { hour: hourData.hour, total: 0 };
      Object.keys(hourData).forEach((key) => {
        if (key === "hour") return;
        const kwhValue = hourData[key] as number;
        const value = displayUnit === "kwh" ? kwhValue : kwhValue / powerFactor;
        result[key] = value;
        if (key === "total") result.total = value;
      });
      return result;
    });
  }, [tenants, shopTypes, selectedDate, displayUnit, powerFactor]);

  return {
    chartData,
    availableDateRange,
    hasRawData,
  };
}
