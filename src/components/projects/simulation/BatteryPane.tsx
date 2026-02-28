import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Battery } from "lucide-react";

interface BatteryPaneProps {
  batteryAcCapacity: number;
  onBatteryAcCapacityChange: (v: number) => void;
  batteryChargePower: number;
  batteryDischargePower: number;
  batteryCapacity: number;
  batteryCycles: number;
  annualBatteryDischarge: number;
}

export function BatteryPane({
  batteryAcCapacity, onBatteryAcCapacityChange,
  batteryChargePower, batteryDischargePower,
  batteryCapacity, batteryCycles, annualBatteryDischarge,
}: BatteryPaneProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Battery className="h-4 w-4" />
          Battery Storage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs">AC Capacity (kWh)</Label>
          <NumericInput
            integer
            value={batteryAcCapacity}
            onChange={(v) => onBatteryAcCapacityChange(v)}
            className="h-8"
            min={0}
            max={5000}
            step={10}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Charge Power (kW)</Label>
            <Input
              type="number"
              value={batteryChargePower.toFixed(1)}
              disabled
              className="h-8 bg-muted"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Discharge Power (kW)</Label>
            <Input
              type="number"
              value={batteryDischargePower.toFixed(1)}
              disabled
              className="h-8 bg-muted"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">DC Capacity (kWh)</Label>
            <Input
              type="number"
              value={batteryCapacity}
              disabled
              className="h-8 bg-muted"
            />
          </div>
        </div>
        <div className="pt-2 border-t space-y-1 text-[10px] text-muted-foreground">
          <div className="flex justify-between">
            <span>Usable capacity</span>
            <span className="text-foreground">{batteryAcCapacity} kWh</span>
          </div>
          <div className="flex justify-between">
            <span>Daily cycles</span>
            <span className="text-foreground">{batteryCycles.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Energy throughput</span>
            <span className="text-foreground">{(annualBatteryDischarge / 365).toFixed(0)} kWh</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
