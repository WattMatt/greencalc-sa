import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Calculator as CalcIcon, Sun, TrendingUp, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ConsumptionProfile, ProfileType, RESIDENTIAL_PROFILE } from "@/components/calculator/ConsumptionProfile";
import { useTOUCalculation } from "@/hooks/useTOUCalculation";

const KWP_TO_KWH_MONTHLY = 140;

const TOU_COLORS: Record<string, string> = {
  Peak: "hsl(0, 70%, 50%)",
  Standard: "hsl(45, 80%, 50%)",
  "Off-Peak": "hsl(142, 70%, 45%)",
};

export default function Calculator() {
  const [municipalityId, setMunicipalityId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tariffId, setTariffId] = useState("");
  const [monthlyConsumption, setMonthlyConsumption] = useState("");
  const [maxDemand, setMaxDemand] = useState("");
  const [solarSize, setSolarSize] = useState("");
  const [batterySize, setBatterySize] = useState("");
  const [systemCost, setSystemCost] = useState("");
  const [isHighDemandSeason, setIsHighDemandSeason] = useState(false);
  const [profileType, setProfileType] = useState<ProfileType>("residential");
  const [customProfile, setCustomProfile] = useState<number[]>(RESIDENTIAL_PROFILE);
  const [weekdayPercentage, setWeekdayPercentage] = useState(70);

  const { data: municipalities } = useQuery({
    queryKey: ["municipalities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("municipalities").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["tariff-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tariff_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tariffs } = useQuery({
    queryKey: ["tariffs-filtered", municipalityId, categoryId],
    queryFn: async () => {
      let query = supabase.from("tariffs").select(`*, rates:tariff_rates(*)`);
      if (municipalityId) query = query.eq("municipality_id", municipalityId);
      if (categoryId) query = query.eq("category_id", categoryId);
      const { data, error } = await query.order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: touPeriods } = useQuery({
    queryKey: ["tou-periods", tariffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tou_periods")
        .select("*")
        .eq("tariff_id", tariffId);
      if (error) throw error;
      return data;
    },
    enabled: !!tariffId,
  });

  const selectedTariff = useMemo(() => {
    return tariffs?.find((t) => t.id === tariffId);
  }, [tariffs, tariffId]);

  const isTOUTariff = selectedTariff?.tariff_type === "TOU";

  const currentBillCalc = useTOUCalculation({
    monthlyConsumption: parseFloat(monthlyConsumption) || 0,
    tariffType: selectedTariff?.tariff_type || "Fixed",
    rates: (selectedTariff?.rates as any[]) || [],
    touPeriods: touPeriods || [],
    fixedMonthlyCharge: selectedTariff?.fixed_monthly_charge || 0,
    demandChargePerKva: selectedTariff?.demand_charge_per_kva || 0,
    maxDemand: parseFloat(maxDemand) || 0,
    profileType,
    customProfile,
    weekdayPercentage,
    isHighDemandSeason,
  });

  const solarProduction = (parseFloat(solarSize) || 0) * KWP_TO_KWH_MONTHLY;
  const newConsumption = Math.max(0, (parseFloat(monthlyConsumption) || 0) - solarProduction);

  const newBillCalc = useTOUCalculation({
    monthlyConsumption: newConsumption,
    tariffType: selectedTariff?.tariff_type || "Fixed",
    rates: (selectedTariff?.rates as any[]) || [],
    touPeriods: touPeriods || [],
    fixedMonthlyCharge: selectedTariff?.fixed_monthly_charge || 0,
    demandChargePerKva: selectedTariff?.demand_charge_per_kva || 0,
    maxDemand: parseFloat(maxDemand) || 0,
    profileType,
    customProfile,
    weekdayPercentage,
    isHighDemandSeason,
  });

  const results = useMemo(() => {
    if (!currentBillCalc || !selectedTariff) return null;

    const consumption = parseFloat(monthlyConsumption) || 0;
    const cost = parseFloat(systemCost) || 0;
    const currentBill = currentBillCalc.totalBill;
    const newBill = newBillCalc?.totalBill || 0;
    const monthlySavings = currentBill - newBill;
    const yearlySavings = monthlySavings * 12;
    const paybackYears = cost > 0 && monthlySavings > 0 ? cost / yearlySavings : 0;

    return {
      solarProduction,
      currentBill,
      newBill,
      monthlySavings,
      yearlySavings,
      paybackYears,
      gridDependency: consumption > 0 ? (newConsumption / consumption) * 100 : 100,
      breakdown: currentBillCalc.breakdown,
      season: currentBillCalc.season,
    };
  }, [currentBillCalc, newBillCalc, selectedTariff, monthlyConsumption, systemCost, solarProduction, newConsumption]);

  const chartData = results
    ? [
        { name: "Without Solar", bill: results.currentBill },
        { name: "With Solar", bill: results.newBill },
      ]
    : [];

  const pieData = results?.breakdown
    ? Object.entries(results.breakdown)
        .filter(([_, v]) => v > 0)
        .map(([name, value]) => ({ name, value: Math.round(value) }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Solar ROI Calculator</h1>
        <p className="text-muted-foreground mt-1">
          Calculate your potential savings with granular TOU period analysis
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <CalcIcon className="h-5 w-5" />
                Calculator Inputs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tariff Selection */}
              <div className="space-y-4">
                <h3 className="font-medium text-foreground text-sm">Tariff Selection</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Municipality</Label>
                    <Select value={municipalityId} onValueChange={(v) => { setMunicipalityId(v); setTariffId(""); }}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select municipality" />
                      </SelectTrigger>
                      <SelectContent>
                        {municipalities?.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">User Type</Label>
                    <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setTariffId(""); }}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Current Tariff</Label>
                  <Select value={tariffId} onValueChange={setTariffId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select your tariff" />
                    </SelectTrigger>
                    <SelectContent>
                      {tariffs?.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} {t.tariff_type === "TOU" && "(TOU)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isTOUTariff && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <Label className="text-sm font-medium">Season</Label>
                      <p className="text-xs text-muted-foreground">
                        {isHighDemandSeason ? "High Demand (Jun-Aug)" : "Low Demand (Sep-May)"}
                      </p>
                    </div>
                    <Switch
                      checked={isHighDemandSeason}
                      onCheckedChange={setIsHighDemandSeason}
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Consumption */}
              <div className="space-y-4">
                <h3 className="font-medium text-foreground text-sm">Current Usage</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Monthly Consumption (kWh)</Label>
                    <Input
                      type="number"
                      className="h-9"
                      value={monthlyConsumption}
                      onChange={(e) => setMonthlyConsumption(e.target.value)}
                      placeholder="e.g., 500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max Demand (kVA)</Label>
                    <Input
                      type="number"
                      className="h-9"
                      value={maxDemand}
                      onChange={(e) => setMaxDemand(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Solar System */}
              <div className="space-y-4">
                <h3 className="font-medium text-foreground text-sm flex items-center gap-2">
                  <Sun className="h-4 w-4" />
                  Proposed Solar System
                </h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Solar Size (kWp)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-9"
                      value={solarSize}
                      onChange={(e) => setSolarSize(e.target.value)}
                      placeholder="e.g., 5"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Battery (kWh)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      className="h-9"
                      value={batterySize}
                      onChange={(e) => setBatterySize(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">System Cost (R)</Label>
                    <Input
                      type="number"
                      className="h-9"
                      value={systemCost}
                      onChange={(e) => setSystemCost(e.target.value)}
                      placeholder="e.g., 150000"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  * 1 kWp ≈ {KWP_TO_KWH_MONTHLY} kWh/month in South Africa
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Consumption Profile - only show for TOU tariffs */}
          {isTOUTariff && (
            <ConsumptionProfile
              profileType={profileType}
              onProfileTypeChange={setProfileType}
              customProfile={customProfile}
              onCustomProfileChange={setCustomProfile}
              weekdayPercentage={weekdayPercentage}
              onWeekdayPercentageChange={setWeekdayPercentage}
            />
          )}
        </div>

        {/* Results */}
        <div className="space-y-4">
          {results ? (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 grid-cols-2">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Savings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      R {results.monthlySavings.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      R {results.yearlySavings.toFixed(2)} per year
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Payback Period</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {results.paybackYears > 0 ? `${results.paybackYears.toFixed(1)} yrs` : "-"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {results.season} season
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* TOU Breakdown Pie Chart */}
              {isTOUTariff && pieData.length > 0 && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-card-foreground flex items-center gap-2 text-sm">
                      <Zap className="h-4 w-4" />
                      TOU Consumption Breakdown
                    </CardTitle>
                    <CardDescription className="text-xs">
                      How your usage is distributed across rate periods
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {pieData.map((entry) => (
                              <Cell key={entry.name} fill={TOU_COLORS[entry.name] || "hsl(var(--muted))"} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => [`${value} kWh`, "Consumption"]}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "var(--radius)",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 text-xs">
                      {Object.entries(TOU_COLORS).map(([name, color]) => (
                        <div key={name} className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                          <span>{name}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bill Comparison */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-card-foreground flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4" />
                    Bill Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" className="text-muted-foreground" tick={{ fontSize: 12 }} />
                        <YAxis className="text-muted-foreground" tickFormatter={(v) => `R${v}`} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value: number) => [`R ${value.toFixed(2)}`, "Monthly Bill"]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                        />
                        <Bar dataKey="bill" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Breakdown */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-card-foreground text-sm">Detailed Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Solar Production</span>
                    <span className="font-medium">{results.solarProduction.toFixed(0)} kWh/mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Bill</span>
                    <span className="font-medium">R {results.currentBill.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New Bill</span>
                    <span className="font-medium">R {results.newBill.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Grid Dependency</span>
                    <span className="font-medium">{results.gridDependency.toFixed(0)}%</span>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center text-muted-foreground">
                <CalcIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a tariff and enter consumption to see results</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
