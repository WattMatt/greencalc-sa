import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Undo2,
  Redo2,
  Save,
  Upload,
  Plus,
  Play,
  FileText,
} from "lucide-react";

interface SandboxToolbarProps {
  sandboxName: string;
  canUndo: boolean;
  canRedo: boolean;
  scenarioCount: number;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onAddScenario: () => void;
  onRunSimulation: () => void;
  onGenerateReport: () => void;
  onPromoteToProject: () => void;
  isSaving: boolean;
  isRunning: boolean;
}

export function SandboxToolbar({
  sandboxName,
  canUndo,
  canRedo,
  scenarioCount,
  onUndo,
  onRedo,
  onSave,
  onAddScenario,
  onRunSimulation,
  onGenerateReport,
  onPromoteToProject,
  isSaving,
  isRunning,
}: SandboxToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-dashed pb-4">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold">{sandboxName}</h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-dashed bg-amber-500/10 text-amber-700 border-amber-500/30">
              DRAFT
            </Badge>
            <span className="text-xs text-muted-foreground">
              {scenarioCount} scenario{scenarioCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo}>
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Add Scenario */}
        <Button
          variant="outline"
          size="sm"
          onClick={onAddScenario}
          disabled={scenarioCount >= 3}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Scenario
        </Button>

        {/* Run Simulation */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRunSimulation}
          disabled={isRunning}
        >
          <Play className="h-4 w-4 mr-1" />
          {isRunning ? "Running..." : "Calculate"}
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Save Draft */}
        <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-1" />
          {isSaving ? "Saving..." : "Save Draft"}
        </Button>

        {/* Generate Report */}
        <Button variant="outline" size="sm" onClick={onGenerateReport}>
          <FileText className="h-4 w-4 mr-1" />
          Report
        </Button>

        {/* Promote to Project */}
        <Button size="sm" onClick={onPromoteToProject}>
          <Upload className="h-4 w-4 mr-1" />
          Promote
        </Button>
      </div>
    </div>
  );
}
