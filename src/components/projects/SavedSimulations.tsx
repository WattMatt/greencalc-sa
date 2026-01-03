import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Trash2, Download, BarChart3, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useInfographicGeneration } from "@/hooks/useInfographicGeneration";

interface SimulationResult {
  totalDailyLoad: number;
  totalDailySolar: number;
  totalGridImport: number;
  totalSolarUsed: number;
  annualSavings: number;
  systemCost: number;
  paybackYears: number;
  roi: number;
  peakDemand: number;
  newPeakDemand: number;
}

interface SavedSimulationsProps {
  projectId: string;
  currentConfig: {
    solarCapacity: number;
    batteryCapacity: number;
    batteryPower: number;
    pvConfig: any;
    usingSolcast: boolean;
  };
  currentResults: SimulationResult;
  onLoadSimulation: (config: {
    solarCapacity: number;
    batteryCapacity: number;
    batteryPower: number;
    pvConfig: any;
  }) => void;
}

interface SavedSimulation {
  id: string;
  name: string;
  created_at: string;
  solar_capacity_kwp: number | null;
  battery_capacity_kwh: number | null;
  battery_power_kw: number | null;
  solar_orientation: string | null;
  solar_tilt_degrees: number | null;
  annual_solar_savings: number | null;
  annual_battery_savings: number | null;
  annual_grid_cost: number | null;
  payback_years: number | null;
  roi_percentage: number | null;
  simulation_type: string;
  results_json: any;
}

export function SavedSimulations({
  projectId,
  currentConfig,
  currentResults,
  onLoadSimulation,
}: SavedSimulationsProps) {
  const queryClient = useQueryClient();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [simulationName, setSimulationName] = useState("");
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  
  // Infographic generation hook
  const { generating: generatingInfographics, generateInfographics } = useInfographicGeneration();

  // Fetch saved simulations
  const { data: savedSimulations, isLoading } = useQuery({
    queryKey: ["project-simulations", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_simulations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SavedSimulation[];
    },
  });

  // Save simulation mutation
  const saveMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("project_simulations").insert({
        project_id: projectId,
        name,
        simulation_type: currentConfig.usingSolcast ? "solcast" : "generic",
        solar_capacity_kwp: currentConfig.solarCapacity,
        battery_capacity_kwh: currentConfig.batteryCapacity,
        battery_power_kw: currentConfig.batteryPower,
        solar_orientation: currentConfig.pvConfig.location,
        solar_tilt_degrees: currentConfig.pvConfig.tilt,
        annual_solar_savings: currentResults.annualSavings,
        annual_grid_cost: currentResults.totalGridImport * 2.5 * 365, // Rough estimate
        payback_years: currentResults.paybackYears,
        roi_percentage: currentResults.roi,
        results_json: {
          ...currentResults,
          pvConfig: currentConfig.pvConfig,
          usingSolcast: currentConfig.usingSolcast,
        },
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["project-simulations", projectId] });
      toast.success("Simulation saved successfully");
      setSaveDialogOpen(false);
      setSimulationName("");
      
      // Trigger background infographic generation
      toast.info("Generating report infographics in background...", { 
        icon: <Sparkles className="h-4 w-4" />,
        duration: 3000 
      });
      
      // Prepare infographic data from current simulation results
      const infographicData = {
        projectName: simulationName || "Solar Project",
        solarCapacityKwp: currentConfig.solarCapacity,
        batteryCapacityKwh: currentConfig.batteryCapacity,
        annualSavings: currentResults.annualSavings,
        paybackYears: currentResults.paybackYears,
        roiPercent: currentResults.roi,
        co2AvoidedTons: Math.round((currentResults.totalDailySolar * 365 * 0.9) / 1000), // Rough CO2 estimate
        selfConsumptionPercent: currentResults.totalDailySolar > 0 
          ? (currentResults.totalSolarUsed / currentResults.totalDailySolar) * 100 
          : 0,
        dcAcRatio: 1.3, // Default if not available
      };
      
      // Generate infographics in background (don't await)
      generateInfographics(infographicData, projectId).catch(err => {
        console.error("Background infographic generation failed:", err);
      });
    },
    onError: (error: any) => {
      toast.error("Failed to save simulation: " + error.message);
    },
  });

  // Delete simulation mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_simulations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-simulations", projectId] });
      toast.success("Simulation deleted");
    },
    onError: (error: any) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const handleSave = () => {
    if (!simulationName.trim()) {
      toast.error("Please enter a name for the simulation");
      return;
    }
    saveMutation.mutate(simulationName);
  };

  const handleLoad = (sim: SavedSimulation) => {
    const resultsJson = sim.results_json as any;
    onLoadSimulation({
      solarCapacity: sim.solar_capacity_kwp || 100,
      batteryCapacity: sim.battery_capacity_kwh || 50,
      batteryPower: sim.battery_power_kw || 25,
      pvConfig: resultsJson?.pvConfig || {},
    });
    toast.success(`Loaded configuration: ${sim.name}`);
  };

  const toggleCompare = (id: string) => {
    setSelectedForCompare((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  };

  const comparedSimulations = savedSimulations?.filter((s) =>
    selectedForCompare.includes(s.id)
  );

  return (
    <div className="space-y-4">
      {/* Save and Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Save className="h-4 w-4" />
                Save Current
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Simulation</DialogTitle>
                <DialogDescription>
                  Save the current configuration and results for future comparison.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Simulation Name</Label>
                  <Input
                    placeholder="e.g., 150kWp with 100kWh battery"
                    value={simulationName}
                    onChange={(e) => setSimulationName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Solar Capacity</p>
                    <p className="font-medium">{currentConfig.solarCapacity} kWp</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Battery</p>
                    <p className="font-medium">
                      {currentConfig.batteryCapacity} kWh / {currentConfig.batteryPower} kW
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Annual Savings</p>
                    <p className="font-medium text-green-600">
                      R{Math.round(currentResults.annualSavings).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payback</p>
                    <p className="font-medium">{currentResults.paybackYears.toFixed(1)} years</p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Simulation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {selectedForCompare.length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCompare(!showCompare)}
              className="gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Compare Selected ({selectedForCompare.length})
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {savedSimulations?.length || 0} saved simulations
        </p>
      </div>

      {/* Comparison View */}
      {showCompare && comparedSimulations && comparedSimulations.length >= 2 && (
        <Card className="border-primary/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Simulation Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Metric</TableHead>
                    {comparedSimulations.map((sim) => (
                      <TableHead key={sim.id} className="text-center">
                        {sim.name}
                        <Badge
                          variant="outline"
                          className="ml-2 text-[10px]"
                        >
                          {sim.simulation_type}
                        </Badge>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Solar Capacity</TableCell>
                    {comparedSimulations.map((sim) => (
                      <TableCell key={sim.id} className="text-center">
                        {sim.solar_capacity_kwp} kWp
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Battery</TableCell>
                    {comparedSimulations.map((sim) => (
                      <TableCell key={sim.id} className="text-center">
                        {sim.battery_capacity_kwh} kWh
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Annual Savings</TableCell>
                    {comparedSimulations.map((sim) => (
                      <TableCell key={sim.id} className="text-center text-green-600 font-medium">
                        R{Math.round(sim.annual_solar_savings || 0).toLocaleString()}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Payback Period</TableCell>
                    {comparedSimulations.map((sim) => (
                      <TableCell key={sim.id} className="text-center">
                        {sim.payback_years?.toFixed(1)} years
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">ROI</TableCell>
                    {comparedSimulations.map((sim) => (
                      <TableCell key={sim.id} className="text-center">
                        {sim.roi_percentage?.toFixed(1)}%
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Simulations List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : savedSimulations && savedSimulations.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Saved Configurations</CardTitle>
            <CardDescription className="text-xs">
              Select up to 3 simulations to compare, or load a configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {savedSimulations.map((sim) => (
                <div
                  key={sim.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedForCompare.includes(sim.id)}
                    onCheckedChange={() => toggleCompare(sim.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{sim.name}</p>
                      <Badge
                        variant={sim.simulation_type === "solcast" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {sim.simulation_type === "solcast" ? "Solcast" : "Generic"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {sim.solar_capacity_kwp} kWp • {sim.battery_capacity_kwh} kWh •{" "}
                      R{Math.round(sim.annual_solar_savings || 0).toLocaleString()}/yr •{" "}
                      {format(new Date(sim.created_at), "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLoad(sim)}
                      className="h-8 w-8 p-0"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(sim.id)}
                      disabled={deleteMutation.isPending}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Save className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground text-center">
              No saved simulations yet. Save your current configuration to compare later.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}