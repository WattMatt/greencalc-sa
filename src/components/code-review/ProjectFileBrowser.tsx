import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Folder, 
  FileCode, 
  FileJson, 
  FileText,
  Search,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileNode {
  name: string;
  type: "file" | "folder";
  path?: string;
  language?: string;
  children?: FileNode[];
}

// Project file structure - matches actual codebase
export const PROJECT_FILES: FileNode[] = [
  {
    name: "src",
    type: "folder",
    children: [
      {
        name: "components",
        type: "folder",
        children: [
          {
            name: "calculator",
            type: "folder",
            children: [
              { name: "ConsumptionProfile.tsx", type: "file", path: "src/components/calculator/ConsumptionProfile.tsx", language: "typescript" },
              { name: "TariffComparison.tsx", type: "file", path: "src/components/calculator/TariffComparison.tsx", language: "typescript" },
            ]
          },
          {
            name: "code-review",
            type: "folder",
            children: [
              { name: "CodeReviewPanel.tsx", type: "file", path: "src/components/code-review/CodeReviewPanel.tsx", language: "typescript" },
              { name: "ProjectFileBrowser.tsx", type: "file", path: "src/components/code-review/ProjectFileBrowser.tsx", language: "typescript" },
            ]
          },
          {
            name: "floor-plan",
            type: "folder",
            children: [
              { name: "FloorPlanMarkup.tsx", type: "file", path: "src/components/floor-plan/FloorPlanMarkup.tsx", language: "typescript" },
              { name: "types.ts", type: "file", path: "src/components/floor-plan/types.ts", language: "typescript" },
              { name: "constants.ts", type: "file", path: "src/components/floor-plan/constants.ts", language: "typescript" },
            ]
          },
          {
            name: "layout",
            type: "folder",
            children: [
              { name: "AppLayout.tsx", type: "file", path: "src/components/layout/AppLayout.tsx", language: "typescript" },
              { name: "AppSidebar.tsx", type: "file", path: "src/components/layout/AppSidebar.tsx", language: "typescript" },
            ]
          },
          {
            name: "loadprofiles",
            type: "folder",
            children: [
              { name: "BulkCsvDropzone.tsx", type: "file", path: "src/components/loadprofiles/BulkCsvDropzone.tsx", language: "typescript" },
              { name: "CategoryMapper.tsx", type: "file", path: "src/components/loadprofiles/CategoryMapper.tsx", language: "typescript" },
              { name: "CsvImportWizard.tsx", type: "file", path: "src/components/loadprofiles/CsvImportWizard.tsx", language: "typescript" },
              { name: "LoadProfileEditor.tsx", type: "file", path: "src/components/loadprofiles/LoadProfileEditor.tsx", language: "typescript" },
              { name: "MeterLibrary.tsx", type: "file", path: "src/components/loadprofiles/MeterLibrary.tsx", language: "typescript" },
              { name: "MeterAnalysis.tsx", type: "file", path: "src/components/loadprofiles/MeterAnalysis.tsx", language: "typescript" },
              { name: "ScadaImport.tsx", type: "file", path: "src/components/loadprofiles/ScadaImport.tsx", language: "typescript" },
            ]
          },
          {
            name: "projects",
            type: "folder",
            children: [
              { name: "ProjectOverview.tsx", type: "file", path: "src/components/projects/ProjectOverview.tsx", language: "typescript" },
              { name: "SimulationPanel.tsx", type: "file", path: "src/components/projects/SimulationPanel.tsx", language: "typescript" },
              { name: "TariffSelector.tsx", type: "file", path: "src/components/projects/TariffSelector.tsx", language: "typescript" },
              { name: "TenantManager.tsx", type: "file", path: "src/components/projects/TenantManager.tsx", language: "typescript" },
              { name: "LoadProfileChart.tsx", type: "file", path: "src/components/projects/LoadProfileChart.tsx", language: "typescript" },
              { name: "PVSystemConfig.tsx", type: "file", path: "src/components/projects/PVSystemConfig.tsx", language: "typescript" },
            ]
          },
          {
            name: "proposals",
            type: "folder",
            children: [
              { name: "ProposalExport.tsx", type: "file", path: "src/components/proposals/ProposalExport.tsx", language: "typescript" },
              { name: "ProposalPreview.tsx", type: "file", path: "src/components/proposals/ProposalPreview.tsx", language: "typescript" },
              { name: "generateProposalPDF.ts", type: "file", path: "src/components/proposals/generateProposalPDF.ts", language: "typescript" },
              { name: "BrandingForm.tsx", type: "file", path: "src/components/proposals/BrandingForm.tsx", language: "typescript" },
            ]
          },
          {
            name: "tariffs",
            type: "folder",
            children: [
              { name: "TariffBuilder.tsx", type: "file", path: "src/components/tariffs/TariffBuilder.tsx", language: "typescript" },
              { name: "TariffList.tsx", type: "file", path: "src/components/tariffs/TariffList.tsx", language: "typescript" },
              { name: "EskomTariffMatrix.tsx", type: "file", path: "src/components/tariffs/EskomTariffMatrix.tsx", language: "typescript" },
              { name: "TOUPeriodBuilder.tsx", type: "file", path: "src/components/tariffs/TOUPeriodBuilder.tsx", language: "typescript" },
            ]
          },
          {
            name: "simulation",
            type: "folder",
            children: [
              { name: "AccuracyBadge.tsx", type: "file", path: "src/components/simulation/AccuracyBadge.tsx", language: "typescript" },
              { name: "ModeCard.tsx", type: "file", path: "src/components/simulation/ModeCard.tsx", language: "typescript" },
              { name: "QuickEstimateForm.tsx", type: "file", path: "src/components/simulation/QuickEstimateForm.tsx", language: "typescript" },
              { name: "QuickEstimateResults.tsx", type: "file", path: "src/components/simulation/QuickEstimateResults.tsx", language: "typescript" },
            ]
          },
          {
            name: "ui",
            type: "folder",
            children: [
              { name: "button.tsx", type: "file", path: "src/components/ui/button.tsx", language: "typescript" },
              { name: "card.tsx", type: "file", path: "src/components/ui/card.tsx", language: "typescript" },
              { name: "dialog.tsx", type: "file", path: "src/components/ui/dialog.tsx", language: "typescript" },
              { name: "form.tsx", type: "file", path: "src/components/ui/form.tsx", language: "typescript" },
              { name: "table.tsx", type: "file", path: "src/components/ui/table.tsx", language: "typescript" },
            ]
          },
        ]
      },
      {
        name: "hooks",
        type: "folder",
        children: [
          { name: "useAuth.tsx", type: "file", path: "src/hooks/useAuth.tsx", language: "typescript" },
          { name: "useProjectStore.ts", type: "file", path: "src/hooks/useProjectStore.ts", language: "typescript" },
          { name: "useSolcastForecast.ts", type: "file", path: "src/hooks/useSolcastForecast.ts", language: "typescript" },
          { name: "useTOUCalculation.ts", type: "file", path: "src/hooks/useTOUCalculation.ts", language: "typescript" },
          { name: "useSimulationPresets.ts", type: "file", path: "src/hooks/useSimulationPresets.ts", language: "typescript" },
        ]
      },
      {
        name: "pages",
        type: "folder",
        children: [
          { name: "Auth.tsx", type: "file", path: "src/pages/Auth.tsx", language: "typescript" },
          { name: "Calculator.tsx", type: "file", path: "src/pages/Calculator.tsx", language: "typescript" },
          { name: "Dashboard.tsx", type: "file", path: "src/pages/Dashboard.tsx", language: "typescript" },
          { name: "Index.tsx", type: "file", path: "src/pages/Index.tsx", language: "typescript" },
          { name: "LoadProfiles.tsx", type: "file", path: "src/pages/LoadProfiles.tsx", language: "typescript" },
          { name: "ProjectDetail.tsx", type: "file", path: "src/pages/ProjectDetail.tsx", language: "typescript" },
          { name: "Projects.tsx", type: "file", path: "src/pages/Projects.tsx", language: "typescript" },
          { name: "ProposalBuilder.tsx", type: "file", path: "src/pages/ProposalBuilder.tsx", language: "typescript" },
          { name: "Settings.tsx", type: "file", path: "src/pages/Settings.tsx", language: "typescript" },
          { name: "TariffManagement.tsx", type: "file", path: "src/pages/TariffManagement.tsx", language: "typescript" },
          { name: "CodeReview.tsx", type: "file", path: "src/pages/CodeReview.tsx", language: "typescript" },
          { name: "QuickEstimate.tsx", type: "file", path: "src/pages/QuickEstimate.tsx", language: "typescript" },
        ]
      },
      {
        name: "integrations",
        type: "folder",
        children: [
          {
            name: "supabase",
            type: "folder",
            children: [
              { name: "client.ts", type: "file", path: "src/integrations/supabase/client.ts", language: "typescript" },
              { name: "types.ts", type: "file", path: "src/integrations/supabase/types.ts", language: "typescript" },
            ]
          }
        ]
      },
      {
        name: "lib",
        type: "folder",
        children: [
          { name: "constants.ts", type: "file", path: "src/lib/constants.ts", language: "typescript" },
          { name: "indexedDB.ts", type: "file", path: "src/lib/indexedDB.ts", language: "typescript" },
          { name: "utils.ts", type: "file", path: "src/lib/utils.ts", language: "typescript" },
        ]
      },
      { name: "App.tsx", type: "file", path: "src/App.tsx", language: "typescript" },
      { name: "main.tsx", type: "file", path: "src/main.tsx", language: "typescript" },
      { name: "index.css", type: "file", path: "src/index.css", language: "css" },
    ]
  },
  {
    name: "supabase",
    type: "folder",
    children: [
      {
        name: "functions",
        type: "folder",
        children: [
          { name: "abacus-code-review/index.ts", type: "file", path: "supabase/functions/abacus-code-review/index.ts", language: "typescript" },
          { name: "ai-import-loadprofiles/index.ts", type: "file", path: "supabase/functions/ai-import-loadprofiles/index.ts", language: "typescript" },
          { name: "ai-import-sheet/index.ts", type: "file", path: "supabase/functions/ai-import-sheet/index.ts", language: "typescript" },
          
          { name: "generate-proposal-narrative/index.ts", type: "file", path: "supabase/functions/generate-proposal-narrative/index.ts", language: "typescript" },
          { name: "process-tariff-file/index.ts", type: "file", path: "supabase/functions/process-tariff-file/index.ts", language: "typescript" },
          { name: "solcast-forecast/index.ts", type: "file", path: "supabase/functions/solcast-forecast/index.ts", language: "typescript" },
          { name: "fetch-project-files/index.ts", type: "file", path: "supabase/functions/fetch-project-files/index.ts", language: "typescript" },
        ]
      },
      { name: "config.toml", type: "file", path: "supabase/config.toml", language: "toml" },
    ]
  },
];

interface ProjectFileBrowserProps {
  selectedFiles: string[];
  onSelectionChange: (files: string[]) => void;
}

function getFileIcon(name: string, language?: string) {
  if (language === "typescript" || name.endsWith(".ts") || name.endsWith(".tsx")) {
    return <FileCode className="h-4 w-4 text-blue-500" />;
  }
  if (language === "json" || name.endsWith(".json")) {
    return <FileJson className="h-4 w-4 text-yellow-500" />;
  }
  if (language === "css" || name.endsWith(".css")) {
    return <FileText className="h-4 w-4 text-purple-500" />;
  }
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

export function getAllFilePaths(nodes: FileNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === "file" && node.path) {
      paths.push(node.path);
    }
    if (node.children) {
      paths.push(...getAllFilePaths(node.children));
    }
  }
  return paths;
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  selectedFiles: string[];
  onToggle: (path: string) => void;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  searchQuery: string;
}

function FileTreeNode({ 
  node, 
  depth, 
  selectedFiles, 
  onToggle, 
  expandedFolders,
  toggleFolder,
  searchQuery
}: FileTreeNodeProps) {
  const folderPath = node.path || node.name;
  const isExpanded = expandedFolders.has(folderPath);

  if (node.type === "folder") {
    const allChildPaths = getAllFilePaths(node.children || []);
    const hasMatchingChildren = searchQuery 
      ? allChildPaths.some(p => p.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;

    if (!hasMatchingChildren && searchQuery) return null;

    const selectedCount = allChildPaths.filter(p => selectedFiles.includes(p)).length;

    return (
      <div>
        <button
          onClick={() => toggleFolder(folderPath)}
          className={cn(
            "w-full flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted text-sm",
            "transition-colors"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Folder className="h-4 w-4 text-primary" />
          <span className="flex-1 text-left">{node.name}</span>
          {selectedCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selectedCount}
            </Badge>
          )}
        </button>
        {isExpanded && node.children?.map((child, idx) => (
          <FileTreeNode
            key={child.name + idx}
            node={child}
            depth={depth + 1}
            selectedFiles={selectedFiles}
            onToggle={onToggle}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            searchQuery={searchQuery}
          />
        ))}
      </div>
    );
  }

  if (searchQuery && !node.path?.toLowerCase().includes(searchQuery.toLowerCase())) {
    return null;
  }

  const isSelected = node.path ? selectedFiles.includes(node.path) : false;

  return (
    <label
      className={cn(
        "flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer text-sm",
        "transition-colors",
        isSelected && "bg-primary/10"
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => node.path && onToggle(node.path)}
      />
      {getFileIcon(node.name, node.language)}
      <span className="flex-1 truncate">{node.name}</span>
    </label>
  );
}

export function ProjectFileBrowser({ selectedFiles, onSelectionChange }: ProjectFileBrowserProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["src", "src/components", "src/pages", "src/hooks"]));
  const [searchQuery, setSearchQuery] = useState("");

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleFile = (path: string) => {
    if (selectedFiles.includes(path)) {
      onSelectionChange(selectedFiles.filter(p => p !== path));
    } else {
      onSelectionChange([...selectedFiles, path]);
    }
  };

  const allPaths = useMemo(() => getAllFilePaths(PROJECT_FILES), []);

  const selectAll = () => {
    onSelectionChange(allPaths);
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  return (
    <div className="border rounded-lg">
      <div className="p-3 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={clearSelection}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
            <button
              onClick={selectAll}
              className="text-xs text-primary hover:underline"
            >
              Select All
            </button>
          </div>
        </div>
      </div>
      <ScrollArea className="h-[350px]">
        <div className="p-2">
          {PROJECT_FILES.map((node, idx) => (
            <FileTreeNode
              key={node.name + idx}
              node={node}
              depth={0}
              selectedFiles={selectedFiles}
              onToggle={toggleFile}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
