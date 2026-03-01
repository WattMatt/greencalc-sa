import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GenerationDataCard } from "./GenerationDataCard";
import { GuaranteedGenerationCard } from "./GuaranteedGenerationCard";
import { PerformanceChart } from "./PerformanceChart";
import { PerformanceSummaryTable } from "./PerformanceSummaryTable";
import { LifetimePerformanceChart } from "./LifetimePerformanceChart";

export interface GenerationRecord {
  id: string;
  project_id: string;
  month: number;
  year: number;
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
  building_load_kwh: number | null;
  source: string | null;
}

export interface MonthData {
  month: number;
  name: string;
  fullName: string;
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
  building_load_kwh: number | null;
  source: string | null;
}

interface GenerationTabProps {
  projectId: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getPreviousMonth() {
  const now = new Date();
  let month = now.getMonth();
  let year = now.getFullYear();
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return { month, year };
}

export function GenerationTab({ projectId }: GenerationTabProps) {
  const prev = getPreviousMonth();
  const [selectedMonth, setSelectedMonth] = useState(prev.month.toString());
  const [selectedYear, setSelectedYear] = useState(prev.year.toString());
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  const month = parseInt(selectedMonth);
  const year = parseInt(selectedYear);

  const { data: record } = useQuery({
    queryKey: ["generation-record", projectId, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generation_records")
        .select("*")
        .eq("project_id", projectId)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      if (error) throw error;
      return data as GenerationRecord | null;
    },
  });

  const monthData = {
    month,
    name: MONTH_NAMES[month - 1],
    fullName: MONTH_FULL_NAMES[month - 1],
    actual_kwh: record?.actual_kwh ?? null,
    guaranteed_kwh: record?.guaranteed_kwh ?? null,
    expected_kwh: record?.expected_kwh ?? null,
    building_load_kwh: record?.building_load_kwh ?? null,
    source: record?.source ?? null,
  };

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["generation-record", projectId, year, month] });
    queryClient.invalidateQueries({ queryKey: ["generation-readings", projectId, year, month] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Month:</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_FULL_NAMES.map((name, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <LifetimePerformanceChart projectId={projectId} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GenerationDataCard
          projectId={projectId}
          month={month}
          year={year}
          monthData={monthData}
          onDataChanged={refetch}
          dataType="solar"
        />
        <GuaranteedGenerationCard
          projectId={projectId}
          month={month}
          year={year}
          monthData={monthData}
          onDataChanged={refetch}
        />
        <GenerationDataCard
          projectId={projectId}
          month={month}
          year={year}
          monthData={monthData}
          onDataChanged={refetch}
          dataType="council"
        />
      </div>

      <PerformanceChart projectId={projectId} month={month} year={year} monthData={monthData} />
      <PerformanceSummaryTable projectId={projectId} month={month} year={year} monthData={monthData} />
    </div>
  );
}
