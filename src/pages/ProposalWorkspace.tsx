import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, FileCheck, CheckCircle, Settings, Eye, History, Save, Loader2, FileText, Share2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getTour, useAutoTour } from "@/components/onboarding";
import { VerificationChecklist } from "@/components/proposals/VerificationChecklist";
import { BrandingForm } from "@/components/proposals/BrandingForm";
import { SignaturePanel } from "@/components/proposals/SignaturePanel";
import { ProposalPreview } from "@/components/proposals/ProposalPreview";
import { ProposalExport } from "@/components/proposals/ProposalExport";
import { SimulationSelector } from "@/components/proposals/SimulationSelector";
import { ShareLinkButton } from "@/components/proposals/ShareLinkButton";
import {
  Proposal,
  VerificationChecklist as VerificationChecklistType,
  ProposalBranding,
  SimulationData,
  STATUS_LABELS,
  STATUS_COLORS
} from "@/components/proposals/types";

const proposalBuilderTour = getTour("proposalBuilder");

export default function ProposalWorkspace() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const proposalId = searchParams.get("id");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("simulation");
  const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'profile' | 'sandbox' | null>(null);
  const [simulationData, setSimulationData] = useState<SimulationData | null>(null);

  // Auto-start tour for first-time visitors
  useAutoTour({ tour: proposalBuilderTour });

  const [verificationChecklist, setVerificationChecklist] = useState<VerificationChecklistType>({
    site_coordinates_verified: false,
    consumption_data_source: null,
    tariff_rates_confirmed: false,
    system_specs_validated: false,
  });

  const [branding, setBranding] = useState<ProposalBranding>({
    company_name: null,
    logo_url: null,
    primary_color: "#22c55e",
    secondary_color: "#0f172a",
    contact_email: null,
    contact_phone: null,
    website: null,
    address: null,
  });

  const [executiveSummary, setExecutiveSummary] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [disclaimers, setDisclaimers] = useState(
    "This proposal is based on estimated consumption data and solar irradiance forecasts. Actual performance may vary based on weather conditions, equipment degradation, and other factors. Financial projections assume current tariff rates and do not account for future rate changes. All figures are estimates only."
  );

  // Fetch project
  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch simulations for this project
  const { data: simulations = [] } = useQuery({
    queryKey: ["project-simulations", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_simulations")
        .select("id, name, solar_capacity_kwp, battery_capacity_kwh, created_at, results_json")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map(s => ({ ...s, type: 'profile' as const }));
    },
    enabled: !!projectId,
  });

  // Fetch sandboxes for this project
  const { data: sandboxes = [] } = useQuery({
    queryKey: ["project-sandboxes", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("sandbox_simulations")
        .select("id, name, scenario_a, created_at")
        .eq("cloned_from_project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map(s => {
        const scenarioA = s.scenario_a as any;
        return {
          id: s.id,
          name: s.name,
          solar_capacity_kwp: scenarioA?.solarCapacity || null,
          battery_capacity_kwh: scenarioA?.batteryCapacity || null,
          created_at: s.created_at,
          type: 'sandbox' as const,
        };
      });
    },
    enabled: !!projectId,
  });

  // Fetch tenants for load profile
  const { data: tenants } = useQuery({
    queryKey: ["project-tenants", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_tenants")
        .select(`*, shop_types(*), scada_imports(shop_name, area_sqm, load_profile_weekday, load_profile_weekend, raw_data, date_range_start, date_range_end)`)
        .eq("project_id", projectId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch shop types
  const { data: shopTypes } = useQuery({
    queryKey: ["shop-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shop_types").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing proposal if editing
  const { data: existingProposal, isLoading: loadingProposal } = useQuery({
    queryKey: ["proposal", proposalId],
    queryFn: async () => {
      if (!proposalId) return null;
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", proposalId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!proposalId,
  });

  // Fetch proposal versions for this project
  const { data: proposalVersions } = useQuery({
    queryKey: ["proposal-versions", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("proposals")
        .select("id, version, status, created_at, updated_at")
        .eq("project_id", projectId)
        .order("version", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Load existing proposal data
  useEffect(() => {
    if (existingProposal) {
      if (existingProposal.simulation_id) {
        setSelectedSimulationId(existingProposal.simulation_id);
        setSelectedType('profile');
      } else if (existingProposal.sandbox_id) {
        setSelectedSimulationId(existingProposal.sandbox_id);
        setSelectedType('sandbox');
      }
      setVerificationChecklist(existingProposal.verification_checklist as unknown as VerificationChecklistType);
      if (existingProposal.branding) {
        setBranding(existingProposal.branding as unknown as ProposalBranding);
      }
      setExecutiveSummary(existingProposal.executive_summary || "");
      setCustomNotes(existingProposal.custom_notes || "");
      setAssumptions(existingProposal.assumptions || "");
      setDisclaimers(existingProposal.disclaimers || "");
      if (existingProposal.simulation_snapshot) {
        setSimulationData(existingProposal.simulation_snapshot as unknown as SimulationData);
      }
    }
  }, [existingProposal]);

  // Build simulation data when selection changes
  useEffect(() => {
    if (!selectedSimulationId || !selectedType) {
      setSimulationData(null);
      return;
    }

    if (selectedType === 'profile') {
      const sim = simulations.find(s => s.id === selectedSimulationId);
      if (sim) {
        const results = sim.results_json as any;
        setSimulationData({
          solarCapacity: sim.solar_capacity_kwp || 0,
          batteryCapacity: sim.battery_capacity_kwh || 0,
          batteryPower: results?.batteryPower || 0,
          annualSolarGeneration: results?.annualSolarGeneration || (sim.solar_capacity_kwp || 0) * 1600,
          annualGridImport: results?.annualGridImport || 0,
          annualGridExport: results?.annualGridExport || 0,
          annualSavings: results?.annualSavings || 0,
          paybackYears: results?.paybackYears || 0,
          roiPercentage: results?.roiPercentage || 0,
          systemCost: results?.systemCost || (sim.solar_capacity_kwp || 0) * 12000,
          tariffName: results?.tariffName,
          location: project?.location || undefined,
        });
      }
    } else {
      const sandbox = sandboxes.find(s => s.id === selectedSimulationId);
      if (sandbox) {
        setSimulationData({
          solarCapacity: sandbox.solar_capacity_kwp || 0,
          batteryCapacity: sandbox.battery_capacity_kwh || 0,
          batteryPower: 0,
          annualSolarGeneration: (sandbox.solar_capacity_kwp || 0) * 1600,
          annualGridImport: 0,
          annualGridExport: 0,
          annualSavings: (sandbox.solar_capacity_kwp || 0) * 1600 * 2.5,
          paybackYears: 5,
          roiPercentage: 300,
          systemCost: (sandbox.solar_capacity_kwp || 0) * 12000,
          location: project?.location || undefined,
        });
      }
    }
  }, [selectedSimulationId, selectedType, simulations, sandboxes, project]);

  // Get next version number
  const nextVersion = proposalVersions && proposalVersions.length > 0
    ? Math.max(...proposalVersions.map(p => p.version)) + 1
    : 1;

  // Build proposal object for components
  const proposalForComponents: Partial<Proposal> = {
    ...existingProposal,
    version: existingProposal?.version || nextVersion,
    status: (existingProposal?.status as Proposal['status']) || 'draft',
    verification_checklist: verificationChecklist,
    branding,
    executive_summary: executiveSummary,
    custom_notes: customNotes,
    assumptions,
    disclaimers,
  };

  // Save/Update proposal
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("No project selected");

      if (proposalId) {
        // Update existing
        const { error } = await supabase
          .from("proposals")
          .update({
            simulation_id: selectedType === 'profile' ? selectedSimulationId : null,
            sandbox_id: selectedType === 'sandbox' ? selectedSimulationId : null,
            verification_checklist: JSON.parse(JSON.stringify(verificationChecklist)),
            branding: JSON.parse(JSON.stringify(branding)),
            executive_summary: executiveSummary || null,
            custom_notes: customNotes || null,
            assumptions: assumptions || null,
            disclaimers,
            simulation_snapshot: simulationData ? JSON.parse(JSON.stringify(simulationData)) : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", proposalId);
        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from("proposals")
          .insert({
            project_id: projectId,
            simulation_id: selectedType === 'profile' ? selectedSimulationId : null,
            sandbox_id: selectedType === 'sandbox' ? selectedSimulationId : null,
            verification_checklist: JSON.parse(JSON.stringify(verificationChecklist)),
            branding: JSON.parse(JSON.stringify(branding)),
            executive_summary: executiveSummary || null,
            custom_notes: customNotes || null,
            assumptions: assumptions || null,
            disclaimers,
            simulation_snapshot: simulationData ? JSON.parse(JSON.stringify(simulationData)) : null,
            version: nextVersion,
          })
          .select()
          .single();
        if (error) throw error;
        // Navigate to edit mode with the new ID
        navigate(`/projects/${projectId}/proposal?id=${data.id}`, { replace: true });
      }
    },
    onSuccess: () => {
      toast.success(proposalId ? "Proposal saved" : "Proposal created");
      queryClient.invalidateQueries({ queryKey: ["proposal-versions", projectId] });
      queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] });
    },
    onError: (error) => {
      console.error("Save error:", error);
      toast.error("Failed to save proposal");
    },
  });

  // Update handler for SignaturePanel
  const handleProposalUpdate = async (updates: Partial<Proposal>) => {
    if (!proposalId) {
      toast.error("Save the proposal first");
      return;
    }

    const { error } = await supabase
      .from("proposals")
      .update(updates as Record<string, unknown>)
      .eq("id", proposalId);

    if (error) {
      toast.error("Failed to update");
    } else {
      toast.success("Updated");
      queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] });
      queryClient.invalidateQueries({ queryKey: ["proposal-versions", projectId] });
    }
  };

  const isVerificationComplete =
    verificationChecklist.site_coordinates_verified &&
    verificationChecklist.consumption_data_source !== null &&
    verificationChecklist.tariff_rates_confirmed &&
    verificationChecklist.system_specs_validated;

  if (loadingProposal) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Proposal Builder</h1>
              {existingProposal && (
                <>
                  <Badge variant="outline">v{existingProposal.version}</Badge>
                  <Badge className={STATUS_COLORS[existingProposal.status as Proposal["status"]]}>
                    {STATUS_LABELS[existingProposal.status as Proposal["status"]]}
                  </Badge>
                </>
              )}
            </div>
            <p className="text-muted-foreground">
              {project?.name || "Create client-ready proposal"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {proposalId && existingProposal && (
            <ShareLinkButton
              proposalId={proposalId}
              shareToken={existingProposal.share_token}
              status={existingProposal.status}
              projectName={project?.name}
              onTokenGenerated={() => {
                queryClient.invalidateQueries({ queryKey: ["proposal", proposalId] });
              }}
            />
          )}
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Version History Bar */}
      {proposalVersions && proposalVersions.length > 1 && (
        <Card className="border-dashed">
          <CardContent className="py-3">
            <div className="flex items-center gap-4">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Versions:</span>
              <div className="flex gap-2">
                {proposalVersions.slice(0, 5).map((v) => (
                  <Button
                    key={v.id}
                    variant={v.id === proposalId ? "default" : "ghost"}
                    size="sm"
                    onClick={() => navigate(`/projects/${projectId}/proposal?id=${v.id}`)}
                  >
                    v{v.version}
                    <Badge
                      variant="outline"
                      className={`ml-1 text-xs ${STATUS_COLORS[v.status as Proposal["status"]]}`}
                    >
                      {v.status}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Panel - Configuration */}
        <div className="lg:col-span-1 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="simulation" title="Select Simulation">
                <FileCheck className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="verify" title="Verification">
                <CheckCircle className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="branding" title="Branding">
                <Settings className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="approval" title="Approval">
                <Eye className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="simulation" className="mt-4 space-y-4">
              <SimulationSelector
                simulations={simulations}
                sandboxes={sandboxes}
                selectedId={selectedSimulationId}
                selectedType={selectedType}
                onSelect={(id, type) => {
                  setSelectedSimulationId(id);
                  setSelectedType(type);
                }}
                disabled={existingProposal?.status !== 'draft' && !!existingProposal}
              />
            </TabsContent>

            <TabsContent value="verify" className="mt-4">
              <VerificationChecklist
                checklist={verificationChecklist}
                onChange={setVerificationChecklist}
                disabled={existingProposal?.status !== "draft" && !!existingProposal}
              />
            </TabsContent>

            <TabsContent value="branding" className="mt-4 space-y-4">
              <BrandingForm
                branding={branding}
                onChange={setBranding}
                disabled={existingProposal?.status !== "draft" && !!existingProposal}
              />

              {/* Additional text fields */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">Content</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Executive Summary</Label>
                    <Textarea
                      placeholder="Optional custom executive summary..."
                      value={executiveSummary}
                      onChange={(e) => setExecutiveSummary(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Assumptions</Label>
                    <Textarea
                      placeholder="Key assumptions for this proposal..."
                      value={assumptions}
                      onChange={(e) => setAssumptions(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Disclaimers</Label>
                    <Textarea
                      value={disclaimers}
                      onChange={(e) => setDisclaimers(e.target.value)}
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="approval" className="mt-4">
              <SignaturePanel
                proposal={proposalForComponents}
                onUpdate={handleProposalUpdate}
                disabled={!proposalId}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Panel - Preview */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Proposal Preview</CardTitle>
                  <CardDescription>
                    Live preview of the final document
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <ProposalPreview
                proposal={proposalForComponents}
                project={project}
                simulation={simulationData || undefined}
                tenants={tenants || undefined}
                shopTypes={shopTypes || undefined}
              />
            </CardContent>
          </Card>

          {/* Export Section */}
          {simulationData && (
            <ProposalExport
              proposal={proposalForComponents}
              project={project}
              simulation={simulationData}
            />
          )}
        </div>
      </div>
    </div>
  );
}
