import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UserRoleData {
  role: "admin" | "moderator" | "user" | null;
  orgId: string | null;
  orgName: string | null;
  isAdmin: boolean;
  isLoading: boolean;
  memberId: string | null;
}

export function useUserRole(): UserRoleData {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("organization_members")
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

  return {
    role: (data?.role as "admin" | "moderator" | "user") ?? null,
    orgId: data?.org_id ?? null,
    orgName: (data?.organizations as any)?.name ?? null,
    isAdmin: data?.role === "admin",
    isLoading,
    memberId: data?.id ?? null,
  };
}
