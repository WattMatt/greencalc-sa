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
  { stage: 0, name: "No Load Shedding", hoursPerDay: 0, description: "Normal grid operation", color: "bg-green-500" },
  { stage: 1, name: "Stage 1", hoursPerDay: 2.5, description: "2.5 hours per day (1000 MW shed)", color: "bg-yellow-400" },
  { stage: 2, name: "Stage 2", hoursPerDay: 4, description: "4 hours per day (2000 MW shed)", color: "bg-yellow-500" },
  { stage: 3, name: "Stage 3", hoursPerDay: 6, description: "6 hours per day (3000 MW shed)", color: "bg-orange-400" },
  { stage: 4, name: "Stage 4", hoursPerDay: 8, description: "8 hours per day (4000 MW shed)", color: "bg-orange-500" },
  { stage: 5, name: "Stage 5", hoursPerDay: 10, description: "10 hours per day (5000 MW shed)", color: "bg-red-400" },
  { stage: 6, name: "Stage 6", hoursPerDay: 12, description: "12 hours per day (6000 MW shed)", color: "bg-red-500" },
  { stage: 7, name: "Stage 7", hoursPerDay: 14, description: "14 hours per day (7000 MW shed)", color: "bg-red-600" },
  { stage: 8, name: "Stage 8", hoursPerDay: 16, description: "16 hours per day (8000 MW shed)", color: "bg-red-700" },
];

const TYPICAL_SCHEDULES: Record<number, string[]> = {
  1: ["06:00-08:30", "18:00-20:30"],
  2: ["06:00-08:30", "10:00-12:30", "18:00-20:30"],
  3: ["06:00-08:30", "10:00-12:30", "14:00-16:30", "18:00-20:30"],
  4: ["00:00-02:30", "06:00-08:30", "10:00-12:30", "14:00-16:30", "18:00-20:30", "22:00-00:30"],
  5: ["00:00-02:30", "04:00-06:30", "06:00-08:30", "10:00-12:30", "14:00-16:30", "18:00-20:30", "22:00-00:30"],
  6: ["00:00-02:30", "02:00-04:30", "06:00-08:30", "10:00-12:30", "14:00-16:30", "18:00-20:30", "20:00-22:30", "22:00-00:30"],
  7: ["Continuous rolling blackouts with 2-hour intervals"],
  8: ["Continuous rolling blackouts with minimal grid availability"],
};

export function LoadSheddingStages() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Eskom Load Shedding Stages Reference
          </CardTitle>
          <CardDescription>
            Standard load shedding stages used for energy simulation and backup power planning in South Africa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Stage</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Hours/Day</TableHead>
                <TableHead>Typical Schedule Windows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LOAD_SHEDDING_STAGES.map((stage) => (
                <TableRow key={stage.stage}>
                  <TableCell>
                    <Badge variant={stage.stage === 0 ? "default" : "secondary"} className="font-mono">
                      {stage.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{stage.description}</TableCell>
                  <TableCell className="text-center font-medium">{stage.hoursPerDay}h</TableCell>
                  <TableCell>
                    {stage.stage === 0 ? (
                      <span className="text-muted-foreground">N/A</span>
                    ) : TYPICAL_SCHEDULES[stage.stage] ? (
                      <div className="flex flex-wrap gap-1">
                        {TYPICAL_SCHEDULES[stage.stage].map((slot, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs font-mono">
                            <Clock className="h-3 w-3 mr-1" />
                            {slot}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Varies by area</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
          <p className="text-xs text-muted-foreground">
            Note: Actual schedules vary by municipality and area block. These are typical patterns used for simulation modeling.
          </p>
        </CardContent>
      </Card>

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
