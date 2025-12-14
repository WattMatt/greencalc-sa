import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FlaskConical, Trash2, Play, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { ProjectCloneSelector } from "@/components/sandbox/ProjectCloneSelector";

export default function Sandbox() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [sandboxName, setSandboxName] = useState("");

  // Fetch existing sandboxes
  const { data: sandboxes, isLoading } = useQuery({
    queryKey: ["sandboxes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sandbox_simulations")
        .select("*, projects:cloned_from_project_id(name)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Create sandbox mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      // Fetch project snapshot if cloning
      let projectSnapshot = null;
      if (selectedProjectId) {
        const { data: project } = await supabase
          .from("projects")
          .select("*")
          .eq("id", selectedProjectId)
          .single();
        projectSnapshot = project;
      }

      const { data, error } = await supabase
        .from("sandbox_simulations")
        .insert({
          name: sandboxName,
          cloned_from_project_id: selectedProjectId,
          project_snapshot: projectSnapshot ? JSON.parse(JSON.stringify(projectSnapshot)) : null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Sandbox created");
      queryClient.invalidateQueries({ queryKey: ["sandboxes"] });
      navigate(`/simulations/sandbox/${data.id}`);
    },
    onError: () => {
      toast.error("Failed to create sandbox");
    },
  });

  // Delete sandbox mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sandbox_simulations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sandbox deleted");
      queryClient.invalidateQueries({ queryKey: ["sandboxes"] });
    },
  });

  return (
    <div className="container max-w-5xl py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/simulations")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Sandbox Mode</h1>
          </div>
          <p className="text-muted-foreground">
            Experiment freely with different scenarios without affecting production data
          </p>
        </div>
      </div>

      {/* Create New Sandbox */}
      <ProjectCloneSelector
        selectedProjectId={selectedProjectId}
        sandboxName={sandboxName}
        onProjectSelect={setSelectedProjectId}
        onNameChange={setSandboxName}
        onClone={() => createMutation.mutate()}
        isCloning={createMutation.isPending}
      />

      {/* Existing Sandboxes */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your Sandboxes</h2>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : sandboxes?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No sandboxes yet. Create one above to start experimenting.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {sandboxes?.map((sandbox) => (
              <Card
                key={sandbox.id}
                className="border-dashed hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/simulations/sandbox/${sandbox.id}`)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FlaskConical className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{sandbox.name}</span>
                          <Badge
                            variant="outline"
                            className="border-dashed bg-amber-500/10 text-amber-700 border-amber-500/30"
                          >
                            DRAFT
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {(sandbox.projects as any)?.name && (
                            <span>Cloned from: {(sandbox.projects as any).name}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(sandbox.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/simulations/sandbox/${sandbox.id}`);
                        }}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(sandbox.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
