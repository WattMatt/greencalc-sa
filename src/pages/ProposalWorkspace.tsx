import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  FileCheck, 
  Eye,
  History,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOrganizationBranding } from "@/hooks/useOrganizationBranding";
import { ProposalSidebar } from "@/components/proposals/ProposalSidebar";
import { ShareLinkButton } from "@/components/proposals/ShareLinkButton";
import { generateWYSIWYGPDF } from "@/lib/pdfshift/capturePreview";
import {
  Proposal,
  VerificationChecklist as VerificationChecklistType,
  ProposalBranding,
  SimulationData,
  ContentBlock,
  DEFAULT_CONTENT_BLOCKS,
  STATUS_LABELS,
  STATUS_COLORS
} from "@/components/proposals/types";
import { ProposalTemplateId, PROPOSAL_TEMPLATES } from "@/components/proposals/templates/types";
import {
  CoverSection,
  SiteOverviewSection,
  LoadAnalysisSection,
  EquipmentSpecsSection,
  FinancialSummarySection,
  CashflowTableSection,
  TermsSection,
  SignatureSection,
  PageWrapper
} from "@/components/proposals/sections";

export default function ProposalWorkspace() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const proposalId = searchParams.get("id");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State
  const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'profile' | 'sandbox' | null>(null);
  const [simulationData, setSimulationData] = useState<SimulationData | null>(null);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>(DEFAULT_CONTENT_BLOCKS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

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

  // Fetch organization branding
  const { branding: orgBranding, isLoading: loadingOrgBranding } = useOrganizationBranding();

  // Auto-populate branding from organization settings
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

  // Fetch project with tariff
  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      if (!projectId) return null;
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

  // Extract tariff name from project
  const projectTariffName = (project as any)?.tariffs?.name || null;

  // Fetch simulations
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

  // Fetch sandboxes
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

  // Fetch tenants
  const { data: tenants } = useQuery({
    queryKey: ["project-tenants", projectId],
    queryFn: async () => {
      if (!projectId) return [];
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

  // Fetch existing proposal
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

  // Fetch proposal versions
  const { data: proposalVersions } = useQuery({
    queryKey: ["proposal-versions", projectId],
    queryFn: async () => {
      if (!projectId) return [];
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
          tariffName: projectTariffName || results?.tariffName,
          location: project?.location || undefined,
          // Advanced metrics if available
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

  // Auto-select first simulation if none selected
  useEffect(() => {
    if (!selectedSimulationId && simulations.length > 0) {
      setSelectedSimulationId(simulations[0].id);
      setSelectedType('profile');
    }
  }, [simulations, selectedSimulationId]);

  const nextVersion = proposalVersions && proposalVersions.length > 0
    ? Math.max(...proposalVersions.map(p => p.version)) + 1
    : 1;

  // Build proposal object for components
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

  // Get template
  const template = PROPOSAL_TEMPLATES[selectedTemplate];

  // Enabled pages based on content blocks
  const enabledBlocks = contentBlocks.filter(b => b.enabled).sort((a, b) => a.order - b.order);

  // Save mutation
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

  // Export handlers
  const handleExportPDF = async () => {
    if (!simulationData || !project) return;
    
    setIsExporting(true);
    try {
      const showSystemDesign = contentBlocks.find(b => b.id === 'systemDesign')?.enabled || false;
      
      await generateWYSIWYGPDF({
        proposal: proposalForComponents,
        project,
        simulation: simulationData,
        tenants,
        showSystemDesign,
        templateId: selectedTemplate,
      }, `${project.name || 'Proposal'}-v${proposalForComponents.version}.pdf`);
      
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    if (!simulationData) return;
    
    // Generate CSV with key data
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

  if (loadingProposal) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Page titles for header
  const PAGE_TITLES: Record<string, string> = {
    cover: 'Cover',
    siteOverview: 'Site Overview',
    loadAnalysis: 'Load Analysis',
    equipmentSpecs: 'Equipment Specifications',
    financialSummary: 'Financial Summary',
    cashflowTable: '20-Year Cashflow',
    terms: 'Terms & Conditions',
    signature: 'Authorization',
  };

  // Render section based on block ID
  const renderSection = (blockId: string) => {
    if (!simulationData) return null;

    const pageIndex = enabledBlocks.findIndex(b => b.id === blockId);
    const pageNumber = pageIndex + 1;
    const totalPages = enabledBlocks.length;
    const pageTitle = PAGE_TITLES[blockId] || blockId;

    // Cover section has its own branded header - don't wrap it
    if (blockId === 'cover') {
      return (
        <div className="flex flex-col min-h-[297mm]">
          <CoverSection
            proposal={proposalForComponents}
            project={project}
            simulation={simulationData}
            template={template}
          />
          {/* Cover page footer */}
          <div className="mt-auto px-6 py-3 border-t bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {[branding.contact_email, branding.contact_phone, branding.website].filter(Boolean).join(' • ') || 
                 `Generated ${new Date().toLocaleDateString("en-ZA")}`}
              </span>
              <span>Page {pageNumber} of {totalPages}</span>
            </div>
          </div>
        </div>
      );
    }

    // Extract shop types for load analysis
    const shopTypesFromTenants = tenants
      ?.map(t => t.shop_types)
      .filter((st): st is NonNullable<typeof st> => st != null) || [];
    const uniqueShopTypes = Array.from(
      new Map(shopTypesFromTenants.map(st => [st.id, st])).values()
    );

    const getSectionContent = () => {
      switch (blockId) {
        case 'siteOverview':
          return (
            <SiteOverviewSection
              proposal={proposalForComponents}
              project={project}
              simulation={simulationData}
              template={template}
              tariffName={projectTariffName || undefined}
            />
          );
        case 'loadAnalysis':
          return (
            <LoadAnalysisSection
              simulation={simulationData}
              template={template}
              tenants={tenants || []}
              shopTypes={uniqueShopTypes}
              project={project}
            />
          );
        case 'equipmentSpecs':
          return (
            <EquipmentSpecsSection
              simulation={simulationData}
              template={template}
            />
          );
        case 'financialSummary':
          return (
            <FinancialSummarySection
              simulation={simulationData}
              template={template}
            />
          );
        case 'cashflowTable':
          return (
            <CashflowTableSection
              simulation={simulationData}
              template={template}
              showAllYears={true}
            />
          );
        case 'terms':
          return (
            <TermsSection
              proposal={proposalForComponents}
              template={template}
            />
          );
        case 'signature':
          return (
            <SignatureSection
              proposal={proposalForComponents}
              template={template}
            />
          );
        default:
          return (
            <div className="text-center text-muted-foreground">
              <p className="text-sm">{blockId} section coming soon</p>
            </div>
          );
      }
    };

    return (
      <PageWrapper
        pageNumber={pageNumber}
        totalPages={totalPages}
        template={template}
        branding={branding}
        pageTitle={pageTitle}
        forPDF={false}
      >
        {getSectionContent()}
      </PageWrapper>
    );
  };

  return (
    <div className="flex h-screen bg-muted/30">
      {/* Sidebar */}
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
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-background border-b px-6 py-4">
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
                <div className="flex items-center gap-1 mr-2 text-muted-foreground">
                  <History className="h-4 w-4" />
                  <span className="text-xs">{proposalVersions.length} versions</span>
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
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
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

        {/* Preview Area */}
        <div className="flex-1 overflow-hidden p-6">
          {simulationData ? (
            <div className="h-full flex flex-col">
              {/* Page Navigation */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Live Preview</span>
                  <Badge variant="secondary" className="text-xs">
                    {simulationData.solarCapacity} kWp System
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[80px] text-center">
                    Page {currentPage + 1} of {enabledBlocks.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(enabledBlocks.length - 1, currentPage + 1))}
                    disabled={currentPage >= enabledBlocks.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* A4 Preview Container */}
              <div className="flex-1 flex items-start justify-center overflow-auto">
                <Card className="w-[210mm] min-h-[297mm] shadow-lg">
                  <CardContent className="p-0">
                    {enabledBlocks[currentPage] && renderSection(enabledBlocks[currentPage].id)}
                  </CardContent>
                </Card>
              </div>

              {/* Page Thumbnails */}
              <div className="mt-4 flex items-center justify-center gap-2 overflow-x-auto py-2">
                {enabledBlocks.map((block, index) => (
                  <button
                    key={block.id}
                    onClick={() => setCurrentPage(index)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                      currentPage === index
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    )}
                  >
                    {block.label}
                  </button>
                ))}
              </div>
            </div>
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
