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
            {/* Section 1: Universal Mandatory Components - 2025/2026 Unbundled Structure */}
            <AccordionItem value="mandatory-components">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Badge variant="default">1</Badge>
                  Unbundled Tariff Components (2025/2026)
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 mb-4">
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      2025-2026 Unbundled Structure
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Eskom has unbundled all tariffs (except Homelight) into separate components for cost transparency. 
                      The previously all-inclusive energy rate is now split into Legacy Energy + Generation Capacity Charge (GCC).
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <ChargeCard
                      title="Legacy Energy Charge"
                      unit="c/kWh"
                      description="Traditional volumetric energy consumption charge. Now separated from capacity costs for transparency."
                    />
                    <ChargeCard
                      title="Generation Capacity Charge (GCC)"
                      unit="R/kVA or R/POD/day"
                      description="NEW: Recovered separately from energy. Covers generation capacity costs. Applied to all tariffs except Homelight."
                    />
                    <ChargeCard
                      title="Transmission Network Charge"
                      unit="R/kVA/month"
                      description="For MV/HV customers. Covers transmission infrastructure costs with zone-based pricing (≤300km, 300-600km, 600-900km, >900km)."
                    />
                    <ChargeCard
                      title="Distribution Network Charge"
                      unit="R/kVA/month"
                      description="Covers local distribution infrastructure. Varies by voltage level (LV/MV/HV)."
                    />
                    <ChargeCard
                      title="Retail/Service Charge"
                      unit="R/day or R/month"
                      description="Administration and customer service costs. Fixed regardless of consumption."
                    />
                    <ChargeCard
                      title="Reactive Energy Charge"
                      unit="R/kVArh"
                      description="Power factor penalty during high-demand season. Applies to TOU tariffs for poor power factor compensation."
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

            {/* Section 3: Eskom 2025/2026 Tariff Categories */}
            <AccordionItem value="eskom-tariff-categories">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Badge variant="default">3</Badge>
                  Eskom Tariff Categories (2025/2026)
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-6 pt-2">
                  {/* Urban LPU */}
                  <div>
                    <h4 className="font-semibold mb-2">A. Urban Large Power Users (LPU) - NMD &gt; 1 MVA</h4>
                    <div className="grid gap-2 text-sm">
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Megaflex:</span>
                        <p className="text-muted-foreground">Urban TOU for large customers. Seasonally differentiated energy + GCC (R/kVA) + Transmission/Distribution network charges. Reactive energy charge for poor power factor.</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Miniflex:</span>
                        <p className="text-muted-foreground">High-load factor urban customers 25kVA-5MVA NMD. For customers without grid-tied generation (TOU mandatory for generators).</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Nightsave Urban:</span>
                        <p className="text-muted-foreground">Seasonally differentiated with energy demand charges based on peak period chargeable demand.</p>
                      </div>
                    </div>
                  </div>

                  {/* Urban SPU */}
                  <div>
                    <h4 className="font-semibold mb-2">B. Urban Small Power Users (SPU) & Commercial</h4>
                    <div className="grid gap-2 text-sm">
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Businessrate:</span>
                        <p className="text-muted-foreground">Urban commercial/non-commercial up to 100kVA NMD. Single c/kWh + daily fixed charges for network capacity and retail.</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Public Lighting:</span>
                        <p className="text-muted-foreground">Non-metered. Fixed charges based on light count and wattage (All Night = 333.3 hours/month).</p>
                      </div>
                    </div>
                  </div>

                  {/* Residential */}
                  <div>
                    <h4 className="font-semibold mb-2">C. Residential (No IBT for 2025/2026)</h4>
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-2">
                      <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                        Important: Eskom removed IBT structure for FY2026 - customers no longer pay higher rates for higher consumption.
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm">
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Homepower:</span>
                        <p className="text-muted-foreground">Standard urban residential up to 100kVA. Unbundled: energy + network + retail charges.</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Homeflex:</span>
                        <p className="text-muted-foreground">Residential TOU mandatory for grid-tied generation. Supports net-billing (Gen-offset) for export credits.</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Homelight:</span>
                        <p className="text-muted-foreground">Subsidized for low-usage. ONLY tariff with all-inclusive single c/kWh rate (no separate GCC).</p>
                      </div>
                    </div>
                  </div>

                  {/* Rural */}
                  <div>
                    <h4 className="font-semibold mb-2">D. Rural & Agricultural</h4>
                    <div className="grid gap-2 text-sm">
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Ruraflex:</span>
                        <p className="text-muted-foreground">Rural TOU from 16kVA NMD, supply voltage ≤22kV (or 33kV in specific areas).</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Landrate:</span>
                        <p className="text-muted-foreground">Conventional rural up to 100kVA at &lt;500V. Single energy + daily network/retail charges.</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Landlight:</span>
                        <p className="text-muted-foreground">Subsidized rural prepaid. No fixed charges - single c/kWh only.</p>
                      </div>
                    </div>
                  </div>

                  {/* Municipal */}
                  <div>
                    <h4 className="font-semibold mb-2">E. Municipal (Local Authority) - Consolidated</h4>
                    <div className="grid gap-2 text-sm">
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Municflex:</span>
                        <p className="text-muted-foreground">NEW bulk TOU for local authorities from 16kVA NMD. Replaces previous Megaflex/Miniflex for municipalities.</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Municrate:</span>
                        <p className="text-muted-foreground">NEW bulk tariff up to 100kVA. Consolidates previous commercial/residential bulk rates.</p>
                      </div>
                    </div>
                  </div>

                  {/* Generator */}
                  <div>
                    <h4 className="font-semibold mb-2">F. Generator & Wheeling</h4>
                    <div className="grid gap-2 text-sm">
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Gen-wheeling:</span>
                        <p className="text-muted-foreground">Use-of-System for third-party generator wheeling. Credit based on WEPS energy rate excluding losses.</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">Gen-offset:</span>
                        <p className="text-muted-foreground">Net-billing/offset reconciliation for customers consuming self-generated energy.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 4: TOU Structure */}
            <AccordionItem value="allocation-mechanisms">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Badge variant="default">4</Badge>
                  Time of Use (TOU) & Seasonality
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-6 pt-2">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4" />
                      TOU Periods (2025/2026 Updated)
                    </h4>
                    <div className="text-sm space-y-3">
                      <p className="text-muted-foreground">
                        Mandatory for customers above 100 kVA and those with grid-tied generation.
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
                          <div className="text-xs text-muted-foreground">07:00-09:00, 17:00-20:00</div>
                          <div className="text-xs">Weekdays only</div>
                        </div>
                        <div className="p-2 rounded bg-yellow-500/20 text-center">
                          <div className="font-medium">Standard</div>
                          <div className="text-xs text-muted-foreground">Daytime</div>
                          <div className="text-xs">+ Sunday 18:00-20:00</div>
                        </div>
                        <div className="p-2 rounded bg-green-500/20 text-center">
                          <div className="font-medium">Off-Peak</div>
                          <div className="text-xs text-muted-foreground">22:00-06:00</div>
                          <div className="text-xs">All nights + weekends</div>
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
