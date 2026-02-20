import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ZoomIn, ZoomOut, Maximize2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SchematicWithProject, MeterPosition } from "@/types/schematic";

export default function SchematicViewer() {
  const { id, projectId } = useParams();
  const navigate = useNavigate();
  const [schematic, setSchematic] = useState<SchematicWithProject | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [meterPositions, setMeterPositions] = useState<MeterPosition[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchSchematic();
      fetchMeterPositions();
    }
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

    // Get image URL
    if (data.file_type === "application/pdf" && data.converted_image_path) {
      const { data: imageUrlData } = supabase.storage
        .from("project-schematics")
        .getPublicUrl(data.converted_image_path);
      setImageUrl(imageUrlData.publicUrl);
    } else {
      const { data: urlData } = supabase.storage
        .from("project-schematics")
        .getPublicUrl(data.file_path);
      setImageUrl(urlData.publicUrl);
    }
    setIsLoading(false);
  };

  const fetchMeterPositions = async () => {
    const { data } = await supabase
      .from("project_schematic_meter_positions")
      .select("*")
      .eq("schematic_id", id);
    setMeterPositions(data || []);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const zoomStep = e.deltaY < 0 ? 1.1 : 0.9;
      let newZoom = zoom * zoomStep;
      newZoom = Math.min(Math.max(0.5, newZoom), 10);

      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;
        const pointX = (mouseX - pan.x) / zoom;
        const pointY = (mouseY - pan.y) / zoom;
        setPan({ x: mouseX - pointX * newZoom, y: mouseY - pointY * newZoom });
      }
      setZoom(newZoom);
    } else if (e.shiftKey) {
      setPan(prev => ({ x: prev.x - e.deltaY * 0.5, y: prev.y }));
    } else {
      setPan(prev => ({ x: prev.x, y: prev.y - e.deltaY * 0.5 }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0 || e.button === 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (containerRef.current) containerRef.current.style.cursor = 'grab';
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
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
        <div className="flex items-center gap-2">
          <Badge variant="outline">{Math.round(zoom * 100)}%</Badge>
          <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.min(z * 1.2, 10))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.max(z * 0.8, 0.5))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={resetView}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Viewer */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="relative overflow-hidden bg-muted/30"
            style={{ height: "calc(100vh - 200px)", cursor: "grab" }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
                position: "relative",
                display: "inline-block",
              }}
            >
              {imageUrl && (
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt={schematic.name}
                  onLoad={() => setImageLoaded(true)}
                  className="max-w-none"
                  draggable={false}
                  style={{ userSelect: "none" }}
                />
              )}

              {/* Meter position overlays */}
              {imageLoaded && meterPositions.map((pos) => (
                <div
                  key={pos.id}
                  className="absolute"
                  style={{
                    left: `${pos.x_position}%`,
                    top: `${pos.y_position}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div className="w-4 h-4 rounded-full bg-primary border-2 border-background shadow-lg" title={pos.label || pos.meter_id} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
