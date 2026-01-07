import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Building2, Trash2, ArrowRight, RefreshCw, Search, X, LayoutGrid, List } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Projects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "", location: "" });
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [tariffFilter, setTariffFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const handleSyncExternal = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-external-projects");
      
      if (error) throw error;
      
      if (data?.error) throw new Error(data.error);
      
      toast.success(
        `Synced: ${data.projects.inserted} new projects, ${data.projects.updated} updated, ${data.tenants.inserted} new tenants, ${data.tenants.updated} updated`
      );
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (error) {
      console.error("Sync error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to sync");
    } finally {
      setIsSyncing(false);
    }
  };

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          tariffs(name, municipality_id, municipalities(name)),
          project_tenants(count)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Get unique locations for filter dropdown
  const uniqueLocations = useMemo(() => {
    if (!projects) return [];
    const locations = projects
      .map(p => p.location)
      .filter((loc): loc is string => !!loc && loc.trim() !== "");
    return [...new Set(locations)].sort();
  }, [projects]);

  // Filter projects based on search and filters
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    
    return projects.filter(project => {
      // Search filter - match name, location, or description
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        project.name.toLowerCase().includes(searchLower) ||
        project.location?.toLowerCase().includes(searchLower) ||
        project.description?.toLowerCase().includes(searchLower);
      
      // Location filter
      const matchesLocation = locationFilter === "all" || project.location === locationFilter;
      
      // Tariff filter
      const hasTariff = !!(project as any).tariffs?.name;
      const matchesTariff = tariffFilter === "all" || 
        (tariffFilter === "set" && hasTariff) ||
        (tariffFilter === "not-set" && !hasTariff);
      
      return matchesSearch && matchesLocation && matchesTariff;
    });
  }, [projects, searchQuery, locationFilter, tariffFilter]);

  const hasActiveFilters = searchQuery || locationFilter !== "all" || tariffFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setLocationFilter("all");
    setTariffFilter("all");
  };

  const createProject = useMutation({
    mutationFn: async (project: typeof newProject) => {
      const { data, error } = await supabase.from("projects").insert(project).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created");
      setDialogOpen(false);
      setNewProject({ name: "", description: "", location: "" });
      navigate(`/projects/${data.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-muted-foreground">Create and manage energy modeling projects</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSyncExternal} disabled={isSyncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync External"}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Set up a new energy modeling project for a shopping centre or building.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Project Name</Label>
                <Input
                  placeholder="e.g., Sandton City Mall"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  placeholder="e.g., Sandton, Gauteng"
                  value={newProject.location}
                  onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  placeholder="Brief description of the project"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createProject.mutate(newProject)}
                disabled={!newProject.name || createProject.isPending}
              >
                Create Project
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {uniqueLocations.map(location => (
              <SelectItem key={location} value={location}>{location}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={tariffFilter} onValueChange={setTariffFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Tariffs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tariffs</SelectItem>
            <SelectItem value="set">Tariff Set</SelectItem>
            <SelectItem value="not-set">No Tariff</SelectItem>
          </SelectContent>
        </Select>
        
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
        
        {projects && filteredProjects && (
          <span className="text-sm text-muted-foreground">
            {filteredProjects.length} of {projects.length} projects
          </span>
        )}
        
        <div className="ml-auto">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "grid" | "list")}>
            <ToggleGroupItem value="grid" aria-label="Grid view" size="sm">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" size="sm">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>


      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-5 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProjects?.length === 0 && hasActiveFilters ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No matching projects</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-1">
              Try adjusting your filters or search query.
            </p>
            <Button className="mt-4" variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : projects?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No projects yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mt-1">
              Create your first project to start modeling energy usage and comparing tariffs.
            </p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Project
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects?.map((project) => (
            <Card key={project.id} className="group hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    {project.location && (
                      <CardDescription>{project.location}</CardDescription>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProject.mutate(project.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Project Logo - only show if valid URL exists */}
                {project.logo_url && project.logo_url.trim() !== '' && (
                  <div className="flex justify-center py-2">
                    <img 
                      src={project.logo_url} 
                      alt={`${project.name} logo`}
                      className="h-12 max-w-[160px] object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tenants</span>
                    <p className="font-medium">{(project as any).project_tenants?.[0]?.count || 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tariff</span>
                    <p className="font-medium truncate">
                      {(project as any).tariffs?.name || "Not set"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  Open Project
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProjects?.map((project) => (
            <Card key={project.id} className="group hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 p-4">
                {/* Logo */}
                {project.logo_url && project.logo_url.trim() !== '' ? (
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                    <img 
                      src={project.logo_url} 
                      alt={`${project.name} logo`}
                      className="h-10 max-w-[48px] object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex-shrink-0 w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                
                {/* Project Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{project.name}</h3>
                  {project.location && (
                    <p className="text-sm text-muted-foreground truncate">{project.location}</p>
                  )}
                </div>
                
                {/* Stats */}
                <div className="hidden sm:flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <span className="text-muted-foreground block">Tenants</span>
                    <span className="font-medium">{(project as any).project_tenants?.[0]?.count || 0}</span>
                  </div>
                  <div className="text-center min-w-[100px]">
                    <span className="text-muted-foreground block">Tariff</span>
                    <span className="font-medium truncate block">
                      {(project as any).tariffs?.name || "Not set"}
                    </span>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    Open
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProject.mutate(project.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
