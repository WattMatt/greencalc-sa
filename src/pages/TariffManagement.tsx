import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProvinceManager } from "@/components/tariffs/ProvinceManager";
import { MunicipalityManager } from "@/components/tariffs/MunicipalityManager";
import { TariffBuilder } from "@/components/tariffs/TariffBuilder";
import { TariffList } from "@/components/tariffs/TariffList";

export default function TariffManagement() {
  const [activeTab, setActiveTab] = useState("tariffs");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Tariff Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage provinces, municipalities, and electricity tariff structures
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="tariffs">Tariffs</TabsTrigger>
          <TabsTrigger value="builder">Tariff Builder</TabsTrigger>
          <TabsTrigger value="municipalities">Municipalities</TabsTrigger>
          <TabsTrigger value="provinces">Provinces</TabsTrigger>
        </TabsList>

        <TabsContent value="tariffs" className="space-y-4">
          <TariffList />
        </TabsContent>

        <TabsContent value="builder" className="space-y-4">
          <TariffBuilder />
        </TabsContent>

        <TabsContent value="municipalities" className="space-y-4">
          <MunicipalityManager />
        </TabsContent>

        <TabsContent value="provinces" className="space-y-4">
          <ProvinceManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
