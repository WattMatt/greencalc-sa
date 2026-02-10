import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActualGenerationCard } from "./ActualGenerationCard";
import { GuaranteedGenerationCard } from "./GuaranteedGenerationCard";
import { ExpectedGenerationCard } from "./ExpectedGenerationCard";
import { PerformanceChart } from "./PerformanceChart";
import { PerformanceSummaryTable } from "./PerformanceSummaryTable";

export interface GenerationRecord {
  id: string;
  project_id: string;
  month: number;
  year: number;
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
  source: string | null;
}

interface GenerationTabProps {
  projectId: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function GenerationTab({ projectId }: GenerationTabProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const queryClient = useQueryClient();

  const yearOptions = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["generation-records", projectId, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generation_records")
        .select("*")
        .eq("project_id", projectId)
        .eq("year", parseInt(selectedYear))
        .order("month");
      if (error) throw error;
      return (data || []) as GenerationRecord[];
    },
  });

  // Build a 12-month array
  const monthlyData = MONTH_NAMES.map((name, i) => {
    const record = records.find((r) => r.month === i + 1);
    return {
      month: i + 1,
      name,
      actual_kwh: record?.actual_kwh ?? null,
      guaranteed_kwh: record?.guaranteed_kwh ?? null,
      expected_kwh: record?.expected_kwh ?? null,
      source: record?.source ?? null,
    };
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["generation-records", projectId, selectedYear] });
  };

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Year:</span>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-28 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data input cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ActualGenerationCard
          projectId={projectId}
          year={parseInt(selectedYear)}
          monthlyData={monthlyData}
          onDataChanged={refetch}
        />
        <GuaranteedGenerationCard
          projectId={projectId}
          year={parseInt(selectedYear)}
          monthlyData={monthlyData}
          onDataChanged={refetch}
        />
        <ExpectedGenerationCard />
      </div>

      {/* Chart */}
      <PerformanceChart monthlyData={monthlyData} />

      {/* Summary table */}
      <PerformanceSummaryTable monthlyData={monthlyData} />
    </div>
  );
}
