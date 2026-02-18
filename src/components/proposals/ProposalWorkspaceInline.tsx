import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  FileCheck, 
  History,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationBranding } from "@/hooks/useOrganizationBranding";
import { ProposalSidebar } from "@/components/proposals/ProposalSidebar";
import { ShareLinkButton } from "@/components/proposals/ShareLinkButton";
import { LaTeXWorkspace } from "@/components/proposals/latex/LaTeXWorkspace";
import { downloadPdf } from "@/lib/latex/SwiftLaTeXEngine";
import { TemplateData } from "@/lib/latex/templates/proposalTemplate";
import {
  Proposal,
  VerificationChecklist as VerificationChecklistType,
  ProposalBranding,
  SimulationData,
  ContentBlock,
  ContentBlockId,
  DEFAULT_CONTENT_BLOCKS,
  STATUS_LABELS,
  STATUS_COLORS
} from "@/components/proposals/types";
import { ProposalTemplateId } from "@/components/proposals/templates/types";

interface ProposalWorkspaceInlineProps {
  projectId: string;
  proposalId: string | null;
  onBack: () => void;
}

export function ProposalWorkspaceInline({ projectId, proposalId, onBack }: ProposalWorkspaceInlineProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Track the current proposal id (may change after first save of a new proposal)
  const [currentProposalId, setCurrentProposalId] = useState<string | null>(proposalId);

  const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'profile' | 'sandbox' | null>(null);
  const [simulationData, setSimulationData] = useState<SimulationData | null>(null);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>(DEFAULT_CONTENT_BLOCKS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiNarratives, setAiNarratives] = useState<Record<string, { narrative: string; keyHighlights?: string[] }>>({});
  const [generatingNarrativeId, setGeneratingNarrativeId] = useState<string | null>(null);

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

  const [executiveSummary, setExecutiveSummary] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [disclaimers, setDisclaimers] = useState(
    "This proposal is based on estimated consumption data and solar irradiance forecasts. Actual performance may vary based on weather conditions, equipment degradation, and other factors."
  );
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplateId>("modern");

  const pdfBlobRef = useRef<Blob | null>(null);
  const sectionOverridesRef = useRef<Record<string, string>>({});

  const { branding: orgBranding, isLoading: loadingOrgBranding } = useOrganizationBranding();

  useEffect(() => {
    if (!currentProposalId && !brandingAutoPopulated && !loadingOrgBranding && orgBranding.company_name) {
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
  }, [currentProposalId, orgBranding, loadingOrgBranding, brandingAutoPopulated]);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, tariffs(id, name)")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const projectTariffName = (project as any)?.tariffs?.name || null;

  const { data: simulations = [] } = useQuery({
    queryKey: ["project-simulations", projectId],
    queryFn: async () => {
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

  const { data: sandboxes = [] } = useQuery({
    queryKey: ["project-sandboxes", projectId],
    queryFn: async () => {
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

  const { data: tenants } = useQuery({
    queryKey: ["project-tenants", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tenants")
        .select(`*, shop_types(*), scada_imports(*)`)
        .eq("project_id", projectId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: existingProposal, isLoading: loadingProposal } = useQuery({
    queryKey: ["proposal", currentProposalId],
    queryFn: async () => {
      if (!currentProposalId) return null;
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", currentProposalId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentProposalId,
  });

  const { data: proposalVersions } = useQuery({
    queryKey: ["proposal-versions", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, version, status, created_at")
        .eq("project_id", projectId)
        .order("version", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

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
      
      const proposalBranding = existingProposal.branding as unknown as ProposalBranding;
      setBranding({
        company_name: proposalBranding?.company_name || orgBranding.company_name,
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
      if ((existingProposal as any).content_blocks) {
        setContentBlocks((existingProposal as any).content_blocks as ContentBlock[]);
      }
      if ((existingProposal as any).section_overrides) {
        sectionOverridesRef.current = (existingProposal as any).section_overrides as Record<string, string>;
      }
    }
  }, [existingProposal, orgBranding]);

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
          tariffName: projectTariffName || results?.tariffName,
          location: project?.location || undefined,
          npv: results?.npv,
          irr: results?.irr,
          lcoe: results?.lcoe,
          yearlyProjections: results?.yearlyProjections,
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
          tariffName: projectTariffName || undefined,
          location: project?.location || undefined,
        });
      }
    }
  }, [selectedSimulationId, selectedType, simulations, sandboxes, project, projectTariffName]);

  useEffect(() => {
    if (!selectedSimulationId && simulations.length > 0) {
      setSelectedSimulationId(simulations[0].id);
      setSelectedType('profile');
    }
  }, [simulations, selectedSimulationId]);

  const nextVersion = proposalVersions && proposalVersions.length > 0
    ? Math.max(...proposalVersions.map(p => p.version)) + 1
    : 1;

  const proposalForComponents: Partial<Proposal> = useMemo(() => ({
    id: existingProposal?.id,
    project_id: existingProposal?.project_id || projectId || '',
    simulation_id: existingProposal?.simulation_id,
    sandbox_id: existingProposal?.sandbox_id,
    version: existingProposal?.version || nextVersion,
    status: (existingProposal?.status as Proposal['status']) || 'draft',
    verification_checklist: verificationChecklist,
    branding,
    executive_summary: executiveSummary,
    custom_notes: customNotes,
    assumptions,
    disclaimers,
    prepared_by: existingProposal?.prepared_by,
    prepared_at: existingProposal?.prepared_at,
    client_signature: existingProposal?.client_signature,
    client_signed_at: existingProposal?.client_signed_at,
    share_token: existingProposal?.share_token,
    created_at: existingProposal?.created_at || new Date().toISOString(),
    updated_at: existingProposal?.updated_at || new Date().toISOString(),
  }), [existingProposal, projectId, nextVersion, verificationChecklist, branding, executiveSummary, customNotes, assumptions, disclaimers]);

  const templateData: TemplateData | null = useMemo(() => {
    if (!simulationData) return null;
    return {
      simulation: simulationData,
      branding,
      contentBlocks,
      proposal: proposalForComponents,
      project,
      tenants: tenants || [],
      tariffName: projectTariffName || undefined,
    };
  }, [simulationData, branding, contentBlocks, proposalForComponents, project, tenants, projectTariffName]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("No project selected");

      if (currentProposalId) {
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
            content_blocks: JSON.parse(JSON.stringify(contentBlocks)),
            section_overrides: Object.keys(sectionOverridesRef.current).length > 0 ? sectionOverridesRef.current : null,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", currentProposalId);
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
            content_blocks: JSON.parse(JSON.stringify(contentBlocks)),
            section_overrides: Object.keys(sectionOverridesRef.current).length > 0 ? sectionOverridesRef.current : null,
            version: nextVersion,
          } as any)
          .select()
          .single();
        if (error) throw error;
        setCurrentProposalId(data.id);
      }
    },
    onSuccess: () => {
      toast.success(currentProposalId ? "Proposal saved" : "Proposal created");
      queryClient.invalidateQueries({ queryKey: ["proposal-versions", projectId] });
      queryClient.invalidateQueries({ queryKey: ["proposal", currentProposalId] });
      queryClient.invalidateQueries({ queryKey: ["project-proposals", projectId] });
    },
    onError: (error) => {
      console.error("Save error:", error);
      toast.error("Failed to save proposal");
    },
  });

  const handleExportPDF = async () => {
    if (!pdfBlobRef.current) {
      toast.error("No compiled PDF available. Wait for compilation to finish.");
      return;
    }
    setIsExporting(true);
    try {
      const filename = `${project?.name || 'Proposal'}-v${proposalForComponents.version}.pdf`;
      downloadPdf(pdfBlobRef.current, filename);
      toast.success("PDF exported successfully");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    if (!simulationData) return;
    
    const rows = [
      ["Solar Proposal Export"],
      ["Project", project?.name || ""],
      ["Version", proposalForComponents.version],
      [""],
      ["System Specifications"],
      ["Solar Capacity (kWp)", simulationData.solarCapacity],
      ["Battery Capacity (kWh)", simulationData.batteryCapacity],
      ["Annual Generation (kWh)", simulationData.annualSolarGeneration],
      [""],
      ["Financial Summary"],
      ["System Cost", simulationData.systemCost],
      ["Annual Savings", simulationData.annualSavings],
      ["Payback (years)", simulationData.paybackYears],
      ["ROI (%)", simulationData.roiPercentage],
      ...(simulationData.npv ? [["NPV", simulationData.npv]] : []),
      ...(simulationData.irr ? [["IRR (%)", simulationData.irr]] : []),
      ...(simulationData.lcoe ? [["LCOE (R/kWh)", simulationData.lcoe]] : []),
    ];

    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name || 'Proposal'}-v${proposalForComponents.version}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel/CSV exported");
  };

  const handleGenerateNarrative = useCallback(async (blockId: ContentBlockId, sectionType: string) => {
    if (!simulationData || !project) return;
    setGeneratingNarrativeId(blockId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-proposal-narrative', {
        body: {
          sectionType,
          projectData: {
            projectName: project.name || "Solar Project",
            location: project.location,
            buildingArea: project.total_area_sqm,
            connectionSize: project.connection_size_kva,
            solarCapacityKwp: simulationData.solarCapacity,
            batteryCapacityKwh: simulationData.batteryCapacity,
            dcAcRatio: simulationData.equipmentSpecs?.tiltAngle ? undefined : 1.3,
            annualSavings: simulationData.annualSavings,
            paybackYears: simulationData.paybackYears,
            roiPercent: simulationData.roiPercentage,
            tariffName: simulationData.tariffName,
          },
        },
      });
      if (error) throw error;
      setAiNarratives(prev => ({
        ...prev,
        [blockId]: { narrative: data.narrative, keyHighlights: data.keyHighlights },
      }));
      toast.success(`AI narrative generated for "${contentBlocks.find(b => b.id === blockId)?.label || blockId}"`);
    } catch (err) {
      console.error("Narrative generation error:", err);
      toast.error("Failed to generate AI narrative");
    } finally {
      setGeneratingNarrativeId(null);
    }
  }, [simulationData, project, contentBlocks]);

  const handlePdfReady = useCallback((blob: Blob | null) => {
    pdfBlobRef.current = blob;
  }, []);

  if (loadingProposal) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] overflow-hidden bg-muted/30 rounded-lg border">
      <ProposalSidebar
        contentBlocks={contentBlocks}
        onContentBlocksChange={setContentBlocks}
        branding={branding}
        onBrandingChange={setBranding}
        selectedTemplate={selectedTemplate}
        onTemplateChange={setSelectedTemplate}
        simulation={simulationData}
        proposal={proposalForComponents}
        project={project}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        isExporting={isExporting}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        aiNarratives={aiNarratives}
        onGenerateNarrative={handleGenerateNarrative}
        generatingNarrativeId={generatingNarrativeId}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-background border-b px-4 py-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack}>
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
                <div className="flex items-center gap-1 mr-2 text-muted-foreground">
                  <History className="h-4 w-4" />
                  <span className="text-xs">{proposalVersions.length} versions</span>
                </div>
              )}
              {currentProposalId && existingProposal && (
                <ShareLinkButton
                  proposalId={currentProposalId}
                  shareToken={existingProposal.share_token}
                  status={existingProposal.status}
                  projectName={project?.name}
                  onTokenGenerated={() => {
                    queryClient.invalidateQueries({ queryKey: ["proposal", currentProposalId] });
                  }}
                />
              )}
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {currentProposalId ? "Save" : "Create Proposal"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {templateData ? (
            <LaTeXWorkspace
              templateData={templateData}
              onPdfReady={handlePdfReady}
              initialOverrides={sectionOverridesRef.current}
              onOverridesChange={(overrides) => { sectionOverridesRef.current = overrides; }}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">No Simulation Data</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Select or create a simulation to preview the proposal
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
