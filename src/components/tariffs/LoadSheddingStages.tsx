import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Clock, AlertTriangle, ExternalLink, MapPin } from "lucide-react";

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
  { stage: 8, name: "Stage 8", hoursPerDay: 12, description: "12+ hours per day", mwShed: 8000, slots: 6 },
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
  8: [[0, 2], [4, 2], [8, 2], [12, 2], [16, 2], [20, 2]], // 6 x 2hr slots (evenly spread)
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

      {/* Impact Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Impact on Solar PV Systems
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">Grid-Tied Systems</h4>
              <p className="text-sm text-muted-foreground">
                Without battery storage, grid-tied systems shut down during load shedding, 
                losing potential solar generation during outage hours.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">Hybrid Systems</h4>
              <p className="text-sm text-muted-foreground">
                Battery storage enables continued operation during outages. Solar charges 
                batteries and powers loads, reducing grid dependency.
              </p>
            </div>
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-2">Backup Value</h4>
              <p className="text-sm text-muted-foreground">
                Higher stages increase the financial value of backup power systems, 
                improving ROI for battery storage investments.
              </p>
            </div>
          </div>
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
