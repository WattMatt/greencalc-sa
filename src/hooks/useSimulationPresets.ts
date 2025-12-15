import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";
import { AdvancedSimulationConfig } from "@/components/projects/simulation/AdvancedSimulationTypes";
import type { Json } from "@/integrations/supabase/types";

interface SimulationPreset {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  config: AdvancedSimulationConfig;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface CreatePresetInput {
  name: string;
  description?: string;
  config: AdvancedSimulationConfig;
  is_default?: boolean;
}

interface UpdatePresetInput {
  id: string;
  name?: string;
  description?: string;
  config?: AdvancedSimulationConfig;
  is_default?: boolean;
}

export function useSimulationPresets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: presets = [], isLoading, error } = useQuery({
    queryKey: ["simulation-presets", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("simulation_presets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return data.map((preset) => ({
        ...preset,
        config: preset.config as unknown as AdvancedSimulationConfig,
      })) as SimulationPreset[];
    },
    enabled: !!user,
  });

  const createPreset = useMutation({
    mutationFn: async (input: CreatePresetInput) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("simulation_presets")
        .insert([{
          user_id: user.id,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          config: JSON.parse(JSON.stringify(input.config)) as Json,
          is_default: input.is_default || false,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simulation-presets"] });
      toast({
        title: "Preset saved",
        description: "Your custom preset has been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error saving preset",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePreset = useMutation({
    mutationFn: async (input: UpdatePresetInput) => {
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name.trim();
      if (input.description !== undefined) updateData.description = input.description.trim() || null;
      if (input.config !== undefined) updateData.config = JSON.parse(JSON.stringify(input.config)) as Json;
      if (input.is_default !== undefined) updateData.is_default = input.is_default;

      const { data, error } = await supabase
        .from("simulation_presets")
        .update(updateData)
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simulation-presets"] });
      toast({
        title: "Preset updated",
        description: "Your preset has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating preset",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePreset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("simulation_presets")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simulation-presets"] });
      toast({
        title: "Preset deleted",
        description: "Your preset has been deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting preset",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    presets,
    isLoading,
    error,
    createPreset,
    updatePreset,
    deletePreset,
  };
}

export type { SimulationPreset, CreatePresetInput, UpdatePresetInput };
