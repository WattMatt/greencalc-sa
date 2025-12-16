import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Battery, 
  Sun, 
  AlertTriangle,
  Shield,
  DollarSign,
  Thermometer,
  Scale,
  MapPin,
  Clock
} from "lucide-react";

interface DcAcRatioInfographicProps {
  className?: string;
  selectedRatio?: number;
  hasBESS?: boolean;
  region?: "high-sun" | "moderate" | "cloudy";
}

const ratioData = [
  { ratio: 1.0, clipping: 0, yieldGain: 0, label: "Baseline" },
  { ratio: 1.2, clipping: 0.25, yieldGain: 4, label: "Conservative" },
  { ratio: 1.3, clipping: 0.9, yieldGain: 12, label: "Optimal (SA)" },
  { ratio: 1.4, clipping: 3, yieldGain: 15, label: "Moderate" },
  { ratio: 1.5, clipping: 4.9, yieldGain: 17, label: "Aggressive" },
  { ratio: 2.0, clipping: 20, yieldGain: 22, label: "BESS Only" },
];

const benefits = [
  { icon: Zap, title: "Higher Inverter Utilization", description: "Inverter operates closer to peak efficiency throughout the day" },
  { icon: TrendingUp, title: "Increased Annual Yield", description: "5-15% more energy from morning/evening production" },
  { icon: DollarSign, title: "Lower LCOE", description: "Fixed costs spread across more kWh generated" },
  { icon: Scale, title: "Reduced CapEx", description: "Smaller inverter for same DC array size" },
];

const risks = [
  { icon: AlertTriangle, title: "Clipping Losses", description: "Peak production curtailed when DC exceeds AC limit" },
  { icon: Thermometer, title: "Equipment Stress", description: "Higher operating temperatures reduce inverter lifespan" },
  { icon: Shield, title: "Warranty Limits", description: "Exceeding manufacturer specs may void warranty" },
  { icon: MapPin, title: "Regulatory Caps", description: "Some regions limit oversizing (e.g., 70% rule)" },
];

const regionalRecommendations = {
  "high-sun": { range: "1.1 - 1.35", note: "Conservative due to high irradiance", yield: "~1864 kWh/kWp" },
  "moderate": { range: "1.2 - 1.4", note: "Balanced approach", yield: "~1600 kWh/kWp" },
  "cloudy": { range: "1.3 - 1.5", note: "Higher ratio to capture diffuse light", yield: "~1100 kWh/kWp" },
};

export function DcAcRatioInfographic({ 
  className, 
  selectedRatio = 1.3, 
  hasBESS = false,
  region = "high-sun" 
}: DcAcRatioInfographicProps) {
  const closestData = ratioData.reduce((prev, curr) => 
    Math.abs(curr.ratio - selectedRatio) < Math.abs(prev.ratio - selectedRatio) ? curr : prev
  );
  
  const recommendation = regionalRecommendations[region];

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sun className="h-5 w-5 text-amber-500" />
          DC/AC Ratio Trade-off Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ratio Scale Visualization */}
        <div className="relative">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Conservative</span>
            <span>Optimal</span>
            <span>Aggressive</span>
          </div>
          <div className="h-3 bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 rounded-full relative">
            {/* Selected ratio marker */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-background border-2 border-primary rounded-full shadow-lg"
              style={{ left: `${Math.min(100, Math.max(0, ((selectedRatio - 1.0) / 1.0) * 100))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs font-medium mt-1">
            <span>1.0</span>
            <span>1.3</span>
            <span>1.5</span>
            <span>2.0</span>
          </div>
        </div>

        {/* Current Selection Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{selectedRatio.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">DC/AC Ratio</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">~{closestData.clipping}%</p>
            <p className="text-xs text-muted-foreground">Clipping Loss</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">+{closestData.yieldGain}%</p>
            <p className="text-xs text-muted-foreground">Yield Gain</p>
          </div>
        </div>

        {/* Benefits vs Risks */}
        <div className="grid grid-cols-2 gap-4">
          {/* Benefits */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">Benefits</span>
            </div>
            {benefits.map((item, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-md">
                <item.icon className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Risks */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-sm text-red-700 dark:text-red-400">Risks</span>
            </div>
            {risks.map((item, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-md">
                <item.icon className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Regional Recommendation */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Regional Recommendation</span>
            </div>
            <Badge variant="outline" className="text-xs capitalize">{region.replace("-", " ")}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Optimal Range</p>
              <p className="font-semibold">{recommendation.range}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Expected Yield</p>
              <p className="font-semibold">{recommendation.yield}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Note</p>
              <p className="font-semibold">{recommendation.note}</p>
            </div>
          </div>
        </div>

        {/* BESS Impact */}
        {hasBESS && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Battery className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm text-blue-700 dark:text-blue-400">
                BESS Integration Detected
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Battery storage captures "clipped" energy, justifying higher DC/AC ratios up to 2.0:1
            </p>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Charge priority over export</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                <span>Clipped → Stored energy</span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Reference Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Ratio</th>
                <th className="px-2 py-1.5 text-left font-medium">Clipping</th>
                <th className="px-2 py-1.5 text-left font-medium">Yield Gain</th>
                <th className="px-2 py-1.5 text-left font-medium">Use Case</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ratioData.map((row) => (
                <tr 
                  key={row.ratio} 
                  className={row.ratio === closestData.ratio ? "bg-primary/10" : ""}
                >
                  <td className="px-2 py-1.5 font-medium">{row.ratio.toFixed(1)}:1</td>
                  <td className="px-2 py-1.5 text-amber-600">{row.clipping < 1 ? `<${row.clipping}%` : `~${row.clipping}%`}</td>
                  <td className="px-2 py-1.5 text-emerald-600">+{row.yieldGain}%</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{row.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
