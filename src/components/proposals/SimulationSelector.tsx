import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BarChart3, FlaskConical, Sun, Battery, Calendar } from "lucide-react";

interface Simulation {
  id: string;
  name: string;
  solar_capacity_kwp: number | null;
  battery_capacity_kwh: number | null;
  created_at: string;
  type: 'profile' | 'sandbox';
}

interface SimulationSelectorProps {
  simulations: Simulation[];
  sandboxes: Simulation[];
  selectedId: string | null;
  selectedType: 'profile' | 'sandbox' | null;
  onSelect: (id: string, type: 'profile' | 'sandbox') => void;
  disabled?: boolean;
}

export function SimulationSelector({ 
  simulations, 
  sandboxes, 
  selectedId, 
  selectedType,
  onSelect, 
  disabled 
}: SimulationSelectorProps) {
  const allOptions = [
    ...simulations.map(s => ({ ...s, type: 'profile' as const })),
    ...sandboxes.map(s => ({ ...s, type: 'sandbox' as const })),
  ];

  if (allOptions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            No simulations available. Run a simulation from the Profile Builder or Sandbox first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Select Simulation</CardTitle>
        </div>
        <CardDescription>
          Choose a completed simulation to base this proposal on
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedId ? `${selectedType}-${selectedId}` : ""}
          onValueChange={(value) => {
            // Split only on the first dash to preserve UUID structure
            const dashIndex = value.indexOf("-");
            const type = value.substring(0, dashIndex);
            const id = value.substring(dashIndex + 1);
            onSelect(id, type as 'profile' | 'sandbox');
          }}
          disabled={disabled}
          className="space-y-2"
        >
          {simulations.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Profile Builder Simulations
              </Label>
              {simulations.map((sim) => (
                <div
                  key={sim.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                    selectedId === sim.id && selectedType === 'profile'
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value={`profile-${sim.id}`} id={`profile-${sim.id}`} />
                  <Label htmlFor={`profile-${sim.id}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{sim.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {sim.solar_capacity_kwp && (
                          <Badge variant="secondary" className="gap-1">
                            <Sun className="h-3 w-3" />
                            {sim.solar_capacity_kwp} kWp
                          </Badge>
                        )}
                        {sim.battery_capacity_kwh && sim.battery_capacity_kwh > 0 && (
                          <Badge variant="secondary" className="gap-1">
                            <Battery className="h-3 w-3" />
                            {sim.battery_capacity_kwh} kWh
                          </Badge>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(sim.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          )}

          {sandboxes.length > 0 && (
            <div className="space-y-2 mt-4">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Sandbox Simulations
              </Label>
              {sandboxes.map((sim) => (
                <div
                  key={sim.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border border-dashed transition-colors ${
                    selectedId === sim.id && selectedType === 'sandbox'
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <RadioGroupItem value={`sandbox-${sim.id}`} id={`sandbox-${sim.id}`} />
                  <Label htmlFor={`sandbox-${sim.id}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{sim.name}</span>
                        <Badge variant="outline" className="border-dashed bg-amber-500/10 text-amber-700 border-amber-500/30">
                          SANDBOX
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(sim.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          )}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
