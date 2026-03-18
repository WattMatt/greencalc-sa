import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Users, Trash2, Loader2, Shield, Clock } from "lucide-react";

interface OrgMembersListProps {
  orgId: string;
  isAdmin: boolean;
}

interface OrgMember {
  id: string;
  user_id: string;
  role: "admin" | "moderator" | "user";
  invited_at: string;
  accepted_at: string | null;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export function OrgMembersList({ orgId, isAdmin }: OrgMembersListProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: async () => {
      // Fetch members first
      const { data: memberData, error: memberError } = await supabase
        .from("organization_members")
        .select("id, user_id, role, invited_at, accepted_at")
        .eq("org_id", orgId)
        .order("invited_at", { ascending: true });

      if (memberError) throw memberError;
      if (!memberData?.length) return [];

      // Fetch profiles separately (no FK between organization_members and profiles)
      const userIds = memberData.map((m: any) => m.user_id);
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profileMap = new Map(
        (profileData || []).map((p: any) => [p.id, { full_name: p.full_name, email: p.email }])
      );

      return memberData.map((m: any) => ({
        ...m,
        profiles: profileMap.get(m.user_id) || null,
      })) as OrgMember[];
    },
    enabled: !!orgId,
  });

  const handleRoleChange = async (memberId: string, newRole: string) => {
    setUpdatingId(memberId);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user?action=update-role", {
        body: { member_id: memberId, new_role: newRole },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    setUpdatingId(memberId);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user?action=remove", {
        body: { member_id: memberId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`${memberName} has been removed`);
      queryClient.invalidateQueries({ queryKey: ["org-members"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    } finally {
      setUpdatingId(null);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default";
      case "moderator":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Members
        </CardTitle>
        <CardDescription>
          {members?.length || 0} member{(members?.length || 0) !== 1 ? "s" : ""} in your organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !members?.length ? (
          <p className="text-muted-foreground text-center py-8">No members found</p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const isSelf = member.user_id === user?.id;
              const isPending = !member.accepted_at;
              const displayName = member.profiles?.full_name || member.profiles?.email || "Unknown";
              const displayEmail = member.profiles?.email || "";

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-medium text-primary">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{displayName}</p>
                        {isSelf && (
                          <Badge variant="outline" className="text-xs">You</Badge>
                        )}
                        {isPending && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{displayEmail}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin && !isSelf ? (
                      <>
                        <Select
                          value={member.role}
                          onValueChange={(v) => handleRoleChange(member.id, v)}
                          disabled={updatingId === member.id}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="moderator">Moderator</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              disabled={updatingId === member.id}
                            >
                              {updatingId === member.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove {displayName} from the organization?
                                They will lose access to all shared projects and data.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveMember(member.id, displayName)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    ) : (
                      <Badge variant={getRoleBadgeVariant(member.role)} className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
