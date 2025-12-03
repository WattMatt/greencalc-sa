import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Zap, Building2, Factory, Gauge, Clock } from "lucide-react";

export function NERSAGuidelines() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            NERSA Tariff Structure Guidelines
          </CardTitle>
          <CardDescription>
            National Energy Regulator of South Africa - Mandatory structural dimensions and core components for transparent, cost-reflective pricing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {/* Section 1: Universal Mandatory Components */}
            <AccordionItem value="mandatory-components">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Badge variant="default">1</Badge>
                  Universal Mandatory Components (Charges)
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    All compliant tariffs must recover the following costs through specific charge components:
                  </p>
                  <div className="grid gap-3">
                    <ChargeCard
                      title="Energy Charge"
                      unit="c/kWh or R/kWh"
                      description="Charged based on volumetric consumption. Found across all tariff scales."
                    />
                    <ChargeCard
                      title="Fixed/Basic Charges"
                      unit="R/month or R/day"
                      description="Recovers customer service charges and point of supply costs, levied irrespective of consumption."
                    />
                    <ChargeCard
                      title="Demand Charges"
                      unit="R/kVA or R/Amp"
                      description="Levied on capacity utilized/reserved (Network Demand and Capacity Charges). Applied primarily to Commercial, Industrial, and Bulk users."
                    />
                    <ChargeCard
                      title="Reactive Energy Charges"
                      unit="R/kVArh"
                      description="Charged to compensate for poor power factor. Included in specialized bulk and TOU tariffs."
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 2: Structural Differentiation */}
            <AccordionItem value="structural-differentiation">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Badge variant="default">2</Badge>
                  Structural Differentiation (Capacity, Phase, Voltage)
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-6 pt-2">
                  {/* Capacity */}
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <Gauge className="h-4 w-4" />
                      A. Capacity/Connection Size
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Low/Life-Line Users (Amps):</span>
                        <p className="text-muted-foreground">Domestic tariffs cap at 20A (life-line), 40A, 60A. Prepaid often set at 60 Amps.</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Small Commercial/Industrial (kVA):</span>
                        <p className="text-muted-foreground">SPU generally below 50kVA, LPU starting at 80kVA or 100kVA.</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Bulk Users (MVA):</span>
                        <p className="text-muted-foreground">Above 1 MVA or greater than 10 MVA supply.</p>
                      </div>
                    </div>
                  </div>

                  {/* Phase */}
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4" />
                      B. Phase and Supply Type
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Single Phase vs Three Phase:</span>
                        <p className="text-muted-foreground">Three-phase has significantly higher basic charge.</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Metering Type:</span>
                        <p className="text-muted-foreground">Conventional (Credit Metered) vs Prepaid. Prepaid often relies solely on energy charge.</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Customer Categories:</span>
                        <p className="text-muted-foreground">Domestic, Commercial/Business, Industrial/LPU, Agriculture, Street Lighting.</p>
                      </div>
                    </div>
                  </div>

                  {/* Voltage */}
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <Factory className="h-4 w-4" />
                      C. Voltage and Supply Point
                    </h4>
                    <div className="grid gap-2 text-sm">
                      <div className="p-3 rounded-lg border-l-4 border-l-green-500 bg-muted">
                        <span className="font-medium">Low Voltage (LV):</span>
                        <p className="text-muted-foreground">≤400V - Small users and some industrial.</p>
                      </div>
                      <div className="p-3 rounded-lg border-l-4 border-l-yellow-500 bg-muted">
                        <span className="font-medium">Medium Voltage (MV):</span>
                        <p className="text-muted-foreground">11kV or 22kV - TOU energy rates required.</p>
                      </div>
                      <div className="p-3 rounded-lg border-l-4 border-l-red-500 bg-muted">
                        <span className="font-medium">High Voltage (HV):</span>
                        <p className="text-muted-foreground">44kV to 132kV - Tariffs for 66kV and 132kV supply.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 3: Allocation Mechanisms */}
            <AccordionItem value="allocation-mechanisms">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Badge variant="default">3</Badge>
                  Allocation Mechanisms (IBT & TOU Structures)
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-6 pt-2">
                  {/* IBT */}
                  <div>
                    <h4 className="font-semibold mb-2">A. Inclining Block Tariffs (IBT) for Residential</h4>
                    <div className="text-sm space-y-2">
                      <p className="text-muted-foreground">Energy recovery segmented by fixed, consecutive volume blocks:</p>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="p-2 rounded bg-green-500/20 text-center">
                          <div className="font-medium">Block 1</div>
                          <div className="text-xs text-muted-foreground">0-50 kWh</div>
                          <div className="text-xs">Life-line/Subsidized</div>
                        </div>
                        <div className="p-2 rounded bg-yellow-500/20 text-center">
                          <div className="font-medium">Block 2</div>
                          <div className="text-xs text-muted-foreground">51-350 kWh</div>
                          <div className="text-xs">Standard</div>
                        </div>
                        <div className="p-2 rounded bg-orange-500/20 text-center">
                          <div className="font-medium">Block 3</div>
                          <div className="text-xs text-muted-foreground">351-600 kWh</div>
                          <div className="text-xs">Higher</div>
                        </div>
                        <div className="p-2 rounded bg-red-500/20 text-center">
                          <div className="font-medium">Block 4</div>
                          <div className="text-xs text-muted-foreground">&gt;600 kWh</div>
                          <div className="text-xs">Highest</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* TOU */}
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4" />
                      B. Time of Use (TOU) and Seasonality
                    </h4>
                    <div className="text-sm space-y-3">
                      <p className="text-muted-foreground">
                        Mandatory for customers above 100 kVA. Multi-part, seasonally differentiated scales.
                      </p>
                      
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
                          <div className="font-medium text-blue-600 dark:text-blue-400">High Demand Season (Winter)</div>
                          <div className="text-muted-foreground">June - August</div>
                          <div className="text-xs mt-1">Significantly higher Peak and Standard rates</div>
                        </div>
                        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                          <div className="font-medium text-amber-600 dark:text-amber-400">Low Demand Season (Summer)</div>
                          <div className="text-muted-foreground">September - May</div>
                          <div className="text-xs mt-1">Lower rates across all time periods</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="p-2 rounded bg-red-500/20 text-center">
                          <div className="font-medium">Peak</div>
                          <div className="text-xs text-muted-foreground">Highest cost</div>
                          <div className="text-xs">Maximum system stress</div>
                        </div>
                        <div className="p-2 rounded bg-yellow-500/20 text-center">
                          <div className="font-medium">Standard</div>
                          <div className="text-xs text-muted-foreground">Intermediate</div>
                          <div className="text-xs">Normal operations</div>
                        </div>
                        <div className="p-2 rounded bg-green-500/20 text-center">
                          <div className="font-medium">Off-Peak</div>
                          <div className="text-xs text-muted-foreground">Lowest cost</div>
                          <div className="text-xs">Load shifting incentive</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Analogy */}
            <AccordionItem value="analogy">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Summary</Badge>
                  The Tariff Matrix Analogy
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="p-4 rounded-lg bg-muted text-sm">
                  <p className="italic">
                    "The diverse municipal tariff framework operates like a massive, universal pricing matrix, 
                    where every customer must choose a combination of three defining coordinates:"
                  </p>
                  <ol className="list-decimal list-inside mt-3 space-y-1">
                    <li><span className="font-medium">The Container Size</span> - Capacity/Amps</li>
                    <li><span className="font-medium">The Shipping Route</span> - Voltage/Phase</li>
                    <li><span className="font-medium">The Time of Delivery</span> - TOU/Seasonality</li>
                  </ol>
                  <p className="mt-3 text-muted-foreground">
                    The base cost recovery components (Energy, Fixed Fee, Demand Fee) are the building blocks 
                    used everywhere, but the customer's location within those three coordinates dictates the 
                    exact combination and magnitude of those charges.
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

function ChargeCard({ title, unit, description }: { title: string; unit: string; description: string }) {
  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">{title}</span>
        <Badge variant="secondary" className="text-xs">{unit}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
