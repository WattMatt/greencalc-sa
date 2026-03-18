import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  full_name: string;
  role: "admin" | "moderator" | "user";
}

interface UpdateRoleRequest {
  member_id: string;
  new_role: "admin" | "moderator" | "user";
}

interface RemoveMemberRequest {
  member_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    // Get the calling user's JWT from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client (service role) for privileged operations
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create user client to get the caller's identity
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is an admin in their org
    const { data: callerMembership, error: memberError } = await supabaseAdmin
      .from("organization_members")
      .select("org_id, role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .single();

    if (memberError || !callerMembership) {
      return new Response(
        JSON.stringify({ error: "Only organization admins can manage users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = callerMembership.org_id;

    // Parse URL to determine action
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "invite";

    if (action === "invite") {
      return await handleInvite(req, supabaseAdmin, caller.id, orgId);
    } else if (action === "update-role") {
      return await handleUpdateRole(req, supabaseAdmin, caller.id, orgId);
    } else if (action === "remove") {
      return await handleRemoveMember(req, supabaseAdmin, caller.id, orgId);
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error in invite-user:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleInvite(
  req: Request,
  supabaseAdmin: any,
  callerId: string,
  orgId: string
) {
  const { email, full_name, role } = await req.json() as InviteRequest;

  if (!email || !full_name || !role) {
    return new Response(
      JSON.stringify({ error: "email, full_name, and role are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check if user already exists in this org
  const { data: existingMember } = await supabaseAdmin
    .from("organization_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", (
      await supabaseAdmin.rpc("get_user_id_by_email", { _email: email })
    ).data)
    .maybeSingle();

  // Check by email in auth.users via admin API
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u: any) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    // Check if already a member
    const { data: memberCheck } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("org_id", orgId)
      .eq("user_id", existingUser.id)
      .maybeSingle();

    if (memberCheck) {
      return new Response(
        JSON.stringify({ error: "This user is already a member of your organization" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  // Send invitation email via Supabase Auth
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name,
      org_id: orgId,
      invited_role: role,
    },
    redirectTo: `${req.headers.get("origin") || "https://wm-solar.vercel.app"}/accept-invite`,
  });

  if (inviteError) {
    console.error("Invite error:", inviteError);
    return new Response(
      JSON.stringify({ error: inviteError.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const invitedUserId = inviteData.user?.id;
  if (!invitedUserId) {
    return new Response(
      JSON.stringify({ error: "Failed to create invitation" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create pending organization_members row
  const { error: memberInsertError } = await supabaseAdmin
    .from("organization_members")
    .upsert({
      org_id: orgId,
      user_id: invitedUserId,
      role: role,
      invited_by: callerId,
      invited_at: new Date().toISOString(),
      accepted_at: null,
    }, { onConflict: "org_id,user_id" });

  if (memberInsertError) {
    console.error("Member insert error:", memberInsertError);
  }

  // Create/update profile
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({
      id: invitedUserId,
      full_name,
      email,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

  if (profileError) {
    console.error("Profile upsert error:", profileError);
  }

  return new Response(
    JSON.stringify({ success: true, message: `Invitation sent to ${email}` }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleUpdateRole(
  req: Request,
  supabaseAdmin: any,
  callerId: string,
  orgId: string
) {
  const { member_id, new_role } = await req.json() as UpdateRoleRequest;

  if (!member_id || !new_role) {
    return new Response(
      JSON.stringify({ error: "member_id and new_role are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get the member to verify they're in the same org
  const { data: member, error: memberError } = await supabaseAdmin
    .from("organization_members")
    .select("id, user_id, org_id, role")
    .eq("id", member_id)
    .eq("org_id", orgId)
    .single();

  if (memberError || !member) {
    return new Response(
      JSON.stringify({ error: "Member not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Prevent self-demotion
  if (member.user_id === callerId && new_role !== "admin") {
    return new Response(
      JSON.stringify({ error: "You cannot change your own role" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("organization_members")
    .update({ role: new_role })
    .eq("id", member_id);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: updateError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Role updated" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleRemoveMember(
  req: Request,
  supabaseAdmin: any,
  callerId: string,
  orgId: string
) {
  const { member_id } = await req.json() as RemoveMemberRequest;

  if (!member_id) {
    return new Response(
      JSON.stringify({ error: "member_id is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get the member
  const { data: member, error: memberError } = await supabaseAdmin
    .from("organization_members")
    .select("id, user_id, org_id")
    .eq("id", member_id)
    .eq("org_id", orgId)
    .single();

  if (memberError || !member) {
    return new Response(
      JSON.stringify({ error: "Member not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Prevent self-removal
  if (member.user_id === callerId) {
    return new Response(
      JSON.stringify({ error: "You cannot remove yourself from the organization" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("organization_members")
    .delete()
    .eq("id", member_id);

  if (deleteError) {
    return new Response(
      JSON.stringify({ error: deleteError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Member removed" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
