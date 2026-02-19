import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

interface TariffPeriodComparisonDialogProps {
  tariffName: string;
  municipalityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ChargeFilter = "basic" | "energy_low" | "energy_high" | "demand_low" | "demand_high";

const chargeFilterLabels: Record<ChargeFilter, string> = {
  basic: "Basic Charge (R/month)",
  energy_low: "Energy – Low/Summer",
  energy_high: "Energy – High/Winter",
  demand_low: "Demand – Low/Summer",
  demand_high: "Demand – High/Winter",
};

function formatPeriod(from: string | null, to: string | null): string {
  if (!from) return "Unknown";
  const f = new Date(from);
  const label = format(f, "MMM yyyy");
  if (to) {
    const t = new Date(to);
    return `${label} – ${format(t, "MMM yyyy")}`;
  }
  return `${label} →`;
}

export function TariffPeriodComparisonDialog({
  tariffName,
  municipalityId,
  open,
  onOpenChange,
}: TariffPeriodComparisonDialogProps) {
  const [chargeFilter, setChargeFilter] = useState<ChargeFilter>("energy_low");

  // Fetch all tariff plans with matching name in this municipality, ordered by effective_from
  const { data: periods, isLoading } = useQuery({
    queryKey: ["tariff-period-comparison", tariffName, municipalityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tariff_plans")
        .select(`
          id, name, effective_from, effective_to,
          tariff_rates(amount, charge, season, tou, unit)
        `)
        .eq("municipality_id", municipalityId)
        .eq("name", tariffName)
        .order("effective_from", { ascending: true, nullsFirst: true });

      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        name: string;
        effective_from: string | null;
        effective_to: string | null;
        tariff_rates: Array<{ amount: number; charge: string; season: string; tou: string; unit: string | null }>;
      }>;
    },
    enabled: open,
  });

  // Build chart data based on selected charge filter
  const chartData = useMemo(() => {
    if (!periods || periods.length < 2) return [];

    return periods.map((p) => {
      let value = 0;
      const rates = p.tariff_rates || [];

      switch (chargeFilter) {
        case "basic":
          value = rates.find((r) => r.charge === "basic")?.amount ?? 0;
          break;
        case "energy_low":
          value = rates
            .filter((r) => r.charge === "energy" && (r.season === "low" || r.season === "all") && r.tou === "all")
            .reduce((sum, r) => sum + r.amount, 0) || 
            rates.filter((r) => r.charge === "energy" && (r.season === "low" || r.season === "all"))
              .reduce((max, r) => Math.max(max, r.amount), 0);
          break;
        case "energy_high":
          value = rates
            .filter((r) => r.charge === "energy" && r.season === "high" && r.tou === "all")
            .reduce((sum, r) => sum + r.amount, 0) ||
            rates.filter((r) => r.charge === "energy" && r.season === "high")
              .reduce((max, r) => Math.max(max, r.amount), 0);
          break;
        case "demand_low":
          value = rates.find((r) => r.charge === "demand" && (r.season === "low" || r.season === "all"))?.amount ?? 0;
          break;
        case "demand_high":
          value = rates.find((r) => r.charge === "demand" && r.season === "high")?.amount ?? 0;
          break;
      }

      return {
        period: formatPeriod(p.effective_from, p.effective_to),
        value,
      };
    });
  }, [periods, chargeFilter]);

  // Calculate trend
  const trend = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    if (first === 0) return null;
    const totalChange = ((last - first) / first) * 100;
    const avgYoY = totalChange / (chartData.length - 1);
    return { totalChange, avgYoY, isUp: totalChange > 0 };
  }, [chartData]);

  const hasEnoughPeriods = (periods?.length ?? 0) >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Period Comparison
          </DialogTitle>
          <DialogDescription>
            {tariffName} — YoY charge trends
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            Loading periods…
          </div>
        ) : !hasEnoughPeriods ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            At least 2 effective date periods are needed for comparison.
            <br />
            <span className="text-xs">Set effective dates on tariff plans to enable this feature.</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Charge filter */}
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Charge Type</Label>
              <Select value={chargeFilter} onValueChange={(v) => setChargeFilter(v as ChargeFilter)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {Object.entries(chargeFilterLabels).map(([k, label]) => (
                    <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Trend badges */}
            {trend && (
              <div className="flex items-center gap-3">
                <Badge variant={trend.isUp ? "destructive" : "secondary"} className="gap-1 text-xs">
                  {trend.isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {trend.totalChange >= 0 ? "+" : ""}{trend.totalChange.toFixed(1)}% total
                </Badge>
                <Badge variant="outline" className="text-xs">
                  ~{trend.avgYoY >= 0 ? "+" : ""}{trend.avgYoY.toFixed(1)}% avg/year
                </Badge>
              </div>
            )}

            {/* Bar chart */}
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(value: number) => [value.toFixed(2), chargeFilterLabels[chargeFilter]]}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
