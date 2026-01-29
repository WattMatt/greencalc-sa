import { useState, useEffect } from 'react';
import { AlertCircle, Check, ChevronDown, Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SimulationOption {
  id: string;
  name: string;
  solar_capacity_kwp: number | null;
  created_at: string;
  results_json: any;
}

interface SimulationSelectorProps {
  projectId: string;
  layoutId: string | null;
  currentSimulationId: string | null;
  onSimulationChange: (simulationId: string | null, simulation: SimulationOption | null) => void;
  readOnly?: boolean;
}

export function SimulationSelector({
  projectId,
  layoutId,
  currentSimulationId,
  onSimulationChange,
  readOnly = false,
}: SimulationSelectorProps) {
  const [simulations, setSimulations] = useState<SimulationOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all simulations for this project
  useEffect(() => {
    const fetchSimulations = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('project_simulations')
          .select('id, name, solar_capacity_kwp, created_at, results_json')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setSimulations(data || []);
      } catch (error) {
        console.error('Error fetching simulations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId) {
      fetchSimulations();
    }
  }, [projectId]);

  const currentSimulation = simulations.find(s => s.id === currentSimulationId);

  const handleSelect = (simulation: SimulationOption | null) => {
    onSimulationChange(simulation?.id || null, simulation);
    if (simulation) {
      toast.success(`Linked to "${simulation.name}"`);
    } else {
      toast.info('Simulation unlinked');
    }
  };

  if (isLoading) {
    return (
      <Badge variant="outline" className="text-xs">
        Loading...
      </Badge>
    );
  }

  if (simulations.length === 0) {
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        <AlertCircle className="h-3 w-3" />
        No simulations
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={readOnly}>
        <Button
          variant={currentSimulationId ? "secondary" : "outline"}
          size="sm"
          className="h-7 text-xs gap-1"
        >
          {currentSimulationId ? (
            <>
              <Link2 className="h-3 w-3" />
              {currentSimulation?.name || 'Linked'}
              <ChevronDown className="h-3 w-3" />
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3 text-amber-500" />
              No simulation linked
              <ChevronDown className="h-3 w-3" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {simulations.map(sim => {
          const moduleCount = sim.results_json?.moduleCount ?? '?';
          const inverterCount = sim.results_json?.inverterCount ?? '?';
          const isSelected = sim.id === currentSimulationId;
          
          return (
            <DropdownMenuItem
              key={sim.id}
              onClick={() => handleSelect(sim)}
              className="flex items-center justify-between"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{sim.name}</span>
                <span className="text-xs text-muted-foreground">
                  {sim.solar_capacity_kwp ?? 0} kWp • {moduleCount} modules • {inverterCount} inv
                </span>
              </div>
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
        {currentSimulationId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleSelect(null)}
              className="text-muted-foreground"
            >
              <Unlink className="h-4 w-4 mr-2" />
              Unlink simulation
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
