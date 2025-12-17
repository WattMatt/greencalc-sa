import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TOUClockDiagram, 
  TOUClockLegend, 
  ESKOM_HIGH_DEMAND_PERIODS, 
  ESKOM_LOW_DEMAND_PERIODS 
} from "./TOUClockDiagram";
import { TOUTimeGrid, TOUPeriodSummary } from "./TOUTimeGrid";
import { Info, Clock, Calendar, Zap, AlertTriangle, Gauge, Sun, Snowflake } from "lucide-react";

export function TOUReference() {
  return (
    <div className="space-y-6">
      {/* Main TOU Visual */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-card-foreground flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time of Use (TOU) Periods
              </CardTitle>
              <CardDescription className="mt-1">
                Eskom 2025/2026 - Updated per NERSA approval (11 March 2025)
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              Effective 1 April 2025
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* 2025 Changes Alert */}
          <div className="mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <h4 className="font-semibold text-sm text-blue-600 dark:text-blue-400 mb-2">
              2025/2026 TOU Period Changes
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Morning peak reduced from 3 hours to <strong>2 hours</strong> (07:00-09:00)</li>
              <li>• Evening peak increased from 2 hours to <strong>3 hours</strong> (17:00-20:00)</li>
              <li>• New <strong>2-hour standard period on Sunday evenings</strong> (18:00-20:00)</li>
              <li>• Peak-to-off-peak ratio reduced from 8:1 to <strong>6:1</strong></li>
            </ul>
          </div>

          <Tabs defaultValue="grid" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="grid" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timeline View
              </TabsTrigger>
              <TabsTrigger value="clock" className="flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Clock View
              </TabsTrigger>
            </TabsList>

            <TabsContent value="grid" className="space-y-6">
              {/* High Demand Season */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Snowflake className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">High-Demand Season (Winter)</h3>
                    <p className="text-sm text-muted-foreground">June - August</p>
                  </div>
                </div>
                <TOUTimeGrid season="High" />
              </div>

              <div className="border-t border-border my-6" />

              {/* Low Demand Season */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Sun className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Low-Demand Season (Summer)</h3>
                    <p className="text-sm text-muted-foreground">September - May</p>
                  </div>
                </div>
                <TOUTimeGrid season="Low" showLegend={false} />
              </div>
            </TabsContent>

            <TabsContent value="clock" className="space-y-6">
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Detailed Period Summary */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5" />
            Detailed Period Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Snowflake className="h-4 w-4 text-blue-500" />
                <span className="font-semibold text-sm">High-Demand (Jun-Aug)</span>
              </div>
              <TOUPeriodSummary season="High" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sun className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-sm">Low-Demand (Sep-May)</span>
              </div>
              <TOUPeriodSummary season="Low" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Information Accordion */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground flex items-center gap-2 text-base">
            <Info className="h-5 w-5" />
            Additional Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {/* Seasonal Span */}
            <AccordionItem value="seasonal">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-semibold">Seasonal Span & Cost Implications</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    TOU differentiation is based on seasonality, reflecting the significant difference in demand nationally. Higher rates during winter reflect maximum system strain.
                  </p>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-blue-600">Winter</Badge>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">High Demand</span>
                      </div>
                      <p className="text-sm font-medium">June - August</p>
                      <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                        <li>• Peak and Standard rates significantly higher</li>
                        <li>• Demand charges (R/kVA) apply higher rate</li>
                        <li>• Maximum system strain period</li>
                      </ul>
                    </div>
                    
                    <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-amber-600">Summer</Badge>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">Low Demand</span>
                      </div>
                      <p className="text-sm font-medium">September - May</p>
                      <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                        <li>• Energy charges across all periods lower</li>
                        <li>• Reduced system strain</li>
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
                  <span className="font-semibold">Understanding TOU Periods</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="grid gap-3">
                    <div className="p-3 rounded-lg border-l-4 border-l-red-500 bg-red-500/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="destructive">Peak</Badge>
                        <span className="font-semibold">Highest Cost Period</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Times of maximum system stress. Morning (07:00-09:00) and evening (17:00-20:00) on weekdays only.
                      </p>
                    </div>
                    
                    <div className="p-3 rounded-lg border-l-4 border-l-yellow-500 bg-yellow-500/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-yellow-600">Standard</Badge>
                        <span className="font-semibold">Intermediate Cost Period</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Normal daytime operations. Higher than Off-Peak but lower than Peak rates.
                      </p>
                    </div>
                    
                    <div className="p-3 rounded-lg border-l-4 border-l-green-500 bg-green-500/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-green-600">Off-Peak</Badge>
                        <span className="font-semibold">Lowest Cost Period</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Designed to incentivize load shifting from high demand periods. Typically overnight (22:00-06:00).
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
                      In extreme cases, <strong>Critical Peak Pricing</strong> applies with very high prices when system reliability is threatened. Uses the <strong>cost of unserved energy</strong> as penalty signal during load shedding or grid emergencies.
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
                      For TOU customers, demand (kVA) is measured over <strong>half-hourly integrating periods</strong>. 
                      Monthly maximum demand charges (R/kVA/m) are based on the highest demand registered during <strong>Peak or Standard periods</strong>.
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-muted">
                    <h4 className="font-semibold mb-2">Metering Requirements</h4>
                    <p className="text-sm text-muted-foreground">
                      TOU tariffs require Time-of-Use capable metering. Options include:
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

            {/* Applicable Tariffs */}
            <AccordionItem value="tariffs">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  <span className="font-semibold">Applicable Tariffs</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground mb-3">
                    The TOU periods shown apply to the following Eskom tariffs:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["Megaflex", "Megaflex Gen", "Municflex", "Miniflex", "Homeflex", "Ruraflex", "Ruraflex Gen", "WEPS"].map((tariff) => (
                      <Badge key={tariff} variant="secondary">{tariff}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Note: Nightsave tariffs (Urban Large, Urban Small, Rural) have different TOU periods - Peak and Off-Peak only.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
