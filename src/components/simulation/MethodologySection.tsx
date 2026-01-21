import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, BookOpen } from "lucide-react";
import { useState } from "react";

interface MethodologyItem {
  title: string;
  content: React.ReactNode;
}

interface MethodologySectionProps {
  items: MethodologyItem[];
  className?: string;
}

export const solarMethodology: MethodologyItem = {
  title: "Solar Generation Calculation",
  content: (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>Solar generation is calculated using the following formula:</p>
      <div className="bg-muted/50 p-3 rounded-md font-mono text-xs">
        Daily kWh = System Size (kWp) × Peak Sun Hours × System Efficiency
      </div>
      <ul className="list-disc list-inside space-y-1">
        <li><strong>System Size (kWp)</strong>: The DC capacity of the PV array</li>
        <li><strong>Peak Sun Hours (PSH)</strong>: Location-specific solar resource (typically 4.5-6.5 hours in South Africa)</li>
        <li><strong>System Efficiency</strong>: Accounts for inverter losses, soiling, temperature derating, and cable losses (typically 80-85%)</li>
      </ul>
      <p>When Solcast data is available, actual hourly irradiance values replace the generic PSH model for improved accuracy.</p>
      <p><strong>DC/AC Ratio</strong>: Arrays are often oversized (e.g., 130%) to maximize morning/evening generation. Output is clipped at inverter AC capacity.</p>
    </div>
  ),
};

export const batteryMethodology: MethodologyItem = {
  title: "Battery Simulation Logic",
  content: (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>Battery charge/discharge is simulated hour-by-hour using these rules:</p>
      <div className="space-y-2">
        <div className="bg-muted/50 p-3 rounded-md">
          <p className="font-semibold text-foreground">Charging (when excess solar available):</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Charges from excess PV generation (solar &gt; load)</li>
            <li>Limited by battery power rating (kW)</li>
            <li>Stops at 95% State of Charge (SoC) to preserve battery life</li>
          </ul>
        </div>
        <div className="bg-muted/50 p-3 rounded-md">
          <p className="font-semibold text-foreground">Discharging (during Peak/Standard TOU periods):</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Discharges only during Peak and Standard TOU periods</li>
            <li>Reduces grid import by supplying stored energy to load</li>
            <li>Limited by battery power rating (kW)</li>
            <li>Stops at 10% SoC (Depth of Discharge limit)</li>
          </ul>
        </div>
      </div>
      <p><strong>Usable Capacity</strong> = Battery Capacity × 85% (between 10% and 95% SoC limits)</p>
    </div>
  ),
};

export const financialMethodology: MethodologyItem = {
  title: "Financial Projections Methodology",
  content: (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>Financial analysis uses a 20-year projection model with the following assumptions:</p>
      <div className="grid gap-2">
        <div className="bg-muted/50 p-3 rounded-md">
          <p className="font-semibold text-foreground">Annual Savings Calculation:</p>
          <div className="font-mono text-xs mt-1">
            Savings = (Solar Self-Consumption × Tariff Rate) + (Battery Shifted Energy × Peak/Standard Rate Difference)
          </div>
        </div>
        <div className="bg-muted/50 p-3 rounded-md">
          <p className="font-semibold text-foreground">Key Assumptions:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li><strong>Panel Degradation</strong>: 0.5% per year (industry standard)</li>
            <li><strong>Tariff Escalation</strong>: 8% per year (based on historical SA increases)</li>
            <li><strong>System Lifespan</strong>: 20 years for panels, 10-15 years for batteries</li>
            <li><strong>Discount Rate</strong>: 10% for NPV calculations</li>
          </ul>
        </div>
        <div className="bg-muted/50 p-3 rounded-md">
          <p className="font-semibold text-foreground">ROI & Payback:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li><strong>Simple Payback</strong> = System Cost ÷ Year 1 Savings</li>
            <li><strong>20-Year ROI</strong> = (Cumulative Savings - System Cost) ÷ System Cost × 100%</li>
            <li><strong>LCOE</strong> = Total Lifetime Cost ÷ Total Lifetime Generation</li>
          </ul>
        </div>
      </div>
    </div>
  ),
};

export const touMethodology: MethodologyItem = {
  title: "Time-of-Use (TOU) Periods",
  content: (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>South African TOU tariffs use three pricing periods:</p>
      <div className="grid gap-2">
        <div className="bg-red-500/10 p-3 rounded-md border-l-4 border-red-500">
          <p className="font-semibold text-foreground">Peak (Highest Cost)</p>
          <p>Weekdays: 07:00-10:00 and 18:00-20:00</p>
        </div>
        <div className="bg-amber-500/10 p-3 rounded-md border-l-4 border-amber-500">
          <p className="font-semibold text-foreground">Standard (Mid Cost)</p>
          <p>Weekdays: 06:00-07:00, 10:00-18:00, and 20:00-22:00</p>
        </div>
        <div className="bg-teal-500/10 p-3 rounded-md border-l-4 border-teal-500">
          <p className="font-semibold text-foreground">Off-Peak (Lowest Cost)</p>
          <p>Weekdays: 22:00-06:00 | Weekends: All day</p>
        </div>
      </div>
      <p className="mt-2"><strong>Seasonal Variation</strong>: High Demand Season (June-August) has higher rates than Low Demand Season (September-May).</p>
    </div>
  ),
};

export function MethodologySection({ items, className = "" }: MethodologySectionProps) {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    setOpenItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <Card className={`border-dashed ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Methodology & Assumptions</h3>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <Collapsible
              key={index}
              open={openItems.has(index)}
              onOpenChange={() => toggleItem(index)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-left text-sm font-medium hover:bg-muted/50 rounded-md transition-colors">
                {item.title}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    openItems.has(index) ? "rotate-180" : ""
                  }`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-2 pb-2">
                {item.content}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
