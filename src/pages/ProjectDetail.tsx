import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, BarChart3, DollarSign, Zap } from "lucide-react";
import { TenantManager } from "@/components/projects/TenantManager";
import { LoadProfileChart } from "@/components/projects/LoadProfileChart";
import { TariffSelector } from "@/components/projects/TariffSelector";
import { SimulationPanel } from "@/components/projects/SimulationPanel";
import { toast } from "sonner";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("tenants");

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          tariffs(*, municipality_id, municipalities(name, province_id, provinces(name)))
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: tenants } = useQuery({
    queryKey: ["project-tenants", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tenants")
        .select(`*, shop_types(*), scada_imports(shop_name, area_sqm, load_profile_weekday)`)
        .eq("project_id", id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: shopTypes } = useQuery({
    queryKey: ["shop-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shop_types").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const updateProject = useMutation({
    mutationFn: async (updates: { tariff_id?: string; total_area_sqm?: number }) => {
      const { error } = await supabase.from("projects").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      toast.success("Project updated");
    },
    onError: (error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse" />
        <div className="h-96 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Project not found</p>
        <Button variant="link" onClick={() => navigate("/projects")}>
          Back to Projects
        </Button>
      </div>
    );
  }

  // Calculate total area from tenants
  const totalArea = tenants?.reduce((sum, t) => sum + Number(t.area_sqm || 0), 0) || 0;

  // Count tenants with assigned SCADA profiles
  const assignedCount = tenants?.filter(t => t.scada_import_id).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          <p className="text-muted-foreground">
            {project.location || "No location set"} • {tenants?.length || 0} tenants ({assignedCount} with profiles) • {totalArea.toLocaleString()} m²
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="tenants">
            <Users className="h-4 w-4 mr-2" />
            Tenants & Profiles
          </TabsTrigger>
          <TabsTrigger value="load-profile">
            <BarChart3 className="h-4 w-4 mr-2" />
            Load Profile
          </TabsTrigger>
          <TabsTrigger value="tariff">
            <DollarSign className="h-4 w-4 mr-2" />
            Tariff
          </TabsTrigger>
          <TabsTrigger value="simulation">
            <Zap className="h-4 w-4 mr-2" />
            Simulation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="mt-6">
          <TenantManager
            projectId={id!}
            tenants={tenants || []}
            shopTypes={shopTypes || []}
          />
        </TabsContent>

        <TabsContent value="load-profile" className="mt-6">
          <LoadProfileChart tenants={tenants || []} shopTypes={shopTypes || []} />
        </TabsContent>

        <TabsContent value="tariff" className="mt-6">
          <TariffSelector
            projectId={id!}
            currentTariffId={project.tariff_id}
            onSelect={(tariffId) => updateProject.mutate({ tariff_id: tariffId })}
          />
        </TabsContent>

        <TabsContent value="simulation" className="mt-6">
          <SimulationPanel
            projectId={id!}
            project={project}
            tenants={tenants || []}
            shopTypes={shopTypes || []}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}