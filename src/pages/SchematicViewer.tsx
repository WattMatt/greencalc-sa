import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SchematicWithProject } from "@/types/schematic";
import SchematicEditor from "@/components/schematic/SchematicEditor";

export default function SchematicViewer() {
  const { id, projectId } = useParams();
  const navigate = useNavigate();
  const [schematic, setSchematic] = useState<SchematicWithProject | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) fetchSchematic();
  }, [id]);

  const fetchSchematic = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("project_schematics")
      .select("*, projects(name)")
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Failed to load schematic");
      navigate(`/projects/${projectId}`);
      return;
    }

    setSchematic(data as SchematicWithProject);

    // Only fetch image URL if file_path exists (not a blank canvas)
    if (data.file_path) {
      if (data.file_type === "application/pdf" && data.converted_image_path) {
        const { data: imgData } = supabase.storage.from("project-schematics").getPublicUrl(data.converted_image_path);
        setImageUrl(imgData.publicUrl);
      } else {
        const { data: urlData } = supabase.storage.from("project-schematics").getPublicUrl(data.file_path);
        setImageUrl(urlData.publicUrl);
      }
    } else {
      // Clean schematic (blank canvas) - no image URL needed
      setImageUrl(null);
    }

    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!schematic) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Schematic not found</p>
        <Button variant="link" onClick={() => navigate(`/projects/${projectId}`)}>
          Back to Project
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${projectId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{schematic.name}</h1>
          <p className="text-sm text-muted-foreground">
            {schematic.projects?.name} • {schematic.description || "No description"}
          </p>
        </div>
      </div>

      {/* Schematic Editor */}
      <SchematicEditor
        schematicId={id!}
        schematicUrl={imageUrl}
        projectId={projectId!}
      />
    </div>
  );
}
