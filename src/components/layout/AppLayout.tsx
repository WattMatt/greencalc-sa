import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          <header className="flex h-14 items-center gap-4 border-b border-border px-6 bg-card">
            <SidebarTrigger className="shrink-0" />
            <div className="flex-1" />
          </header>
          <main className="flex-1 p-6 bg-background">
            {children}
          </main>
        </SidebarInset>
      </div>
      <WelcomeModal />
    </SidebarProvider>
  );
}
