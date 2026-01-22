import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { 
  ArrowLeft, 
  FileCheck, 
  CheckCircle, 
  Settings, 
  Eye, 
  History, 
  Save, 
  Loader2, 
  FileText, 
  Share2,
  ChevronRight,
  ChevronLeft,
  Building2,
  Sparkles,
  AlertCircle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getTour, useAutoTour } from "@/components/onboarding";
import { VerificationChecklist } from "@/components/proposals/VerificationChecklist";
import { BrandingForm } from "@/components/proposals/BrandingForm";
import { SignaturePanel } from "@/components/proposals/SignaturePanel";
import { ProposalPreview } from "@/components/proposals/ProposalPreview";
import { ProposalExport } from "@/components/proposals/ProposalExport";
import { ProposalPrintView } from "@/components/proposals/ProposalPrintView";
import { SimulationSelector } from "@/components/proposals/SimulationSelector";
import { ShareLinkButton } from "@/components/proposals/ShareLinkButton";
import { cn } from "@/lib/utils";
import { useOrganizationBranding } from "@/hooks/useOrganizationBranding";
import {
  Proposal,
  VerificationChecklist as VerificationChecklistType,
  ProposalBranding,
  SimulationData,
  STATUS_LABELS,
  STATUS_COLORS
} from "@/components/proposals/types";
import { ProposalTemplateId, PROPOSAL_TEMPLATES } from "@/components/proposals/templates/types";

const proposalBuilderTour = getTour("proposalBuilder");

const WORKFLOW_STEPS = [
  { id: "simulation", label: "Select Simulation", icon: FileCheck, description: "Choose data source" },
  { id: "verify", label: "Verify Data", icon: CheckCircle, description: "Confirm accuracy" },
  { id: "branding", label: "Customize", icon: Building2, description: "Add branding" },
  { id: "approval", label: "Approve", icon: Eye, description: "Sign & send" },
];

export default function ProposalWorkspace() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const proposalId = searchParams.get("id");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'profile' | 'sandbox' | null>(null);
  const [simulationData, setSimulationData] = useState<SimulationData | null>(null);

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
  const [brandingAutoPopulated, setBrandingAutoPopulated] = useState(false);

  // Fetch organization branding to auto-populate
  const { branding: orgBranding, isLoading: loadingOrgBranding } = useOrganizationBranding();

  const [executiveSummary, setExecutiveSummary] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [showSystemDesign, setShowSystemDesign] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplateId>("modern");
  const printViewRef = useRef<HTMLDivElement>(null);
  const [disclaimers, setDisclaimers] = useState(
    "This proposal is based on estimated consumption data and solar irradiance forecasts. Actual performance may vary based on weather conditions, equipment degradation, and other factors. Financial projections assume current tariff rates and do not account for future rate changes. All figures are estimates only."
  );

  // Auto-populate branding from organization settings (only for new proposals)
  useEffect(() => {
    if (!proposalId && !brandingAutoPopulated && !loadingOrgBranding && orgBranding.company_name) {
      setBranding({
        company_name: orgBranding.company_name,
        logo_url: orgBranding.logo_url,
        primary_color: orgBranding.primary_color || "#22c55e",
        secondary_color: orgBranding.secondary_color || "#0f172a",
        contact_email: orgBranding.contact_email,
        contact_phone: orgBranding.contact_phone,
        website: orgBranding.website,
        address: orgBranding.address,
      });
      setBrandingAutoPopulated(true);
    }
  }, [proposalId, orgBranding, loadingOrgBranding, brandingAutoPopulated]);

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
        .select(`*, shop_types(*), scada_imports(shop_name, area_sqm, load_profile_weekday, load_profile_weekend, raw_data, date_range_start, date_range_end, detected_interval_minutes)`)
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
      
      // Merge existing proposal branding with organization branding as fallback
      // This ensures logo_url and company_name are always populated if available in org branding
      const proposalBranding = existingProposal.branding as unknown as ProposalBranding;
      setBranding({
        company_name: proposalBranding?.company_name && proposalBranding.company_name !== '1' 
          ? proposalBranding.company_name 
          : orgBranding.company_name,
        logo_url: proposalBranding?.logo_url || orgBranding.logo_url,
        primary_color: proposalBranding?.primary_color || orgBranding.primary_color || "#22c55e",
        secondary_color: proposalBranding?.secondary_color || orgBranding.secondary_color || "#0f172a",
        contact_email: proposalBranding?.contact_email || orgBranding.contact_email,
        contact_phone: proposalBranding?.contact_phone || orgBranding.contact_phone,
        website: proposalBranding?.website || orgBranding.website,
        address: proposalBranding?.address || orgBranding.address,
      });
      
      setExecutiveSummary(existingProposal.executive_summary || "");
      setCustomNotes(existingProposal.custom_notes || "");
      setAssumptions(existingProposal.assumptions || "");
      setDisclaimers(existingProposal.disclaimers || "");
      if (existingProposal.simulation_snapshot) {
        setSimulationData(existingProposal.simulation_snapshot as unknown as SimulationData);
      }
    }
  }, [existingProposal, orgBranding]);

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

  // Step completion status
  const getStepStatus = (stepIndex: number) => {
    switch (stepIndex) {
      case 0: return !!selectedSimulationId;
      case 1: return isVerificationComplete;
      case 2: return !!branding.company_name;
      case 3: return !!proposalForComponents.prepared_by;
      default: return false;
    }
  };

  const canProceedToStep = (stepIndex: number) => {
    if (stepIndex === 0) return true;
    // Allow moving back freely, but require previous step completion to move forward
    if (stepIndex <= activeStep) return true;
    return getStepStatus(stepIndex - 1);
  };

  if (loadingProposal) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background border-b">
        <div className="container max-w-7xl py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${projectId}`)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold">Proposal Builder</h1>
                  {existingProposal && (
                    <>
                      <Badge variant="outline">v{existingProposal.version}</Badge>
                      <Badge className={STATUS_COLORS[existingProposal.status as Proposal["status"]]}>
                        {STATUS_LABELS[existingProposal.status as Proposal["status"]]}
                      </Badge>
                    </>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{project?.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {proposalVersions && proposalVersions.length > 1 && (
                <div className="hidden md:flex items-center gap-1 mr-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {proposalVersions.length} versions
                  </span>
                </div>
              )}
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
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {proposalId ? "Save" : "Create Proposal"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Stepper */}
      <div className="bg-background border-b">
        <div className="container max-w-7xl py-4">
          <div className="flex items-center justify-between">
            {WORKFLOW_STEPS.map((step, index) => {
              const isActive = activeStep === index;
              const isCompleted = getStepStatus(index);
              const canAccess = canProceedToStep(index);
              const StepIcon = step.icon;
              
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => canAccess && setActiveStep(index)}
                    disabled={!canAccess}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-all w-full",
                      isActive && "bg-primary/10 ring-2 ring-primary/20",
                      !isActive && canAccess && "hover:bg-muted",
                      !canAccess && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
                      isCompleted && "bg-primary text-primary-foreground",
                      isActive && !isCompleted && "bg-primary/20 text-primary",
                      !isActive && !isCompleted && "bg-muted text-muted-foreground"
                    )}>
                      {isCompleted ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <StepIcon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className={cn(
                        "text-sm font-medium",
                        isActive && "text-primary"
                      )}>
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </button>
                  {index < WORKFLOW_STEPS.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 mx-2 shrink-0 hidden lg:block" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 lg:px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Panel - Step Content */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-4">
            {/* Step Navigation */}
            <div className="flex items-center justify-between">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                disabled={activeStep === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <span className="text-sm text-muted-foreground">
                Step {activeStep + 1} of {WORKFLOW_STEPS.length}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setActiveStep(Math.min(WORKFLOW_STEPS.length - 1, activeStep + 1))}
                disabled={activeStep === WORKFLOW_STEPS.length - 1 || !getStepStatus(activeStep)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Step Content */}
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="pr-4 space-y-4">
                {activeStep === 0 && (
                  <>
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
                    
                    {/* Quick Stats from Selected Simulation */}
                    {simulationData && (
                      <Card className="border-primary/20 bg-primary/5">
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm">Selected Simulation Summary</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Solar Capacity</p>
                              <p className="font-semibold">{simulationData.solarCapacity} kWp</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Annual Savings</p>
                              <p className="font-semibold">R{simulationData.annualSavings.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Payback Period</p>
                              <p className="font-semibold">{simulationData.paybackYears.toFixed(1)} years</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">System Cost</p>
                              <p className="font-semibold">R{simulationData.systemCost.toLocaleString()}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {activeStep === 1 && (
                  <>
                    {!selectedSimulationId && (
                      <Card className="border-amber-500/50 bg-amber-500/5">
                        <CardContent className="py-4">
                          <div className="flex items-center gap-2 text-amber-700">
                            <AlertCircle className="h-4 w-4" />
                            <p className="text-sm">Select a simulation first to verify data</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    <VerificationChecklist
                      checklist={verificationChecklist}
                      onChange={setVerificationChecklist}
                      disabled={existingProposal?.status !== "draft" && !!existingProposal}
                      project={project}
                      tenants={tenants}
                      simulationData={simulationData}
                    />
                  </>
                )}

                {activeStep === 2 && (
                  <>
                    <BrandingForm
                      branding={branding}
                      onChange={setBranding}
                      disabled={existingProposal?.status !== "draft" && !!existingProposal}
                      autoPopulated={brandingAutoPopulated}
                    />

                    {/* Content Fields */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-base">Proposal Content</CardTitle>
                        </div>
                        <CardDescription>
                          Customize the text content in your proposal
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Executive Summary</Label>
                          <Textarea
                            placeholder="Leave blank for auto-generated summary, or write your own..."
                            value={executiveSummary}
                            onChange={(e) => setExecutiveSummary(e.target.value)}
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Assumptions</Label>
                          <Textarea
                            placeholder="• 0.5% annual panel degradation&#10;• 8% annual tariff escalation"
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
                        <div className="space-y-2">
                          <Label>Custom Notes</Label>
                          <Textarea
                            placeholder="Any additional notes for the client..."
                            value={customNotes}
                            onChange={(e) => setCustomNotes(e.target.value)}
                            rows={2}
                          />
                        </div>
                        <Separator className="my-4" />
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Include System Design</Label>
                            <p className="text-xs text-muted-foreground">
                              Show PV layout diagram if configured
                            </p>
                          </div>
                          <Switch
                            checked={showSystemDesign}
                            onCheckedChange={setShowSystemDesign}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}

                {activeStep === 3 && (
                  <>
                    {!proposalId && (
                      <Card className="border-amber-500/50 bg-amber-500/5">
                        <CardContent className="py-4">
                          <div className="flex items-center gap-2 text-amber-700">
                            <AlertCircle className="h-4 w-4" />
                            <p className="text-sm">Save the proposal first to enable approval workflow</p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    <SignaturePanel
                      proposal={proposalForComponents}
                      onUpdate={handleProposalUpdate}
                      disabled={!proposalId}
                    />
                  </>
                )}

                {/* Export Section - Always visible when simulation is selected */}
                {simulationData && (
                  <div className="pt-4 border-t mt-4">
                    <ProposalExport
                      proposal={proposalForComponents}
                      project={project}
                      simulation={simulationData}
                      selectedTemplate={selectedTemplate}
                      onTemplateChange={setSelectedTemplate}
                      printViewRef={printViewRef}
                      tenants={tenants || undefined}
                      shopTypes={shopTypes || undefined}
                      showSystemDesign={showSystemDesign}
                    />
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Live Preview */}
          <div className="lg:col-span-8 xl:col-span-9">
            <Card className="sticky top-[140px]">
              <CardHeader className="py-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">Live Preview</CardTitle>
                  </div>
                  {simulationData && (
                    <Badge variant="secondary" className="text-xs">
                      {simulationData.solarCapacity} kWp System
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-320px)]">
                  {simulationData ? (
                    <ProposalPreview
                      proposal={proposalForComponents}
                      project={project}
                      simulation={simulationData}
                      tenants={tenants || undefined}
                      shopTypes={shopTypes || undefined}
                      showSystemDesign={showSystemDesign}
                      templateId={selectedTemplate}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <FileCheck className="h-12 w-12 text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground font-medium">No Simulation Selected</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Select a simulation in Step 1 to see the proposal preview
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Hidden Print View for WYSIWYG PDF capture */}
      {simulationData && (
        <ProposalPrintView
          ref={printViewRef}
          proposal={proposalForComponents}
          project={project}
          simulation={simulationData}
          tenants={tenants || undefined}
          shopTypes={shopTypes || undefined}
          showSystemDesign={showSystemDesign}
          templateId={selectedTemplate}
        />
      )}
    </div>
  );
}
