import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { 
  TOUClockDiagram, 
  TOUClockLegend, 
  ESKOM_HIGH_DEMAND_PERIODS, 
  ESKOM_LOW_DEMAND_PERIODS 
} from "./TOUClockDiagram";
import { Info, Clock, Calendar, Zap, AlertTriangle, Gauge } from "lucide-react";

export function TOUReference() {
  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2">
            <Info className="h-5 w-5" />
            Time of Use (TOU) Reference
          </CardTitle>
          <CardDescription>
            TOU tariffs ensure cost-reflective pricing by reflecting the cost of supply for different combinations of generation categories (base, mid merit, and peak) needed to meet integrated system demand.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Clock Diagrams */}
          <div className="grid gap-8 md:grid-cols-2">
            <TOUClockDiagram 
              title="High-Demand Season (Winter)" 
              periods={ESKOM_HIGH_DEMAND_PERIODS} 
              size={280}
            />
            <TOUClockDiagram 
              title="Low-Demand Season (Summer)" 
              periods={ESKOM_LOW_DEMAND_PERIODS} 
              size={280}
            />
          </div>
          
          <TOUClockLegend />

          {/* Detailed Breakdown */}
          <Accordion type="multiple" className="w-full">
            {/* Seasonal Span */}
            <AccordionItem value="seasonal">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-semibold">Time of Use Across a Year (Seasonal Span)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    The annual span for TOU differentiation is based on seasonality, reflecting the significant difference in usage (demand) during high and low periods nationally. All tariffs should be differentiated by season to accurately reflect the full cost difference.
                  </p>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-blue-600">Winter</Badge>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">High Demand Season</span>
                      </div>
                      <p className="text-sm font-medium">June - August</p>
                      <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                        <li>• Peak and Standard energy charges are significantly higher</li>
                        <li>• Demand charges (R/kVA) apply a specific higher rate</li>
                        <li>• Reflects maximum system strain and cost of supply</li>
                      </ul>
                    </div>
                    
                    <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-amber-600">Summer</Badge>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">Low Demand Season</span>
                      </div>
                      <p className="text-sm font-medium">September - May</p>
                      <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                        <li>• Energy charges across all periods are lower</li>
                        <li>• Reflects reduced system strain</li>
                        <li>• Lower overall costs of supply</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Time Periods */}
            <AccordionItem value="periods">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-semibold">Time of Use Across a Week (Time Periods)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    TOU tariffs categorize energy consumption (c/kWh) and demand charges (R/kVA) into distinct periods defined by the relative cost of supplying power during those hours:
                  </p>
                  
                  <div className="grid gap-3">
                    <div className="p-3 rounded-lg border-l-4 border-l-red-500 bg-red-500/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="destructive">Peak</Badge>
                        <span className="font-semibold">Highest Cost Period</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Corresponds to times of maximum system stress. Consumption carries the highest energy rate (c/kWh). 
                        Sophisticated TOU tariffs may include a <strong>Super Peak</strong> rate during interruptions using cost of unserved energy.
                      </p>
                    </div>
                    
                    <div className="p-3 rounded-lg border-l-4 border-l-yellow-500 bg-yellow-500/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-yellow-600">Standard</Badge>
                        <span className="font-semibold">Intermediate Cost Period</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Reflects a cost higher than Off-Peak but lower than Peak. Covers normal daytime operations.
                      </p>
                    </div>
                    
                    <div className="p-3 rounded-lg border-l-4 border-l-green-500 bg-green-500/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-green-600">Off-Peak</Badge>
                        <span className="font-semibold">Lowest Cost Period</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Designed to incentivize customers to shift energy load from high demand periods. Typically overnight hours.
                      </p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Critical Peak Pricing */}
            <AccordionItem value="critical-peak">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-semibold">Critical Peak Pricing (CPP)</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-5 w-5 text-destructive" />
                      <span className="font-semibold text-destructive">System Emergency Pricing</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      In extreme cases, <strong>Critical Peak Pricing Tariffs</strong> are introduced with periods of very high prices when the system's reliability is threatened. 
                      These use the <strong>cost of unserved energy</strong> to set penalty signals during load shedding or grid emergencies.
                    </p>
                    <div className="mt-3 p-2 rounded bg-background">
                      <p className="text-xs text-muted-foreground">
                        Example: Super Peak rate of R15-25/kWh during Stage 4+ load shedding vs normal Peak of R2-3/kWh
                      </p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Demand Measurement */}
            <AccordionItem value="demand">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4" />
                  <span className="font-semibold">Demand Measurement & Metering</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="p-4 rounded-lg bg-muted">
                    <h4 className="font-semibold mb-2">Demand Measurement</h4>
                    <p className="text-sm text-muted-foreground">
                      For customers on TOU tariffs, demand (kVA) is measured over <strong>half-hourly integrating periods</strong>. 
                      Monthly maximum demand charges (R/kVA/m) are levied based on the highest demand registered during the expensive <strong>Peak or Standard periods</strong>.
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-muted">
                    <h4 className="font-semibold mb-2">Metering Requirements</h4>
                    <p className="text-sm text-muted-foreground">
                      Implementing TOU tariffs requires metering capable of Time-of-Use measurement. Licensees can choose:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li>• Half-hourly reconciliation (most granular)</li>
                      <li>• Hourly reconciliation (minimum recommended)</li>
                      <li>• Monthly time-of-use reconciliation</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Quick Reference Tables */}
          <div className="grid gap-4 md:grid-cols-2 mt-6">
            <div className="p-4 rounded-lg bg-accent/50">
              <h4 className="font-semibold text-foreground mb-2">High-Demand Season (Jun-Aug)</h4>
              <div className="space-y-1 text-sm">
                <p><strong className="text-red-600">Peak:</strong> Weekdays 06:00-09:00 & 17:00-20:00</p>
                <p><strong className="text-yellow-600">Standard:</strong> Weekdays 09:00-17:00 & 20:00-22:00</p>
                <p><strong className="text-yellow-600">Standard:</strong> Sat/Sun 07:00-12:00 & 18:00-20:00</p>
                <p><strong className="text-green-600">Off-Peak:</strong> All other times</p>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-accent/50">
              <h4 className="font-semibold text-foreground mb-2">Low-Demand Season (Sep-May)</h4>
              <div className="space-y-1 text-sm">
                <p><strong className="text-red-600">Peak:</strong> Weekdays 07:00-10:00 & 18:00-20:00</p>
                <p><strong className="text-yellow-600">Standard:</strong> Weekdays 06:00-07:00, 10:00-18:00 & 20:00-22:00</p>
                <p><strong className="text-yellow-600">Standard:</strong> Sat 07:00-12:00 & 18:00-20:00</p>
                <p><strong className="text-yellow-600">Standard:</strong> Sun 07:00-12:00</p>
                <p><strong className="text-green-600">Off-Peak:</strong> All other times</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
