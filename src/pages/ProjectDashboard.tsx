import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarIcon, Save, CheckCircle2, Circle, 
  Zap, TrendingUp, Leaf, Battery, Sun, DollarSign,
  Building2
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ProjectParams {
  name: string;
  location: string;
  totalArea: number;
  capacity: number;
  systemType: "Solar" | "Wind" | "Hybrid" | "";
  clientName: string;
  budget: number;
  targetDate: Date | undefined;
}

interface WorkflowStep {
  id: number;
  name: string;
  status: "complete" | "pending";
}

interface KPIData {
  annualYield: number;
  savings: number;
  roi: number;
  selfCoverage: number;
  co2Avoided: number;
  gridImpact: number;
}

const ProjectDashboard = () => {
  const { id } = useParams<{ id: string }>();

  const [params, setParams] = useState<ProjectParams>({
    name: "",
    location: "",
    totalArea: 0,
    capacity: 0,
    systemType: "",
    clientName: "",
    budget: 0,
    targetDate: undefined,
  });

  const [workflowSteps] = useState<WorkflowStep[]>([
    { id: 1, name: "Resource Analysis", status: "complete" },
    { id: 2, name: "System Design", status: "complete" },
    { id: 3, name: "Energy Configuration", status: "pending" },
    { id: 4, name: "Financial Analysis", status: "pending" },
    { id: 5, name: "Proposal Draft", status: "pending" },
    { id: 6, name: "Client Review", status: "pending" },
    { id: 7, name: "Approval Workflow", status: "pending" },
    { id: 8, name: "Contract Generation", status: "pending" },
    { id: 9, name: "Portal Setup", status: "pending" },
  ]);

  const [kpis] = useState<KPIData>({
    annualYield: 245.8,
    savings: 480000,
    roi: 18.5,
    selfCoverage: 78.5,
    co2Avoided: 198.4,
    gridImpact: -45,
  });

  const completedSteps = workflowSteps.filter(s => s.status === "complete").length;

  const handleParamChange = (key: keyof ProjectParams, value: string | number | Date | undefined) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    console.log("Saving parameters:", params);
    // TODO: Implement database save
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Panel - Sticky Parameters */}
      <div className="w-80 flex-shrink-0 sticky top-0 h-screen bg-card border-r border-border shadow-sm overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Project Parameters</h2>
          </div>

          <div className="space-y-4">
            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={params.name}
                onChange={(e) => handleParamChange("name", e.target.value)}
                placeholder="Enter project name"
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={params.location}
                onChange={(e) => handleParamChange("location", e.target.value)}
                placeholder="Enter location"
              />
            </div>

            {/* Total Area */}
            <div className="space-y-2">
              <Label htmlFor="totalArea">Total Area (m²)</Label>
              <Input
                id="totalArea"
                type="number"
                value={params.totalArea || ""}
                onChange={(e) => handleParamChange("totalArea", Number(e.target.value))}
                placeholder="0"
              />
            </div>

            {/* Capacity */}
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity (kVA)</Label>
              <Input
                id="capacity"
                type="number"
                value={params.capacity || ""}
                onChange={(e) => handleParamChange("capacity", Number(e.target.value))}
                placeholder="0"
              />
            </div>

            {/* System Type */}
            <div className="space-y-2">
              <Label>System Type</Label>
              <Select
                value={params.systemType}
                onValueChange={(value) => handleParamChange("systemType", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select system type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Solar">Solar</SelectItem>
                  <SelectItem value="Wind">Wind</SelectItem>
                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Client Name */}
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                value={params.clientName}
                onChange={(e) => handleParamChange("clientName", e.target.value)}
                placeholder="Enter client name"
              />
            </div>

            {/* Budget */}
            <div className="space-y-2">
              <Label htmlFor="budget">Budget (R)</Label>
              <Input
                id="budget"
                type="number"
                value={params.budget || ""}
                onChange={(e) => handleParamChange("budget", Number(e.target.value))}
                placeholder="0"
              />
            </div>

            {/* Target Date */}
            <div className="space-y-2">
              <Label>Target Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !params.targetDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {params.targetDate ? format(params.targetDate, "PPP") : <span>Select date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={params.targetDate}
                    onSelect={(date) => handleParamChange("targetDate", date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Save Button */}
            <Button onClick={handleSave} className="w-full mt-6">
              <Save className="mr-2 h-4 w-4" />
              Save Parameters
            </Button>
          </div>
        </div>
      </div>

      {/* Right Panel - Scrollable Content */}
      <div className="flex-1 overflow-y-auto bg-muted/30 p-6 space-y-6">
        {/* Progress Tracker */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <span>Workflow Progress</span>
              <Badge variant="secondary" className="text-sm">
                {completedSteps}/{workflowSteps.length} Steps
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {workflowSteps.map((step) => (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                    step.status === "complete"
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-card hover:bg-muted/50"
                  )}
                >
                  <div className="flex-shrink-0">
                    {step.status === "complete" ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-muted-foreground">Step {step.id}</span>
                    <p className="text-sm font-medium truncate">{step.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* KPI Grid */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Key Performance Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Annual Yield */}
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Sun className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">Annual Yield</span>
                </div>
                <p className="text-2xl font-bold">{kpis.annualYield}</p>
                <span className="text-sm text-muted-foreground">MWh</span>
              </div>

              {/* Savings */}
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm text-muted-foreground">Savings</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(kpis.savings)}</p>
                <span className="text-sm text-muted-foreground">/year</span>
              </div>

              {/* ROI */}
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">ROI</span>
                </div>
                <p className="text-2xl font-bold">{kpis.roi}%</p>
                <span className="text-sm text-muted-foreground">return</span>
              </div>

              {/* Self-Coverage */}
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Battery className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Self-Coverage</span>
                </div>
                <p className="text-2xl font-bold">{kpis.selfCoverage}%</p>
                <span className="text-sm text-muted-foreground">of load</span>
              </div>

              {/* CO2 Avoided */}
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Leaf className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">CO₂ Avoided</span>
                </div>
                <p className="text-2xl font-bold">{kpis.co2Avoided}</p>
                <span className="text-sm text-muted-foreground">tons/year</span>
              </div>

              {/* Grid Impact */}
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-muted-foreground">Grid Impact</span>
                </div>
                <p className="text-2xl font-bold">{kpis.gridImpact}%</p>
                <span className="text-sm text-muted-foreground">reduction</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProjectDashboard;
