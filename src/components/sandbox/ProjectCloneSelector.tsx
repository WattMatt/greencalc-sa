import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Building2, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProjectCloneSelectorProps {
  selectedProjectId: string | null;
  sandboxName: string;
  onProjectSelect: (projectId: string | null) => void;
  onNameChange: (name: string) => void;
  onClone: () => void;
  isCloning: boolean;
}

export function ProjectCloneSelector({
  selectedProjectId,
  sandboxName,
  onProjectSelect,
  onNameChange,
  onClone,
  isCloning,
}: ProjectCloneSelectorProps) {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects-for-clone"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, location, total_area_sqm, connection_size_kva")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);

  return (
    <Card className="border-dashed border-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Clone Project to Sandbox</CardTitle>
        </div>
        <CardDescription>
          Select an existing project to experiment with. Changes won't affect the original.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sandbox Name */}
        <div className="space-y-2">
          <Label>Sandbox Name</Label>
          <Input
            value={sandboxName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g., Solar optimization test"
          />
        </div>

        {/* Project Selector */}
        <div className="space-y-2">
          <Label>Source Project (Optional)</Label>
          <Select
            value={selectedProjectId || "none"}
            onValueChange={(value) => onProjectSelect(value === "none" ? null : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a project to clone">
                {selectedProjectId ? (
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {selectedProject?.name || "Select project"}
                  </span>
                ) : (
                  "Start fresh (no project)"
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Start fresh (no project)
                </span>
              </SelectItem>
              {projects?.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {project.name}
                    {project.location && (
                      <span className="text-muted-foreground">- {project.location}</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Project Details */}
        {selectedProject && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <p className="font-medium text-sm">{selectedProject.name}</p>
            <div className="flex flex-wrap gap-2">
              {selectedProject.location && (
                <Badge variant="outline">{selectedProject.location}</Badge>
              )}
              {selectedProject.total_area_sqm && (
                <Badge variant="outline">{selectedProject.total_area_sqm.toLocaleString()} m²</Badge>
              )}
              {selectedProject.connection_size_kva && (
                <Badge variant="outline">{selectedProject.connection_size_kva} kVA</Badge>
              )}
            </div>
          </div>
        )}

        <Button
          onClick={onClone}
          disabled={isCloning || !sandboxName.trim()}
          className="w-full"
        >
          {isCloning ? "Creating Sandbox..." : "Create Sandbox"}
        </Button>
      </CardContent>
    </Card>
  );
}
