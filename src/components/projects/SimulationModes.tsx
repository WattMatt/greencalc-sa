import { useState, forwardRef, useImperativeHandle, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Zap, FlaskConical, FileCheck, Plus, ArrowRight } from "lucide-react";
import { SimulationPanel, SimulationPanelRef } from "./SimulationPanel";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SystemCostsData } from "./SystemCostsManager";

interface Tenant {
  id: string;
  name: string;
  area_sqm: number;
  shop_type_id: string | null;
  monthly_kwh_override: number | null;
  shop_types?: {
    name: string;
    kwh_per_sqm_month: number;
    load_profile_weekday: number[];
  } | null;
}

interface ShopType {
  id: string;
  name: string;
  kwh_per_sqm_month: number;
  load_profile_weekday: number[];
}

import { type BlendedRateType } from "./TariffSelector";

interface SimulationModesProps {
  projectId: string;
  project: any;
  tenants: Tenant[];
  shopTypes: ShopType[];
  systemCosts: SystemCostsData;
  onSystemCostsChange: (costs: SystemCostsData) => void;
  includesBattery?: boolean;
  blendedRateType?: BlendedRateType;
  onBlendedRateTypeChange?: (type: BlendedRateType) => void;
}

export interface SimulationModesRef {
  saveIfNeeded: () => Promise<void>;
}

export const SimulationModes = forwardRef<SimulationModesRef, SimulationModesProps>(({ projectId, project, tenants, shopTypes, systemCosts, onSystemCostsChange, includesBattery = false, blendedRateType, onBlendedRateTypeChange }, ref) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeMode, setActiveMode] = useState("profile-builder");
  const simulationPanelRef = useRef<SimulationPanelRef>(null);

  // Expose saveIfNeeded to parent
  useImperativeHandle(ref, () => ({
    saveIfNeeded: async () => {
      if (simulationPanelRef.current) {
        await simulationPanelRef.current.autoSave();
      }
    }
  }), []);

  // Fetch sandboxes for this project
  const { data: projectSandboxes } = useQuery({
    queryKey: ["project-sandboxes", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sandbox_simulations")
        .select("*")
        .eq("cloned_from_project_id", projectId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create sandbox from this project
  const createSandbox = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("sandbox_simulations")
        .insert({
          name: `${project.name} - Sandbox`,
          cloned_from_project_id: projectId,
          project_snapshot: JSON.parse(JSON.stringify(project)),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Sandbox created");
      queryClient.invalidateQueries({ queryKey: ["project-sandboxes", projectId] });
      navigate(`/projects/${projectId}/sandbox/${data.id}`);
    },
    onError: () => toast.error("Failed to create sandbox"),
  });

  return (
    <Tabs value={activeMode} onValueChange={setActiveMode} className="space-y-6">
      <TabsList className="grid grid-cols-4 w-full max-w-2xl">
        <TabsTrigger value="profile-builder" className="gap-2">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Profile Builder</span>
        </TabsTrigger>
        <TabsTrigger value="quick-estimate" className="gap-2">
          <Zap className="h-4 w-4" />
          <span className="hidden sm:inline">Quick Estimate</span>
        </TabsTrigger>
        <TabsTrigger value="sandbox" className="gap-2">
          <FlaskConical className="h-4 w-4" />
          <span className="hidden sm:inline">Sandbox</span>
        </TabsTrigger>
        <TabsTrigger value="proposal" className="gap-2">
          <FileCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Proposal</span>
        </TabsTrigger>
      </TabsList>

      {/* Profile Builder - Main simulation */}
      <TabsContent value="profile-builder">
        <SimulationPanel
          ref={simulationPanelRef}
          projectId={projectId}
          project={project}
          tenants={tenants}
          shopTypes={shopTypes}
          systemCosts={systemCosts}
          onSystemCostsChange={onSystemCostsChange}
          includesBattery={includesBattery}
          blendedRateType={blendedRateType}
          onBlendedRateTypeChange={onBlendedRateTypeChange}
        />
      </TabsContent>

      {/* Quick Estimate */}
      <TabsContent value="quick-estimate">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>Quick Estimate</CardTitle>
                  <CardDescription>
                    Get instant ballpark figures using project data
                  </CardDescription>
                </div>
              </div>
              <Button onClick={() => navigate(`/projects/${projectId}/quick-estimate`)}>
                Open Quick Estimate
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-muted-foreground">Total Area</p>
                <p className="font-medium">{tenants.reduce((sum, t) => sum + Number(t.area_sqm || 0), 0).toLocaleString()} m²</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-muted-foreground">Tenants</p>
                <p className="font-medium">{tenants.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-muted-foreground">Connection</p>
                <p className="font-medium">{project.connection_size_kva || "Not set"} kVA</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-muted-foreground">Location</p>
                <p className="font-medium">{project.location || "Not set"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Sandbox */}
      <TabsContent value="sandbox">
        <div className="space-y-4">
          <Card className="border-dashed">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FlaskConical className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Sandbox Mode
                      <Badge variant="outline" className="border-dashed">Experimental</Badge>
                    </CardTitle>
                    <CardDescription>
                      Create sandboxes to experiment with different scenarios without affecting this project
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={() => createSandbox.mutate()} disabled={createSandbox.isPending}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Sandbox
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Existing sandboxes for this project */}
          {projectSandboxes && projectSandboxes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Sandboxes for this project</h3>
              <div className="grid gap-2">
                {projectSandboxes.map((sandbox) => (
                  <Card
                    key={sandbox.id}
                    className="border-dashed hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/projects/${projectId}/sandbox/${sandbox.id}`)}
                  >
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FlaskConical className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="font-medium">{sandbox.name}</span>
                            <Badge variant="outline" className="ml-2 border-dashed bg-amber-500/10 text-amber-700 border-amber-500/30">
                              DRAFT
                            </Badge>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(sandbox.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      {/* Proposal Builder */}
      <TabsContent value="proposal">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCheck className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>Proposal Builder</CardTitle>
                  <CardDescription>
                    Create professional, client-ready proposals with verified assumptions
                  </CardDescription>
                </div>
              </div>
              <Button onClick={() => navigate(`/projects/${projectId}/proposal`)}>
                Create Proposal
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-muted-foreground">Verification</p>
                <p className="font-medium">4 checks required</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-muted-foreground">Branding</p>
                <p className="font-medium">Logo & colors</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-muted-foreground">Export</p>
                <p className="font-medium">PDF & Excel</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-muted-foreground">Workflow</p>
                <p className="font-medium">Digital signatures</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
});
