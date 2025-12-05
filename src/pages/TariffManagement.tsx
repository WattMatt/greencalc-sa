import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MunicipalityManager } from "@/components/tariffs/MunicipalityManager";
import { TariffBuilder } from "@/components/tariffs/TariffBuilder";
import { TariffList } from "@/components/tariffs/TariffList";
import { TOUReference } from "@/components/tariffs/TOUReference";
import { NERSAGuidelines } from "@/components/tariffs/NERSAGuidelines";
import { GoogleSheetsImport } from "@/components/tariffs/GoogleSheetsImport";
import { AISheetImport } from "@/components/tariffs/AISheetImport";
import { FileUploadImport } from "@/components/tariffs/FileUploadImport";
import { MunicipalityMap } from "@/components/tariffs/MunicipalityMap";
import { ProvinceFilesManager } from "@/components/tariffs/ProvinceFilesManager";

export default function TariffManagement() {
  const [activeTab, setActiveTab] = useState("tariffs");
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string | null>(null);
  const [selectedMunicipalityName, setSelectedMunicipalityName] = useState<string | null>(null);

  const handleMunicipalityClick = (municipalityId: string, municipalityName: string) => {
    setSelectedMunicipalityId(municipalityId);
    setSelectedMunicipalityName(municipalityName);
    setActiveTab("tariffs");
  };

  const clearMunicipalityFilter = () => {
    setSelectedMunicipalityId(null);
    setSelectedMunicipalityName(null);
  };

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
          <TabsTrigger value="provinces">Provinces</TabsTrigger>
          <TabsTrigger value="municipalities">Municipalities</TabsTrigger>
          <TabsTrigger value="builder">Tariff Builder</TabsTrigger>
          <TabsTrigger value="tou-reference">TOU Reference</TabsTrigger>
          <TabsTrigger value="nersa-guidelines">NERSA Guidelines</TabsTrigger>
        </TabsList>

        <TabsContent value="tariffs" className="space-y-4">
          <div className="flex justify-end gap-2 flex-wrap">
            <FileUploadImport />
            <GoogleSheetsImport />
            <AISheetImport />
          </div>
          <TariffList 
            filterMunicipalityId={selectedMunicipalityId}
            filterMunicipalityName={selectedMunicipalityName}
            onClearFilter={clearMunicipalityFilter}
          />
        </TabsContent>

        <TabsContent value="provinces" className="space-y-4">
          <ProvinceFilesManager />
        </TabsContent>

        <TabsContent value="municipalities" className="space-y-4">
          <MunicipalityMap onMunicipalityClick={handleMunicipalityClick} />
          <MunicipalityManager />
        </TabsContent>

        <TabsContent value="builder" className="space-y-4">
          <TariffBuilder />
        </TabsContent>

        <TabsContent value="tou-reference" className="space-y-4">
          <TOUReference />
        </TabsContent>

        <TabsContent value="nersa-guidelines" className="space-y-4">
          <NERSAGuidelines />
        </TabsContent>
      </Tabs>
    </div>
  );
}
