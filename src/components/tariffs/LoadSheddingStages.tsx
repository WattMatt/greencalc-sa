import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Zap, Clock, AlertTriangle, ExternalLink, MapPin, 
  Sun, Battery, Fuel, Cable, TrendingUp, ShieldCheck, 
  Gauge, DollarSign, Leaf, Volume2, Droplets
} from "lucide-react";
import { EnergyFlowInfographic } from "./EnergyFlowInfographic";
import { BatteryStateInfographic } from "./BatteryStateInfographic";

const ESKOM_PROVINCIAL_SCHEDULES = [
  { province: "Eastern Cape", url: "https://www.eskom.co.za/distribution/customer-service/outages/municipal-loadshedding-schedules/eastern-cape/" },
  { province: "Free State", url: "https://www.eskom.co.za/distribution/customer-service/outages/municipal-loadshedding-schedules/free-state/" },
  { province: "Gauteng", url: "https://www.eskom.co.za/distribution/customer-service/outages/municipal-loadshedding-schedules/gauteng/" },
  { province: "KwaZulu-Natal", url: "https://www.eskom.co.za/distribution/customer-service/outages/municipal-loadshedding-schedules/kwazulu-natal/" },
  { province: "Limpopo", url: "https://www.eskom.co.za/distribution/customer-service/outages/municipal-loadshedding-schedules/limpopo/" },
  { province: "Mpumalanga", url: "https://www.eskom.co.za/distribution/customer-service/outages/municipal-loadshedding-schedules/mpumalanga/" },
  { province: "North West", url: "https://www.eskom.co.za/distribution/customer-service/outages/municipal-loadshedding-schedules/north-west/" },
  { province: "Northern Cape", url: "https://www.eskom.co.za/distribution/customer-service/outages/municipal-loadshedding-schedules/northern-cape/" },
  { province: "Western Cape", url: "https://www.eskom.co.za/distribution/customer-service/outages/municipal-loadshedding-schedules/western-cape/" },
];

const LOAD_SHEDDING_STAGES = [
  { stage: 0, name: "No Load Shedding", hoursPerDay: 0, description: "Normal grid operation", mwShed: 0, slots: 0 },
  { stage: 1, name: "Stage 1", hoursPerDay: 2, description: "Up to 2 hours per day", mwShed: 1000, slots: 1 },
  { stage: 2, name: "Stage 2", hoursPerDay: 4, description: "2-4 hours per day", mwShed: 2000, slots: 2 },
  { stage: 3, name: "Stage 3", hoursPerDay: 6, description: "4-6 hours per day", mwShed: 3000, slots: 3 },
  { stage: 4, name: "Stage 4", hoursPerDay: 6, description: "6+ hours per day", mwShed: 4000, slots: 3 },
  { stage: 5, name: "Stage 5", hoursPerDay: 8, description: "6-8 hours per day", mwShed: 5000, slots: 4 },
  { stage: 6, name: "Stage 6", hoursPerDay: 10, description: "8-10 hours per day", mwShed: 6000, slots: 5 },
  { stage: 7, name: "Stage 7", hoursPerDay: 12, description: "10-12 hours per day", mwShed: 7000, slots: 6 },
  { stage: 8, name: "Stage 8", hoursPerDay: 14, description: "12-14 hours per day", mwShed: 8000, slots: 7 },
];

// Typical outage blocks per stage (start hour, duration in hours)
// Based on standard 2-hour slots spread across the day
const STAGE_OUTAGE_BLOCKS: Record<number, [number, number][]> = {
  0: [],
  1: [[6, 2]], // 1 x 2hr slot
  2: [[6, 2], [18, 2]], // 2 x 2hr slots
  3: [[6, 2], [14, 2], [22, 2]], // 3 x 2hr slots
  4: [[6, 2], [14, 2], [22, 2]], // 3 x 2hr slots (same as stage 3)
  5: [[2, 2], [6, 2], [14, 2], [22, 2]], // 4 x 2hr slots
  6: [[2, 2], [6, 2], [10, 2], [18, 2], [22, 2]], // 5 x 2hr slots
  7: [[0, 2], [4, 2], [8, 2], [14, 2], [18, 2], [22, 2]], // 6 x 2hr slots
  8: [[0, 2], [4, 2], [8, 2], [12, 2], [16, 2], [20, 2], [22, 2]], // 7 x 2hr slots (14 hours)
};

// Get severity color classes based on stage
const getStageColors = (stage: number) => {
  if (stage === 0) return { bar: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" };
  if (stage <= 2) return { bar: "bg-yellow-500", bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400" };
  if (stage <= 4) return { bar: "bg-orange-500", bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400" };
  return { bar: "bg-red-500", bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400" };
};

// Check if an hour falls within any outage block
const isOutageHour = (hour: number, blocks: [number, number][]): boolean => {
  return blocks.some(([start, duration]) => {
    const end = start + duration;
    if (end > 24) {
      // Handle wraparound
      return hour >= start || hour < (end - 24);
    }
    return hour >= start && hour < end;
  });
};

// Timeline component showing 24-hour visual
function StageTimeline({ stage }: { stage: number }) {
  const blocks = STAGE_OUTAGE_BLOCKS[stage] || [];
  const colors = getStageColors(stage);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  return (
    <div className="flex items-center gap-3">
      <div className={`w-20 text-right font-semibold text-sm ${colors.text}`}>
        Stage {stage}
      </div>
      <div className="flex-1 flex h-8 rounded-md overflow-hidden border border-border/50 bg-muted/20">
        {hours.map((hour) => {
          const isOutage = isOutageHour(hour, blocks);
          return (
            <div
              key={hour}
              className={`flex-1 transition-all relative group ${
                isOutage ? colors.bar : "bg-transparent"
              } ${hour > 0 ? "border-l border-border/10" : ""}`}
              title={`${String(hour).padStart(2, '0')}:00 - ${String(hour + 1).padStart(2, '0')}:00`}
            >
              {/* Hover indicator */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-foreground/10 transition-opacity" />
            </div>
          );
        })}
      </div>
      <div className="w-16 text-left">
        <span className={`text-sm font-medium ${colors.text}`}>
          {LOAD_SHEDDING_STAGES[stage].hoursPerDay}h
        </span>
        <span className="text-xs text-muted-foreground ml-1">off</span>
      </div>
    </div>
  );
}

// Hour labels component
function HourLabels() {
  const labelHours = [0, 6, 12, 18, 24];
  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="w-20" />
      <div className="flex-1 flex justify-between text-xs text-muted-foreground px-0.5">
        {labelHours.map((hour) => (
          <span key={hour}>{String(hour).padStart(2, '0')}:00</span>
        ))}
      </div>
      <div className="w-16" />
    </div>
  );
}

export function LoadSheddingStages() {
  return (
    <div className="space-y-6">
      {/* Visual Timeline Infographic */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            24-Hour Load Shedding Timeline
          </CardTitle>
          <CardDescription>
            Visual representation of typical outage patterns per stage over a 24-hour period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <HourLabels />
          {LOAD_SHEDDING_STAGES.map((stageData) => (
            <StageTimeline key={stageData.stage} stage={stageData.stage} />
          ))}
          
          {/* Legend */}
          <div className="flex items-center gap-6 mt-6 pt-4 border-t">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted/30 border border-border/50" />
              <span className="text-sm text-muted-foreground">Power Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500" />
              <span className="text-sm text-muted-foreground">Outage Period</span>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-4">
            Note: Actual schedules vary by municipality and area block. Colors indicate severity: 
            <span className="text-yellow-600 dark:text-yellow-400 font-medium"> Yellow</span> (Stage 1-2),
            <span className="text-orange-600 dark:text-orange-400 font-medium"> Orange</span> (Stage 3-4),
            <span className="text-red-600 dark:text-red-400 font-medium"> Red</span> (Stage 5+).
          </p>
        </CardContent>
      </Card>

      {/* Stage Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Stage Reference Table
          </CardTitle>
          <CardDescription>
            Each stage sheds 1000 MW. Power goes off in 2-hour slots; at higher stages some slots occur back-to-back.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Stage</TableHead>
                <TableHead>Outage Range</TableHead>
                <TableHead className="text-center">2hr Slots</TableHead>
                <TableHead className="text-center">MW Shed</TableHead>
                <TableHead className="text-right">Grid Availability</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LOAD_SHEDDING_STAGES.map((stage) => {
                const colors = getStageColors(stage.stage);
                const availability = ((24 - stage.hoursPerDay) / 24 * 100).toFixed(0);
                return (
                  <TableRow key={stage.stage}>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={`font-mono ${colors.bg} ${colors.text} border-0`}
                      >
                        {stage.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{stage.description}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-sm font-medium">
                        {stage.slots > 0 ? `${stage.slots}×` : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-sm">
                        {stage.mwShed > 0 ? `${stage.mwShed.toLocaleString()} MW` : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className={`w-12 h-2 rounded-full bg-muted overflow-hidden`}>
                          <div 
                            className={`h-full ${stage.stage === 0 ? "bg-emerald-500" : colors.bar}`} 
                            style={{ width: `${100 - (stage.hoursPerDay / 24) * 100}%` }}
                          />
                        </div>
                        <span className={`font-medium text-sm ${stage.stage === 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                          {availability}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Impact on Solar PV & Backup Systems */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Impact on Solar PV Systems & Backup Solutions
          </CardTitle>
          <CardDescription>
            Compare different backup power solutions for load shedding resilience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
              <TabsTrigger value="solar" className="text-xs sm:text-sm">Solar PV</TabsTrigger>
              <TabsTrigger value="battery" className="text-xs sm:text-sm">Battery</TabsTrigger>
              <TabsTrigger value="generator" className="text-xs sm:text-sm">Generator</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* Grid-Tied Solar */}
                <div className="p-4 rounded-xl border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-transparent relative overflow-hidden group hover:border-yellow-500/50 transition-all">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <Sun className="h-8 w-8 text-yellow-500 mb-3" />
                  <h4 className="font-semibold mb-2">Grid-Tied Solar</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Lowest cost entry point but no backup during outages
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-yellow-500/10 border-yellow-500/30">No Backup</Badge>
                  </div>
                </div>

                {/* Hybrid Solar + Battery */}
                <div className="p-4 rounded-xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <Battery className="h-8 w-8 text-emerald-500 mb-3" />
                  <h4 className="font-semibold mb-2">Hybrid System</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Solar + Battery for seamless backup power
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-emerald-500/10 border-emerald-500/30">Recommended</Badge>
                  </div>
                </div>

                {/* Generator */}
                <div className="p-4 rounded-xl border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent relative overflow-hidden group hover:border-orange-500/50 transition-all">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <Fuel className="h-8 w-8 text-orange-500 mb-3" />
                  <h4 className="font-semibold mb-2">Generator</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Reliable backup but ongoing fuel costs
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-orange-500/10 border-orange-500/30">Traditional</Badge>
                  </div>
                </div>

                {/* Solar + Generator Hybrid */}
                <div className="p-4 rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent relative overflow-hidden group hover:border-primary/50 transition-all">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="flex items-center gap-1 mb-3">
                    <Sun className="h-6 w-6 text-yellow-500" />
                    <span className="text-muted-foreground">+</span>
                    <Fuel className="h-6 w-6 text-orange-500" />
                  </div>
                  <h4 className="font-semibold mb-2">Solar + Generator</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Maximum resilience with fuel savings
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30">Best Value</Badge>
                  </div>
                </div>
              </div>

              {/* Animated Infographics Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Sun className="h-4 w-4 text-yellow-500" />
                    Grid-Tied Solar
                  </h4>
                  <EnergyFlowInfographic systemType="grid-tied" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Battery className="h-4 w-4 text-emerald-500" />
                    Hybrid Solar + Battery
                  </h4>
                  <EnergyFlowInfographic systemType="hybrid" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-orange-500" />
                    Generator Only
                  </h4>
                  <EnergyFlowInfographic systemType="generator" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Sun className="h-4 w-4 text-yellow-500" />
                    <span className="text-muted-foreground">+</span>
                    <Fuel className="h-4 w-4 text-orange-500" />
                    Solar + Generator Hybrid
                  </h4>
                  <EnergyFlowInfographic systemType="solar-generator" />
                </div>
              </div>
              
              {/* Battery State of Charge Timeline */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Battery className="h-4 w-4 text-emerald-500" />
                  Battery Daily Cycle Analysis
                </h4>
                <BatteryStateInfographic />
              </div>
            </TabsContent>

            <TabsContent value="solar" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Grid-Tied Infographic */}
                <div className="p-5 rounded-xl border bg-gradient-to-br from-yellow-500/5 to-transparent">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-yellow-500/10">
                      <Sun className="h-6 w-6 text-yellow-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Grid-Tied Systems</h4>
                      <p className="text-xs text-muted-foreground">Without battery storage</p>
                    </div>
                  </div>
                  
                  {/* Animated Flow Diagram */}
                  <EnergyFlowInfographic systemType="grid-tied" className="mb-4" />
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <Cable className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Grid Dependency</p>
                        <p className="text-xs text-muted-foreground">System shuts down during load shedding due to anti-islanding protection</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <TrendingUp className="h-5 w-5 text-red-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Lost Generation</p>
                        <p className="text-xs text-muted-foreground">At Stage 4+, lose 25-40% of potential daytime solar production</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <DollarSign className="h-5 w-5 text-emerald-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Lowest Capital Cost</p>
                        <p className="text-xs text-muted-foreground">No battery = 40-60% lower initial investment</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hybrid System Infographic */}
                <div className="p-5 rounded-xl border bg-gradient-to-br from-emerald-500/5 to-transparent">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <Battery className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Hybrid Systems</h4>
                      <p className="text-xs text-muted-foreground">Solar + Battery storage</p>
                    </div>
                  </div>
                  
                  {/* Animated Flow Diagram */}
                  <EnergyFlowInfographic systemType="hybrid" className="mb-4" />
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <ShieldCheck className="h-5 w-5 text-emerald-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Seamless Backup</p>
                        <p className="text-xs text-muted-foreground">Automatic switchover in &lt;20ms, no interruption to critical loads</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <Sun className="h-5 w-5 text-yellow-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Continued Generation</p>
                        <p className="text-xs text-muted-foreground">Solar keeps charging battery and powering loads during outages</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <Gauge className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Improved ROI at Higher Stages</p>
                        <p className="text-xs text-muted-foreground">Stage 4+ increases battery value by 30-50% due to backup utility</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="battery" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-5 rounded-xl border bg-gradient-to-br from-emerald-500/5 to-transparent">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <Battery className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Battery Energy Storage Systems (BESS)</h4>
                      <p className="text-xs text-muted-foreground">Sizing guidelines for load shedding resilience</p>
                    </div>
                  </div>
                  
                  <div className="grid gap-3 grid-cols-3 mb-4">
                    <div className="p-3 rounded-lg bg-muted/30 text-center">
                      <p className="text-xl font-bold text-emerald-500">2-4h</p>
                      <p className="text-[10px] text-muted-foreground">Stage 1-2</p>
                      <p className="text-[10px] font-medium">5-10 kWh</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 text-center">
                      <p className="text-xl font-bold text-orange-500">4-8h</p>
                      <p className="text-[10px] text-muted-foreground">Stage 3-4</p>
                      <p className="text-[10px] font-medium">10-20 kWh</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 text-center">
                      <p className="text-xl font-bold text-red-500">8-14h</p>
                      <p className="text-[10px] text-muted-foreground">Stage 5+</p>
                      <p className="text-[10px] font-medium">20-40 kWh</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Battery sizing depends on essential load requirements. A typical home needs 5-10 kWh for essential backup; 
                    commercial sites may require 50-200+ kWh depending on critical load profile.
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Battery className="h-4 w-4 text-emerald-500" />
                    Hybrid System Energy Flow
                  </h4>
                  <EnergyFlowInfographic systemType="hybrid" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="generator" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Generator Only */}
                <div className="p-5 rounded-xl border bg-gradient-to-br from-orange-500/5 to-transparent">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-orange-500/10">
                      <Fuel className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Diesel/Petrol Generator</h4>
                      <p className="text-xs text-muted-foreground">Standalone backup power</p>
                    </div>
                  </div>
                  
                  {/* Animated Flow Diagram */}
                  <EnergyFlowInfographic systemType="generator" className="mb-4" />
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <ShieldCheck className="h-5 w-5 text-emerald-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Unlimited Runtime</p>
                        <p className="text-xs text-muted-foreground">As long as fuel is available, provides continuous power</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <DollarSign className="h-5 w-5 text-red-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">High Running Costs</p>
                        <p className="text-xs text-muted-foreground">R8-15/kWh fuel cost vs R2-3/kWh grid. Stage 6 = R15,000+/month fuel</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <Volume2 className="h-5 w-5 text-orange-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Noise & Emissions</p>
                        <p className="text-xs text-muted-foreground">65-80 dB noise, CO2 emissions, requires ventilation</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <Droplets className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Maintenance Required</p>
                        <p className="text-xs text-muted-foreground">Oil changes, filter replacements, servicing every 100-250 hours</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Solar + Generator Hybrid */}
                <div className="p-5 rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/10 flex items-center gap-1">
                      <Sun className="h-5 w-5 text-yellow-500" />
                      <Fuel className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Solar + Generator Integration</h4>
                      <p className="text-xs text-muted-foreground">Best of both worlds</p>
                    </div>
                    <Badge className="ml-auto bg-primary text-primary-foreground">Recommended</Badge>
                  </div>
                  
                  {/* Animated Flow Diagram */}
                  <EnergyFlowInfographic systemType="solar-generator" className="mb-4" />
                  
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5">
                      <Leaf className="h-5 w-5 text-emerald-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">60-80% Fuel Savings</p>
                        <p className="text-xs text-muted-foreground">Solar handles daytime load, generator only runs when needed</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5">
                      <Battery className="h-5 w-5 text-emerald-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Extended Autonomy</p>
                        <p className="text-xs text-muted-foreground">Battery provides instant backup, generator charges when depleted</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5">
                      <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Maximum Resilience</p>
                        <p className="text-xs text-muted-foreground">No single point of failure - solar, battery, and generator backup</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5">
                      <TrendingUp className="h-5 w-5 text-emerald-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Best ROI at Stage 4+</p>
                        <p className="text-xs text-muted-foreground">Fuel savings offset higher capital cost within 2-3 years</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="p-4 rounded-lg border bg-muted/20">
                <h4 className="font-semibold mb-3 text-sm">Monthly Cost Comparison at Stage 4 (6h/day outages)</h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Generator Only</p>
                    <p className="text-lg font-bold text-red-500">R8,000-12,000</p>
                    <p className="text-xs text-muted-foreground">Fuel + maintenance</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Solar + Battery</p>
                    <p className="text-lg font-bold text-emerald-500">R0-500</p>
                    <p className="text-xs text-muted-foreground">Minimal running cost</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Solar + Gen Hybrid</p>
                    <p className="text-lg font-bold text-primary">R1,500-3,000</p>
                    <p className="text-xs text-muted-foreground">Reduced fuel usage</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Provincial Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Official Eskom Provincial Schedules
          </CardTitle>
          <CardDescription>
            View detailed municipal load shedding schedules by province on the official Eskom website
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {ESKOM_PROVINCIAL_SCHEDULES.map((item) => (
              <Button
                key={item.province}
                variant="outline"
                className="justify-between h-auto py-3"
                asChild
              >
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  <span>{item.province}</span>
                  <ExternalLink className="h-4 w-4 ml-2 opacity-50" />
                </a>
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            These links open the official Eskom website where you can find detailed area-specific schedules.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
