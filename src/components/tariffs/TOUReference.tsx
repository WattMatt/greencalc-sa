import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TOUClockDiagram, 
  TOUClockLegend, 
  ESKOM_HIGH_DEMAND_PERIODS, 
  ESKOM_LOW_DEMAND_PERIODS 
} from "./TOUClockDiagram";
import { Info } from "lucide-react";

export function TOUReference() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-card-foreground flex items-center gap-2">
          <Info className="h-5 w-5" />
          Time of Use (TOU) Reference
        </CardTitle>
        <CardDescription>
          Eskom's standard TOU periods for High-Demand (Winter: June-August) and Low-Demand (Summer: September-May) seasons
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-8 md:grid-cols-2">
          <TOUClockDiagram 
            title="High-Demand Season" 
            periods={ESKOM_HIGH_DEMAND_PERIODS} 
            size={280}
          />
          <TOUClockDiagram 
            title="Low-Demand Season" 
            periods={ESKOM_LOW_DEMAND_PERIODS} 
            size={280}
          />
        </div>
        
        <TOUClockLegend />

        <div className="mt-6 space-y-4 text-sm text-muted-foreground">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg bg-accent/50">
              <h4 className="font-semibold text-foreground mb-2">High-Demand Season (Jun-Aug)</h4>
              <div className="space-y-1">
                <p><strong className="text-red-600">Peak:</strong> Weekdays 06:00-09:00 & 17:00-20:00</p>
                <p><strong className="text-yellow-600">Standard:</strong> Weekdays 09:00-17:00 & 20:00-22:00</p>
                <p><strong className="text-yellow-600">Standard:</strong> Sat/Sun 07:00-12:00 & 18:00-20:00</p>
                <p><strong className="text-green-600">Off-Peak:</strong> All other times</p>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-accent/50">
              <h4 className="font-semibold text-foreground mb-2">Low-Demand Season (Sep-May)</h4>
              <div className="space-y-1">
                <p><strong className="text-red-600">Peak:</strong> Weekdays 07:00-10:00 & 18:00-20:00</p>
                <p><strong className="text-yellow-600">Standard:</strong> Weekdays 06:00-07:00, 10:00-18:00 & 20:00-22:00</p>
                <p><strong className="text-yellow-600">Standard:</strong> Sat 07:00-12:00 & 18:00-20:00</p>
                <p><strong className="text-yellow-600">Standard:</strong> Sun 07:00-12:00</p>
                <p><strong className="text-green-600">Off-Peak:</strong> All other times</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
