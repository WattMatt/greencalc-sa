import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";
import { InviteUserForm } from "./InviteUserForm";
import { OrgMembersList } from "./OrgMembersList";
import { Loader2, Shield, AlertTriangle } from "lucide-react";

export function UsersSettingsCard() {
  const { orgId, isAdmin, isLoading, orgName } = useUserRole();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orgId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            No Organization
          </CardTitle>
          <CardDescription>
            You are not currently part of an organization. Contact an administrator
            to receive an invitation, or create a new organization.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Organization info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {orgName || "Organization"}
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? "You are an administrator. You can invite members and manage roles."
              : "You are a member of this organization. Contact an admin to manage users."}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Invite form (admin only) */}
      {isAdmin && <InviteUserForm orgId={orgId} />}

      {/* Members list */}
      <OrgMembersList orgId={orgId} isAdmin={isAdmin} />
    </div>
  );
}
