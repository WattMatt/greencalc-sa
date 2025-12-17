import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTour, useAutoTour } from "@/components/onboarding";

import { SandboxToolbar } from "@/components/sandbox/SandboxToolbar";
import { ScenarioCard, ScenarioConfig } from "@/components/sandbox/ScenarioCard";
import { ScenarioComparison } from "@/components/sandbox/ScenarioComparison";
import { ParameterSweep, SweepConfig } from "@/components/sandbox/ParameterSweep";
import { DraftReportDialog } from "@/components/sandbox/DraftReportDialog";
import { useSandboxState } from "@/components/sandbox/useSandboxState";

const sandboxTour = getTour("sandbox");

export default function SandboxWorkspace() {
  const navigate = useNavigate();
  const { projectId, id } = useParams<{ projectId: string; id: string }>();
  const queryClient = useQueryClient();

  const [isRunning, setIsRunning] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Auto-start tour for first-time visitors
  useAutoTour({ tour: sandboxTour });

  const {
    state,
    canUndo,
    canRedo,
    undo,
    redo,
    updateScenario,
    addScenario,
    removeScenario,
    updateSweepConfig,
    runSimulation,
  } = useSandboxState();

  // Fetch sandbox data
  const { data: sandbox, isLoading } = useQuery({
    queryKey: ["sandbox", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("sandbox_simulations")
        .select("*, projects:cloned_from_project_id(name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No sandbox ID");
      
      const scenarioA = state.scenarios.find((s) => s.id === "A")?.config;
      const scenarioB = state.scenarios.find((s) => s.id === "B")?.config;
      const scenarioC = state.scenarios.find((s) => s.id === "C")?.config;
      
      const { error } = await supabase
        .from("sandbox_simulations")
        .update({
          scenario_a: scenarioA ? JSON.parse(JSON.stringify(scenarioA)) : null,
          scenario_b: scenarioB ? JSON.parse(JSON.stringify(scenarioB)) : null,
          scenario_c: scenarioC ? JSON.parse(JSON.stringify(scenarioC)) : null,
          sweep_config: JSON.parse(JSON.stringify(state.sweepConfig)),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Draft saved");
      queryClient.invalidateQueries({ queryKey: ["sandbox", id] });
    },
    onError: () => {
      toast.error("Failed to save draft");
    },
  });

  const handleRunSimulation = async () => {
    setIsRunning(true);
    // Simulate async calculation
    await new Promise((resolve) => setTimeout(resolve, 500));
    runSimulation();
    setIsRunning(false);
    toast.success("Simulation complete");
  };

  const handlePromoteToProject = () => {
    toast.info("Promote to Project feature coming soon");
  };

  if (isLoading) {
    return (
      <div className="container py-6">
        <p className="text-muted-foreground">Loading sandbox...</p>
      </div>
    );
  }

  if (!sandbox && id) {
    return (
      <div className="container py-6">
        <p className="text-destructive">Sandbox not found</p>
        <Button variant="outline" onClick={() => navigate(`/projects/${projectId}`)}>
          Back to Project
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${projectId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <SandboxToolbar
            sandboxName={sandbox?.name || "Untitled Sandbox"}
            canUndo={canUndo}
            canRedo={canRedo}
            scenarioCount={state.scenarios.length}
            onUndo={undo}
            onRedo={redo}
            onSave={() => saveMutation.mutate()}
            onAddScenario={addScenario}
            onRunSimulation={handleRunSimulation}
            onGenerateReport={() => setReportOpen(true)}
            onPromoteToProject={handlePromoteToProject}
            isSaving={saveMutation.isPending}
            isRunning={isRunning}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Scenarios */}
        <div className="lg:col-span-3">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {state.scenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                id={scenario.id}
                config={scenario.config}
                results={scenario.results}
                onConfigChange={(config) => updateScenario(scenario.id, config)}
                onRemove={
                  state.scenarios.length > 1
                    ? () => removeScenario(scenario.id)
                    : undefined
                }
              />
            ))}
          </div>

          {/* Comparison */}
          {state.scenarios.some((s) => s.results) && (
            <div className="mt-6">
              <ScenarioComparison scenarios={state.scenarios} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <ParameterSweep
            config={state.sweepConfig}
            onConfigChange={updateSweepConfig}
          />
        </div>
      </div>

      {/* Draft Report Dialog */}
      <DraftReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        sandboxName={sandbox?.name || "Untitled Sandbox"}
        scenarios={state.scenarios}
        clonedFromProject={(sandbox?.projects as any)?.name}
      />
    </div>
  );
}
