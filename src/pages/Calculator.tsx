import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Calculator as CalcIcon, Sun, Battery, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

// Simplified solar production constant: 1kWp = 140kWh/month average in South Africa
const KWP_TO_KWH_MONTHLY = 140;

export default function Calculator() {
  const [municipalityId, setMunicipalityId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tariffId, setTariffId] = useState("");
  const [monthlyConsumption, setMonthlyConsumption] = useState("");
  const [maxDemand, setMaxDemand] = useState("");
  const [solarSize, setSolarSize] = useState("");
  const [batterySize, setBatterySize] = useState("");
  const [systemCost, setSystemCost] = useState("");

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
    enabled: true,
  });

  const selectedTariff = useMemo(() => {
    return tariffs?.find((t) => t.id === tariffId);
  }, [tariffs, tariffId]);

  const calculateBill = (consumption: number) => {
    if (!selectedTariff) return 0;

    let energyCost = 0;
    const rates = (selectedTariff.rates as any[]) || [];

    if (selectedTariff.tariff_type === "IBT" && rates.length > 0) {
      // Sort rates by block_start_kwh
      const sortedRates = [...rates].sort((a, b) => a.block_start_kwh - b.block_start_kwh);
      let remainingConsumption = consumption;

      for (const rate of sortedRates) {
        if (remainingConsumption <= 0) break;

        const blockStart = rate.block_start_kwh;
        const blockEnd = rate.block_end_kwh ?? Infinity;
        const blockSize = blockEnd - blockStart;
        const consumptionInBlock = Math.min(remainingConsumption, blockSize);

        // Rate is in c/kWh, convert to R/kWh
        energyCost += consumptionInBlock * (rate.rate_per_kwh / 100);
        remainingConsumption -= consumptionInBlock;
      }
    } else if (rates.length > 0) {
      // Fixed or single rate - use first rate
      energyCost = consumption * (rates[0].rate_per_kwh / 100);
    }

    // Add fixed charges
    const fixedCost = selectedTariff.fixed_monthly_charge || 0;
    const demandCost = maxDemand ? parseFloat(maxDemand) * (selectedTariff.demand_charge_per_kva || 0) : 0;

    return fixedCost + demandCost + energyCost;
  };

  const results = useMemo(() => {
    const consumption = parseFloat(monthlyConsumption) || 0;
    const solar = parseFloat(solarSize) || 0;
    const cost = parseFloat(systemCost) || 0;

    if (!selectedTariff || consumption === 0) return null;

    const solarProduction = solar * KWP_TO_KWH_MONTHLY;
    const newConsumption = Math.max(0, consumption - solarProduction); // Can't go negative (no export)

    const currentBill = calculateBill(consumption);
    const newBill = calculateBill(newConsumption);
    const monthlySavings = currentBill - newBill;
    const yearlySavings = monthlySavings * 12;
    const paybackYears = cost > 0 && monthlySavings > 0 ? cost / (monthlySavings * 12) : 0;

    return {
      solarProduction,
      currentBill,
      newBill,
      monthlySavings,
      yearlySavings,
      paybackYears,
      selfConsumptionRatio: solarProduction > 0 ? Math.min(100, (newConsumption / consumption) * 100) : 100,
    };
  }, [selectedTariff, monthlyConsumption, solarSize, systemCost, maxDemand]);

  const chartData = results
    ? [
        { name: "Without Solar", bill: results.currentBill },
        { name: "With Solar", bill: results.newBill },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Solar ROI Calculator</h1>
        <p className="text-muted-foreground mt-1">
          Calculate your potential savings and payback period for solar installations
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <CalcIcon className="h-5 w-5" />
              Calculator Inputs
            </CardTitle>
            <CardDescription>Enter your details to calculate potential savings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Location & Tariff Selection */}
            <div className="space-y-4">
              <h3 className="font-medium text-foreground">Tariff Selection</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Municipality</Label>
                  <Select value={municipalityId} onValueChange={(v) => { setMunicipalityId(v); setTariffId(""); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select municipality" />
                    </SelectTrigger>
                    <SelectContent>
                      {municipalities?.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>User Type</Label>
                  <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setTariffId(""); }}>
                    <SelectTrigger>
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
              <div className="space-y-2">
                <Label>Current Tariff</Label>
                <Select value={tariffId} onValueChange={setTariffId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your tariff" />
                  </SelectTrigger>
                  <SelectContent>
                    {tariffs?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Consumption */}
            <div className="space-y-4">
              <h3 className="font-medium text-foreground">Current Usage</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Monthly Consumption (kWh)</Label>
                  <Input
                    type="number"
                    value={monthlyConsumption}
                    onChange={(e) => setMonthlyConsumption(e.target.value)}
                    placeholder="e.g., 500"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Demand (kVA) - Optional</Label>
                  <Input
                    type="number"
                    value={maxDemand}
                    onChange={(e) => setMaxDemand(e.target.value)}
                    placeholder="e.g., 25"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Solar System */}
            <div className="space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Sun className="h-4 w-4" />
                Proposed Solar System
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Solar Size (kWp)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={solarSize}
                    onChange={(e) => setSolarSize(e.target.value)}
                    placeholder="e.g., 5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Battery Size (kWh)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={batterySize}
                    onChange={(e) => setBatterySize(e.target.value)}
                    placeholder="e.g., 10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total System Cost (R)</Label>
                  <Input
                    type="number"
                    value={systemCost}
                    onChange={(e) => setSystemCost(e.target.value)}
                    placeholder="e.g., 150000"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                * Using simplified estimate: 1 kWp ≈ {KWP_TO_KWH_MONTHLY} kWh/month in South Africa
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-6">
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
                      {results.paybackYears > 0 ? `${results.paybackYears.toFixed(1)} years` : "-"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Simple payback calculation
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Bill Comparison */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-card-foreground flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Bill Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" className="text-muted-foreground" />
                        <YAxis className="text-muted-foreground" tickFormatter={(v) => `R${v}`} />
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
                <CardHeader>
                  <CardTitle className="text-card-foreground">Detailed Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Solar Production</span>
                    <span className="font-medium">{results.solarProduction.toFixed(0)} kWh/month</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Monthly Bill</span>
                    <span className="font-medium">R {results.currentBill.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">New Monthly Bill</span>
                    <span className="font-medium">R {results.newBill.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Grid Dependency</span>
                    <span className="font-medium">{results.selfConsumptionRatio.toFixed(0)}%</span>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center text-muted-foreground">
                <CalcIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a tariff and enter your consumption details to see results</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
