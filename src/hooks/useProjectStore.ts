import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface SystemConfig {
  solarPV: boolean;
  battery: boolean;
  generator: boolean;
}

export type SystemType = string | null; // Legacy - use SystemConfig for new code

export type WorkflowStepStatus = 'complete' | 'partial' | 'pending' | 'blocked';

export interface WorkflowStep {
  id: number;
  key: string;
  name: string;
  status: WorkflowStepStatus;
}

export interface ProjectParameters {
  name: string;
  location: string;
  totalAreaSqm: number;
  capacityKva: number;
  systemType: SystemType;
  clientName: string;
  budgetMin: number | null;
  budgetMax: number | null;
  targetDate: Date | null;
}

export interface ProjectKPIs {
  annualYieldMwh: number;
  savingsPerYear: number;
  roiPercent: number;
  selfCoveragePercent: number;
  co2AvoidedTons: number;
  gridImpactPercent: number;
}

interface ProjectStore {
  // State
  projectId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  lastSyncedAt: Date | null;
  
  parameters: ProjectParameters;
  workflowSteps: WorkflowStep[];
  kpis: ProjectKPIs;
  
  // Actions
  setProjectId: (id: string | null) => void;
  setParameters: (params: Partial<ProjectParameters>) => void;
  updateParameter: <K extends keyof ProjectParameters>(key: K, value: ProjectParameters[K]) => void;
  setWorkflowSteps: (steps: WorkflowStep[]) => void;
  updateWorkflowStep: (stepId: number, status: WorkflowStepStatus) => void;
  setKPIs: (kpis: Partial<ProjectKPIs>) => void;
  
  // Database operations
  loadFromDatabase: (projectId: string) => Promise<void>;
  syncToDatabase: () => Promise<void>;
  debouncedSync: () => void;
  
  // Reset
  reset: () => void;
}

// Default values
const defaultParameters: ProjectParameters = {
  name: '',
  location: '',
  totalAreaSqm: 0,
  capacityKva: 0,
  systemType: null,
  clientName: '',
  budgetMin: null,
  budgetMax: null,
  targetDate: null,
};

const defaultWorkflowSteps: WorkflowStep[] = [
  { id: 1, key: 'resource-analysis', name: 'Resource Analysis', status: 'pending' },
  { id: 2, key: 'system-design', name: 'System Design', status: 'pending' },
  { id: 3, key: 'energy-config', name: 'Energy Configuration', status: 'pending' },
  { id: 4, key: 'financial-analysis', name: 'Financial Analysis', status: 'pending' },
  { id: 5, key: 'proposal-draft', name: 'Proposal Draft', status: 'pending' },
  { id: 6, key: 'client-review', name: 'Client Review', status: 'pending' },
  { id: 7, key: 'approval', name: 'Approval Workflow', status: 'pending' },
  { id: 8, key: 'contract', name: 'Contract Generation', status: 'pending' },
  { id: 9, key: 'portal-setup', name: 'Portal Setup', status: 'pending' },
];

const defaultKPIs: ProjectKPIs = {
  annualYieldMwh: 0,
  savingsPerYear: 0,
  roiPercent: 0,
  selfCoveragePercent: 0,
  co2AvoidedTons: 0,
  gridImpactPercent: 0,
};

// Debounce helper
let syncTimeout: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 1000;

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // Initial state
  projectId: null,
  isLoading: false,
  isSaving: false,
  isDirty: false,
  lastSyncedAt: null,
  
  parameters: { ...defaultParameters },
  workflowSteps: [...defaultWorkflowSteps],
  kpis: { ...defaultKPIs },
  
  // Actions
  setProjectId: (id) => set({ projectId: id }),
  
  setParameters: (params) => {
    set((state) => ({
      parameters: { ...state.parameters, ...params },
      isDirty: true,
    }));
    // Trigger debounced sync
    get().debouncedSync();
  },
  
  updateParameter: (key, value) => {
    set((state) => ({
      parameters: { ...state.parameters, [key]: value },
      isDirty: true,
    }));
    // Trigger debounced sync
    get().debouncedSync();
  },
  
  setWorkflowSteps: (steps) => set({ workflowSteps: steps }),
  
  updateWorkflowStep: (stepId, status) => {
    set((state) => ({
      workflowSteps: state.workflowSteps.map((step) =>
        step.id === stepId ? { ...step, status } : step
      ),
    }));
  },
  
  setKPIs: (kpis) => set((state) => ({ kpis: { ...state.kpis, ...kpis } })),
  
  // Load project data from database
  loadFromDatabase: async (projectId) => {
    set({ isLoading: true, projectId });
    
    try {
      // Fetch project data
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (projectError) throw projectError;
      
      // Fetch tenant count for area calculation
      const { data: tenants } = await supabase
        .from('project_tenants')
        .select('area_sqm, scada_import_id')
        .eq('project_id', projectId);
      
      // Fetch simulation count
      const { count: simulationCount } = await supabase
        .from('project_simulations')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);
      
      // Fetch proposal count
      const { count: proposalCount } = await supabase
        .from('proposals')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);
      
      // Fetch PV layout
      const { data: pvLayout } = await supabase
        .from('pv_layouts')
        .select('pv_arrays')
        .eq('project_id', projectId)
        .maybeSingle();
      
      // Calculate total area from tenants
      const totalArea = tenants?.reduce((sum, t) => sum + Number(t.area_sqm || 0), 0) || 0;
      const assignedCount = tenants?.filter(t => t.scada_import_id).length || 0;
      const tenantCount = tenants?.length || 0;
      
      // Update parameters from project data
      set({
        parameters: {
          name: project.name || '',
          location: project.location || '',
          totalAreaSqm: project.total_area_sqm || totalArea,
          capacityKva: project.connection_size_kva || 0,
          systemType: null, // Will be added when DB column exists
          clientName: '', // Will be added when DB column exists
          budgetMin: null, // Will be added when DB column exists
          budgetMax: null, // Will be added when DB column exists
          targetDate: null, // Will be added when DB column exists
        },
        isLoading: false,
        isDirty: false,
        lastSyncedAt: new Date(),
      });
      
      // Calculate workflow step statuses
      const hasTariff = !!project.tariff_id;
      const hasSimulations = (simulationCount || 0) > 0;
      const hasPVLayout = !!pvLayout?.pv_arrays && Array.isArray(pvLayout.pv_arrays) && pvLayout.pv_arrays.length > 0;
      const hasProposals = (proposalCount || 0) > 0;
      
      const updatedSteps: WorkflowStep[] = [
        { 
          id: 1, 
          key: 'resource-analysis', 
          name: 'Resource Analysis', 
          status: tenantCount > 0 ? (assignedCount === tenantCount ? 'complete' : 'partial') : 'pending' 
        },
        { 
          id: 2, 
          key: 'system-design', 
          name: 'System Design', 
          status: hasPVLayout ? 'complete' : 'pending' 
        },
        { 
          id: 3, 
          key: 'energy-config', 
          name: 'Energy Configuration', 
          status: hasTariff ? 'complete' : 'pending' 
        },
        { 
          id: 4, 
          key: 'financial-analysis', 
          name: 'Financial Analysis', 
          status: hasSimulations ? 'complete' : (hasTariff && assignedCount > 0 ? 'pending' : 'blocked') 
        },
        { 
          id: 5, 
          key: 'proposal-draft', 
          name: 'Proposal Draft', 
          status: hasProposals ? 'complete' : (hasSimulations ? 'pending' : 'blocked') 
        },
        { 
          id: 6, 
          key: 'client-review', 
          name: 'Client Review', 
          status: hasProposals ? 'partial' : 'blocked' 
        },
        { 
          id: 7, 
          key: 'approval', 
          name: 'Approval Workflow', 
          status: 'pending' 
        },
        { 
          id: 8, 
          key: 'contract', 
          name: 'Contract Generation', 
          status: 'pending' 
        },
        { 
          id: 9, 
          key: 'portal-setup', 
          name: 'Portal Setup', 
          status: 'pending' 
        },
      ];
      
      set({ workflowSteps: updatedSteps });
      
      // Calculate KPIs from latest simulation if available
      const { data: latestSimulation } = await supabase
        .from('project_simulations')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestSimulation) {
        const solarCapacity = latestSimulation.solar_capacity_kwp || 0;
        // Estimate annual yield: ~1600 kWh/kWp for South Africa
        const estimatedYield = solarCapacity * 1.6; // MWh
        // CO2 avoided: 0.95 kg CO2/kWh for SA grid
        const co2Avoided = estimatedYield * 1000 * 0.95 / 1000; // tons
        
        set({
          kpis: {
            annualYieldMwh: estimatedYield,
            savingsPerYear: latestSimulation.annual_solar_savings || 0,
            roiPercent: latestSimulation.roi_percentage || 0,
            selfCoveragePercent: 0, // Calculate from results_json if available
            co2AvoidedTons: co2Avoided,
            gridImpactPercent: 0,
          },
        });
      }
      
    } catch (error) {
      console.error('Failed to load project:', error);
      toast.error('Failed to load project data');
      set({ isLoading: false });
    }
  },
  
  // Sync to database with debouncing built into the call
  syncToDatabase: async () => {
    const { projectId, parameters, isDirty } = get();
    
    if (!projectId || !isDirty) return;
    
    set({ isSaving: true });
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: parameters.name,
          location: parameters.location,
          total_area_sqm: parameters.totalAreaSqm,
          connection_size_kva: parameters.capacityKva,
          // These columns will be added via migration:
          // system_type: parameters.systemType,
          // budget_min: parameters.budgetMin,
          // budget_max: parameters.budgetMax,
          // target_date: parameters.targetDate?.toISOString(),
        })
        .eq('id', projectId);
      
      if (error) throw error;
      
      set({ 
        isSaving: false, 
        isDirty: false,
        lastSyncedAt: new Date(),
      });
      
      toast.success('Project saved', { duration: 2000 });
      
    } catch (error) {
      console.error('Failed to save project:', error);
      toast.error('Failed to save project');
      set({ isSaving: false });
    }
  },
  
  // Internal debounced sync helper
  debouncedSync: () => {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }
    syncTimeout = setTimeout(() => {
      get().syncToDatabase();
    }, DEBOUNCE_MS);
  },
  
  // Reset store
  reset: () => set({
    projectId: null,
    isLoading: false,
    isSaving: false,
    isDirty: false,
    lastSyncedAt: null,
    parameters: { ...defaultParameters },
    workflowSteps: [...defaultWorkflowSteps],
    kpis: { ...defaultKPIs },
  }),
}));

// Selector hooks for performance
export const useProjectParameters = () => useProjectStore((state) => state.parameters);
export const useWorkflowSteps = () => useProjectStore((state) => state.workflowSteps);
export const useProjectKPIs = () => useProjectStore((state) => state.kpis);
export const useProjectLoading = () => useProjectStore((state) => state.isLoading);
export const useProjectSaving = () => useProjectStore((state) => state.isSaving);
