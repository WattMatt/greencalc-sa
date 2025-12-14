import { useState } from "react";
import { QuickEstimateForm, QuickEstimateInputs } from "@/components/simulation/QuickEstimateForm";
import { QuickEstimateResults, QuickEstimateOutput } from "@/components/simulation/QuickEstimateResults";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DEFAULT_INPUTS: QuickEstimateInputs = {
  location: "",
  latitude: 0,
  longitude: 0,
  peakSunHours: 5.5,
  siteArea: 5000,
  monthlyConsumption: 250000,
  solarCapacity: 500,
  batteryCapacity: 0,
  useSolcast: false,
  systemLosses: 14,
  tariffRate: 2.50,
  tariffEscalation: 10,
};

const SOLAR_COST_PER_KW = 12000; // R/kWp installed
const BATTERY_COST_PER_KWH = 8000; // R/kWh installed

export default function QuickEstimate() {
  const navigate = useNavigate();
  const [inputs, setInputs] = useState<QuickEstimateInputs>(DEFAULT_INPUTS);
  const [results, setResults] = useState<QuickEstimateOutput | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateEstimate = () => {
    setIsCalculating(true);
    
    // Simulate async calculation
    setTimeout(() => {
      const { solarCapacity, batteryCapacity, peakSunHours, systemLosses, monthlyConsumption, tariffRate, tariffEscalation } = inputs;
      
      // Energy calculations
      const annualConsumption = monthlyConsumption * 12;
      const dailyGeneration = solarCapacity * peakSunHours * (1 - systemLosses / 100);
      const annualGeneration = dailyGeneration * 365;
      
      // Self-consumption estimate (simplified)
      const selfConsumptionRatio = Math.min(0.85, annualConsumption / annualGeneration);
      const selfConsumption = annualGeneration * selfConsumptionRatio;
      const gridExport = annualGeneration - selfConsumption;
      const solarCoverage = (selfConsumption / annualConsumption) * 100;
      
      // Financial calculations
      const systemCost = (solarCapacity * SOLAR_COST_PER_KW) + (batteryCapacity * BATTERY_COST_PER_KWH);
      const annualSavings = selfConsumption * tariffRate;
      
      // Simple payback
      const paybackYears = systemCost / annualSavings;
      
      // 25-year ROI with escalation
      let totalSavings = 0;
      for (let year = 1; year <= 25; year++) {
        const escalatedRate = tariffRate * Math.pow(1 + tariffEscalation / 100, year - 1);
        const yearlyGeneration = annualGeneration * Math.pow(0.995, year - 1); // 0.5% degradation
        const yearlySelfConsumption = yearlyGeneration * selfConsumptionRatio;
        totalSavings += yearlySelfConsumption * escalatedRate;
      }
      const roi25Years = ((totalSavings - systemCost) / systemCost) * 100;
      
      // LCOE
      const totalGeneration25Years = annualGeneration * 25 * 0.9; // Average with degradation
      const lcoe = systemCost / totalGeneration25Years;
      
      setResults({
        annualGeneration,
        dailyGeneration,
        selfConsumption,
        gridExport,
        solarCoverage,
        annualSavings,
        systemCost,
        paybackYears,
        roi25Years,
        lcoe,
        assumptions: {
          peakSunHours,
          systemLosses,
          tariffRate,
          tariffEscalation,
          solarCostPerKw: SOLAR_COST_PER_KW,
          batteryCostPerKwh: BATTERY_COST_PER_KWH,
        },
      });
      
      setIsCalculating(false);
    }, 500);
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/simulations")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quick Estimate</h1>
          <p className="text-muted-foreground">
            Get instant ballpark figures for a theoretical solar installation
          </p>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        <QuickEstimateForm
          inputs={inputs}
          onInputChange={setInputs}
          onCalculate={calculateEstimate}
          isCalculating={isCalculating}
        />
        <QuickEstimateResults results={results} />
      </div>
    </div>
  );
}
