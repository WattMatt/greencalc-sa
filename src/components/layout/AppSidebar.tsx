import { useEffect, useState } from "react";
import { LayoutDashboard, Settings, Calculator, Database, Zap, Building2, Activity, LogOut, Sun, Moon } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "next-themes";
import { SyncStatus } from "@/components/pwa";
import { useOrganizationBranding } from "@/hooks/useOrganizationBranding";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

const referenceDataItems = [
  { title: "Tariffs", url: "/tariffs", icon: Database },
  { title: "Load Profiles", url: "/load-profiles", icon: Activity },
];

const projectItems = [
  { title: "Projects", url: "/projects", icon: Building2 },
  { title: "Calculator", url: "/calculator", icon: Calculator },
];

const otherItems = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const { branding: orgBranding } = useOrganizationBranding();
  const isCollapsed = state === "collapsed";

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('full_name, avatar_url, email')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) setProfile(data);
        });
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
  };

  const displayName = profile?.full_name || profile?.email || user?.email || 'User';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex flex-col gap-2">
          {/* Logo and company name section */}
          <div className="flex items-center gap-3">
            {orgBranding.logo_url ? (
              <img 
                src={orgBranding.logo_url} 
                alt="Company logo" 
                className={`rounded-lg object-contain shrink-0 ${isCollapsed ? "h-8 w-8" : "h-10 w-10"}`}
              />
            ) : (
              <div className={`flex items-center justify-center rounded-lg bg-primary shrink-0 ${isCollapsed ? "h-8 w-8" : "h-10 w-10"}`}>
                <Zap className={isCollapsed ? "h-4 w-4 text-primary-foreground" : "h-6 w-6 text-primary-foreground"} />
              </div>
            )}
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-semibold text-sidebar-foreground">
                  {orgBranding.company_name ? orgBranding.company_name.split(' ').slice(0, 2).join(' ') : "Green Energy"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {orgBranding.company_name ? orgBranding.company_name.split(' ').slice(2, 4).join(' ') || "Platform" : "Financial Platform"}
                </span>
              </div>
            )}
          </div>
          
          {/* Controls - below the logo/label */}
          <div className="flex items-center gap-0.5">
            {!isCollapsed && <SyncStatus />}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className={`shrink-0 ${isCollapsed ? "h-1.5 w-1.5 p-0.5" : "h-8 w-8"}`}
                >
                  {theme === "dark" ? (
                    <Sun className={isCollapsed ? "h-1 w-1" : "h-4 w-4"} />
                  ) : (
                    <Moon className={isCollapsed ? "h-1 w-1" : "h-4 w-4"} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Toggle {theme === "dark" ? "light" : "dark"} mode</p>
              </TooltipContent>
            </Tooltip>
            <SidebarTrigger className={`shrink-0 ${isCollapsed ? "h-1.5 w-1.5 p-0.5 [&>svg]:h-1 [&>svg]:w-1" : "h-8 w-8"}`} />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Dashboard">
                  <NavLink
                    to="/"
                    end
                    className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <LayoutDashboard className="h-5 w-5 shrink-0" />
                    {!isCollapsed && <span>Dashboard</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Reference Data</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {referenceDataItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Modeling</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {projectItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {otherItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <NavLink
                to="/profile"
                className="px-3 py-2 mb-2 flex items-center gap-3 rounded-md transition-colors hover:bg-sidebar-accent"
                activeClassName="bg-sidebar-accent"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-sidebar-foreground truncate">
                      {displayName}
                    </span>
                    {profile?.email && profile.full_name && (
                      <span className="text-xs text-muted-foreground truncate">
                        {profile.email}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Sign Out">
                    <Button
                      variant="ghost"
                      onClick={handleSignOut}
                      className="w-full justify-start gap-3 px-3 py-2 h-auto font-normal text-muted-foreground hover:text-foreground"
                    >
                      <LogOut className="h-5 w-5 shrink-0" />
                      {!isCollapsed && <span>Sign Out</span>}
                    </Button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
