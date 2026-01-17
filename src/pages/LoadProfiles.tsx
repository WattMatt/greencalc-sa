import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Building2, Database, FileSpreadsheet } from "lucide-react";

import { LoadProfilesDashboard } from "@/components/loadprofiles/LoadProfilesDashboard";
import { SitesTab } from "@/components/loadprofiles/SitesTab";
import { MeterLibrary } from "@/components/loadprofiles/MeterLibrary";
import { ExcelAuditReimport } from "@/components/loadprofiles/ExcelAuditReimport";

export default function LoadProfiles() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Load Profiles</h1>
        <p className="text-muted-foreground">
          Manage sites and meter data for energy analysis
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="sites" className="gap-2">
            <Building2 className="h-4 w-4" />
            Sites
          </TabsTrigger>
          <TabsTrigger value="meter-library" className="gap-2">
            <Database className="h-4 w-4" />
            Meter Library
          </TabsTrigger>
          <TabsTrigger value="excel-reimport" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Excel Audit Reimport
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <LoadProfilesDashboard 
            onNavigateToSites={() => setActiveTab("sites")}
            onNavigateToMeters={() => setActiveTab("meter-library")}
          />
        </TabsContent>

        <TabsContent value="sites">
          <SitesTab />
        </TabsContent>

        <TabsContent value="meter-library">
          <MeterLibrary />
        </TabsContent>

        <TabsContent value="excel-reimport">
          <ExcelAuditReimport 
            onImportComplete={() => setActiveTab("meter-library")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
