import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UserRoleData {
  role: "admin" | "moderator" | "user" | null;
  orgId: string | null;
  orgName: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  memberId: string | null;
  createOrganization: (name: string) => Promise<{ orgId: string } | null>;
}

export function useUserRole(): UserRoleData {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await (supabase
        .from("organization_members" as any) as any)
        .select(`
          id,
          org_id,
          role,
          organizations ( name )
        `)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
        return null;
      }

      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const createOrganization = async (name: string) => {
    if (!user?.id) return null;

    try {
      // Create the organization
      const { data: org, error: orgError } = await (supabase
        .from("organizations" as any) as any)
        .insert({ name, created_by: user.id })
        .select("id")
        .single();

      if (orgError) throw orgError;

      // Add the creator as admin member
      const { error: memberError } = await (supabase
        .from("organization_members" as any) as any)
        .insert({
          org_id: org.id,
          user_id: user.id,
          role: "admin",
          accepted_at: new Date().toISOString(),
        });

      if (memberError) throw memberError;

      // Also add the admin role to user_roles if not present
      await supabase
        .from("user_roles")
        .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });

      // Refresh the query
      queryClient.invalidateQueries({ queryKey: ["user-role"] });

      return { orgId: org.id };
    } catch (err) {
      console.error("Error creating organization:", err);
      return null;
    }
  };

  return {
    role: (data?.role as "admin" | "moderator" | "user") ?? null,
    orgId: data?.org_id ?? null,
    orgName: (data?.organizations as any)?.name ?? null,
    isAdmin: data?.role === "admin",
    isLoading,
    memberId: data?.id ?? null,
    createOrganization,
  };
}
