import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface MonthData {
  month: number;
  name: string;
  fullName: string;
  actual_kwh: number | null;
  guaranteed_kwh: number | null;
  expected_kwh: number | null;
  building_load_kwh: number | null;
}

interface PerformanceSummaryTableProps {
  projectId: string;
  month: number;
  year: number;
  monthData: MonthData;
}

const TABS = ["Daily Performance"] as const;

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function formatNum(val: number | null | undefined): string {
  if (val == null) return "—";
  return val.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface DailyRow {
  day: number;
  date: string;
  yieldGuarantee: number;
  meteredGeneration: number;
  downTime: number;
  theoreticalGeneration: number;
  overProduction: number;
  realisedConsumption: number;
  surplusDeficit: number;
}

export function PerformanceSummaryTable({ projectId, month, year, monthData }: PerformanceSummaryTableProps) {
  const [activeTab, setActiveTab] = useState<string>(TABS[0]);

  const totalDays = daysInMonth(month, year);
  const dailyGuarantee = (monthData.guaranteed_kwh ?? 0) / totalDays;

  // Fetch all generation_readings for this month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01T00:00:00`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}T23:59:59`;

  const { data: readings } = useQuery({
    queryKey: ["generation-readings", projectId, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generation_readings")
        .select("timestamp, actual_kwh, building_load_kwh")
        .eq("project_id", projectId)
        .gte("timestamp", startDate)
        .lte("timestamp", endDate)
        .order("timestamp", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const dailyRows: DailyRow[] = useMemo(() => {
    const dayMap = new Map<number, { actual: number; downtime: number }>();

    // Init all days
    for (let d = 1; d <= totalDays; d++) {
      dayMap.set(d, { actual: 0, downtime: 0 });
    }

    if (readings) {
      for (const r of readings) {
        const ts = new Date(r.timestamp);
        const day = ts.getDate();
        const hour = ts.getHours();
        const entry = dayMap.get(day);
        if (!entry) continue;

        const kwh = Number(r.actual_kwh) || 0;
        entry.actual += kwh;

        // Downtime: during sun hours (6-18), if actual is 0 or null, count theoretical share
        if (hour >= 6 && hour < 18 && (r.actual_kwh == null || Number(r.actual_kwh) === 0)) {
          // Approximate: daily guarantee spread over 12 sun hours
          // We don't know interval so count per-reading
          entry.downtime += dailyGuarantee / 12;
        }
      }
    }

    const rows: DailyRow[] = [];
    for (let d = 1; d <= totalDays; d++) {
      const entry = dayMap.get(d)!;
      const metered = entry.actual;
      const theoretical = metered + entry.downtime;
      const overProd = Math.max(0, metered - theoretical);
      const surplus = metered - dailyGuarantee;

      rows.push({
        day: d,
        date: `${d}`,
        yieldGuarantee: dailyGuarantee,
        meteredGeneration: metered,
        downTime: entry.downtime,
        theoreticalGeneration: theoretical,
        overProduction: overProd,
        realisedConsumption: metered,
        surplusDeficit: surplus,
      });
    }
    return rows;
  }, [readings, totalDays, dailyGuarantee]);

  const totals = useMemo(() => {
    return dailyRows.reduce(
      (acc, r) => ({
        yieldGuarantee: acc.yieldGuarantee + r.yieldGuarantee,
        meteredGeneration: acc.meteredGeneration + r.meteredGeneration,
        downTime: acc.downTime + r.downTime,
        theoreticalGeneration: acc.theoreticalGeneration + r.theoreticalGeneration,
        overProduction: acc.overProduction + r.overProduction,
        realisedConsumption: acc.realisedConsumption + r.realisedConsumption,
        surplusDeficit: acc.surplusDeficit + r.surplusDeficit,
      }),
      { yieldGuarantee: 0, meteredGeneration: 0, downTime: 0, theoreticalGeneration: 0, overProduction: 0, realisedConsumption: 0, surplusDeficit: 0 }
    );
  }, [dailyRows]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">System Summary — {monthData.fullName} {year}</CardTitle>
      </CardHeader>

      {/* Worksheet-style tab bar */}
      <div className="px-6 flex items-end gap-0 border-b">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 text-xs font-medium border border-b-0 rounded-t-md transition-colors -mb-px",
              activeTab === tab
                ? "bg-background text-foreground border-border"
                : "bg-muted/50 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <CardContent className="pt-3 px-3">
        {activeTab === "Daily Performance" && (
          <ScrollArea className="w-full">
            <div className="min-w-[900px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-2 px-2 w-12">Days</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Yield Guarantee</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Metered Generation</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Down Time (06:00–18:00)</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Theoretical Generation</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Over Production</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Realised Consumption</TableHead>
                    <TableHead className="text-xs py-2 px-2 text-right">Surplus / Deficit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyRows.map((row, i) => (
                    <TableRow key={row.day} className={cn(i % 2 === 0 ? "bg-muted/30" : "")}>
                      <TableCell className="text-xs py-1.5 px-2 font-medium">{row.day}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatNum(row.yieldGuarantee)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatNum(row.meteredGeneration)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatNum(row.downTime)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatNum(row.theoreticalGeneration)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatNum(row.overProduction)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right tabular-nums">{formatNum(row.realisedConsumption)}</TableCell>
                      <TableCell className={cn("text-xs py-1.5 px-2 text-right tabular-nums font-medium", row.surplusDeficit < 0 ? "text-destructive" : "text-primary")}>
                        {formatNum(row.surplusDeficit)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell className="text-xs py-2 px-2 font-bold">Total</TableCell>
                    <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatNum(totals.yieldGuarantee)}</TableCell>
                    <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatNum(totals.meteredGeneration)}</TableCell>
                    <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatNum(totals.downTime)}</TableCell>
                    <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatNum(totals.theoreticalGeneration)}</TableCell>
                    <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatNum(totals.overProduction)}</TableCell>
                    <TableCell className="text-xs py-2 px-2 text-right tabular-nums font-bold">{formatNum(totals.realisedConsumption)}</TableCell>
                    <TableCell className={cn("text-xs py-2 px-2 text-right tabular-nums font-bold", totals.surplusDeficit < 0 ? "text-destructive" : "text-primary")}>
                      {formatNum(totals.surplusDeficit)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
