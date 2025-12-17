import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Users, BarChart3, DollarSign, Zap, Sun, MapPin, Plug, 
  CheckCircle2, AlertCircle, ArrowRight, Building2
} from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  area_sqm: number;
  scada_import_id: string | null;
  shop_type_id: string | null;
}

interface ProjectOverviewProps {
  project: any;
  tenants: Tenant[];
  onNavigateTab: (tab: string) => void;
}

export function ProjectOverview({ project, tenants, onNavigateTab }: ProjectOverviewProps) {
  const totalArea = tenants.reduce((sum, t) => sum + Number(t.area_sqm || 0), 0);
  const assignedProfiles = tenants.filter(t => t.scada_import_id).length;
  const profileCompletion = tenants.length > 0 ? (assignedProfiles / tenants.length) * 100 : 0;
  
  const hasTariff = !!project.tariff_id;
  const hasConnectionSize = !!project.connection_size_kva;
  const maxSolarKva = hasConnectionSize ? project.connection_size_kva * 0.7 : null;

  // Calculate estimated monthly consumption (simplified)
  const estimatedMonthlyKwh = totalArea * 50; // Default 50 kWh/m²/month

  const setupSteps = [
    { label: "Add tenants", done: tenants.length > 0, tab: "tenants" },
    { label: "Assign load profiles", done: assignedProfiles > 0, tab: "tenants" },
    { label: "Set connection size", done: hasConnectionSize, tab: "tenants" },
    { label: "Select tariff", done: hasTariff, tab: "tariff" },
  ];
  
  const completedSteps = setupSteps.filter(s => s.done).length;
  const setupProgress = (completedSteps / setupSteps.length) * 100;

  return (
    <div className="space-y-6">
      {/* Setup Progress */}
      {setupProgress < 100 && (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Project Setup
            </CardTitle>
            <CardDescription>Complete these steps to enable full simulation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Progress value={setupProgress} className="flex-1" />
              <span className="text-sm font-medium">{completedSteps}/{setupSteps.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {setupSteps.map((step, i) => (
                <Badge
                  key={i}
                  variant={step.done ? "default" : "outline"}
                  className={`cursor-pointer ${step.done ? "bg-primary/20 text-primary hover:bg-primary/30" : "hover:bg-muted"}`}
                  onClick={() => onNavigateTab(step.tab)}
                >
                  {step.done ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                  {step.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onNavigateTab("tenants")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tenants</p>
                <p className="text-2xl font-bold">{tenants.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {assignedProfiles} with profiles
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
            {tenants.length > 0 && (
              <Progress value={profileCompletion} className="mt-3 h-1" />
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onNavigateTab("load-profile")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Area</p>
                <p className="text-2xl font-bold">{totalArea.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">m²</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onNavigateTab("tariff")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tariff</p>
                <p className="text-2xl font-bold">
                  {hasTariff ? (
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  ) : (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasTariff ? "Selected" : "Required for simulation"}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => onNavigateTab("simulation")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Max Solar</p>
                <p className="text-2xl font-bold">
                  {maxSolarKva ? `${maxSolarKva.toFixed(0)}` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasConnectionSize ? `kVA (70% of ${project.connection_size_kva} kVA)` : "Set connection size"}
                </p>
              </div>
              <Sun className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Load Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {tenants.length > 0 
                ? `View aggregated load profile for ${tenants.length} tenants`
                : "Add tenants to generate load profile"
              }
            </p>
            <Button variant="outline" size="sm" onClick={() => onNavigateTab("load-profile")} disabled={tenants.length === 0}>
              View Profile <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Simulation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {hasTariff && tenants.length > 0
                ? "Run energy and financial simulations"
                : "Complete setup to enable simulation"
              }
            </p>
            <Button variant="outline" size="sm" onClick={() => onNavigateTab("simulation")} disabled={!hasTariff || tenants.length === 0}>
              Run Simulation <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sun className="h-4 w-4" />
              PV Layout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Design PV array layout on floor plans
            </p>
            <Button variant="outline" size="sm" onClick={() => onNavigateTab("pv-layout")}>
              Open Designer <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Project Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Location</p>
                <p className="font-medium">{project.location || "Not set"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Plug className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Connection Size</p>
                <p className="font-medium">{project.connection_size_kva ? `${project.connection_size_kva} kVA` : "Not set"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Est. Monthly Consumption</p>
                <p className="font-medium">{estimatedMonthlyKwh.toLocaleString()} kWh</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{new Date(project.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
