/**
 * Shared types for schematic-related components
 */

export interface Schematic {
  id: string;
  name: string;
  description: string | null;
  file_path: string | null;
  file_type: string | null;
  page_number: number;
  total_pages: number;
  created_at: string;
  converted_image_path: string | null;
  project_id?: string;
}

export interface SchematicWithProject extends Schematic {
  project_id: string;
  projects: {
    name: string;
  } | null;
}

export interface MeterPosition {
  id: string;
  meter_id: string;
  x_position: number;
  y_position: number;
  label: string | null;
  scale_x?: number;
  scale_y?: number;
}

export interface ExtractedMeterData {
  meter_number: string;
  name: string;
  area: string | null;
  rating: string;
  cable_specification: string;
  serial_number: string;
  ct_type: string;
  meter_type: string;
  location?: string;
  tariff?: string;
  status?: 'pending' | 'approved' | 'rejected';
  position?: { x: number; y: number };
  scale_x?: number;
  scale_y?: number;
  isDragging?: boolean;
}

export interface EditableMeterFields {
  meter_number: string;
  name: string;
  area: string;
  rating: string;
  cable_specification: string;
  serial_number: string;
  ct_type: string;
}

export function getFileTypeIcon(type: string): string {
  if (type === "application/pdf") return "📄";
  if (type.startsWith("image/")) return "🖼️";
  return "📋";
}
