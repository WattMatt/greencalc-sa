import { useQuery } from "@tanstack/react-query";
import { computeMonthlyReportData, MonthlyReportData } from "@/utils/monthlyReportData";

export function useMonthlyReportData(projectId: string, month: number, year: number) {
  return useQuery<MonthlyReportData>({
    queryKey: ["monthly-report-data", projectId, year, month],
    queryFn: () => computeMonthlyReportData(projectId, month, year),
    enabled: !!projectId && month > 0 && year > 0,
  });
}
