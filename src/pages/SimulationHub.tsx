import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlaskConical, Trash2, Play, Clock, ArrowRight, Building2, Map } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function SimulationHub() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch all sandboxes across all projects
  const { data: sandboxes, isLoading } = useQuery({
    queryKey: ["all-sandboxes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sandbox_simulations")
        .select("*, projects:cloned_from_project_id(id, name)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
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
      queryClient.invalidateQueries({ queryKey: ["all-sandboxes"] });
    },
  });

  // Group sandboxes by project
  const groupedSandboxes = sandboxes?.reduce((acc, sandbox) => {
    const projectId = sandbox.cloned_from_project_id || "unassigned";
    const projectName = (sandbox.projects as any)?.name || "Unassigned";
    if (!acc[projectId]) {
      acc[projectId] = { name: projectName, sandboxes: [] };
    }
    acc[projectId].sandboxes.push(sandbox);
    return acc;
  }, {} as Record<string, { name: string; sandboxes: typeof sandboxes }>);

  return (
    <div className="container max-w-5xl py-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">All Sandboxes</h1>
            <p className="text-muted-foreground">
              Overview of all experimental sandboxes across your projects
            </p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <FlaskConical className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Sandbox Mode</p>
              <p className="text-sm text-muted-foreground">
                Sandboxes are created from projects to experiment with different scenarios. 
                Go to a project's <strong>Simulation</strong> tab and select <strong>Sandbox</strong> to create one.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sandboxes List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !sandboxes || sandboxes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Sandboxes Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create sandboxes from your projects to start experimenting
            </p>
            <Button variant="outline" onClick={() => navigate("/projects")}>
              <Building2 className="mr-2 h-4 w-4" />
              Go to Projects
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedSandboxes || {}).map(([projectId, group]) => (
            <div key={projectId} className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-medium">{group.name}</h2>
                <Badge variant="secondary" className="text-xs">
                  {group.sandboxes.length} sandbox{group.sandboxes.length !== 1 ? "es" : ""}
                </Badge>
                {projectId !== "unassigned" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => navigate(`/projects/${projectId}`)}
                  >
                    View Project
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="grid gap-2">
                {group.sandboxes.map((sandbox) => (
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
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Updated {new Date(sandbox.updated_at).toLocaleDateString()}
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
            </div>
          ))}
        </div>
      )}

      {/* Development Roadmap Link */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Map className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Development Roadmap</p>
                <p className="text-sm text-muted-foreground">
                  View progress and development prompts for upcoming features
                </p>
              </div>
            </div>
            <Button variant="ghost" onClick={() => navigate("/simulations/roadmap")}>
              View Roadmap <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
