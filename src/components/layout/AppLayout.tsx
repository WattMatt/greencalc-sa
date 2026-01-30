import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { WelcomeModal } from "@/components/onboarding/WelcomeModal";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <AppSidebar />
        <SidebarInset className="flex-1 min-w-0">
          <header className="flex h-14 items-center gap-4 border-b border-border px-6 bg-card">
            <div className="flex-1" />
          </header>
          <main className="flex-1 p-4 md:p-6 bg-background overflow-x-auto">
            {children}
          </main>
        </SidebarInset>
      </div>
      <WelcomeModal />
    </SidebarProvider>
  );
}
