export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      checklist_document_links: {
        Row: {
          checklist_item_id: string
          created_at: string
          document_id: string
          id: string
        }
        Insert: {
          checklist_item_id: string
          created_at?: string
          document_id: string
          id?: string
        }
        Update: {
          checklist_item_id?: string
          created_at?: string
          document_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_document_links_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "handover_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_document_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "project_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      checklist_templates: {
        Row: {
          category: string
          created_at: string
          group_id: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          category?: string
          created_at?: string
          group_id: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          group_id?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      downtime_comments: {
        Row: {
          comment: string
          created_at: string
          day: number
          id: string
          month: number
          project_id: string
          year: number
        }
        Insert: {
          comment?: string
          created_at?: string
          day: number
          id?: string
          month: number
          project_id: string
          year: number
        }
        Update: {
          comment?: string
          created_at?: string
          day?: number
          id?: string
          month?: number
          project_id?: string
          year?: number
        }
        Relationships: []
      }
      downtime_slot_overrides: {
        Row: {
          created_at: string
          day: number
          id: string
          month: number
          project_id: string
          reading_source: string
          slot_override: number
          year: number
        }
        Insert: {
          created_at?: string
          day: number
          id?: string
          month: number
          project_id: string
          reading_source: string
          slot_override: number
          year: number
        }
        Update: {
          created_at?: string
          day?: number
          id?: string
          month?: number
          project_id?: string
          reading_source?: string
          slot_override?: number
          year?: number
        }
        Relationships: []
      }
      eskom_batch_status: {
        Row: {
          batch_index: number
          batch_name: string
          created_at: string
          id: string
          municipality_id: string
          status: string
          tariffs_extracted: number | null
          updated_at: string
        }
        Insert: {
          batch_index: number
          batch_name: string
          created_at?: string
          id?: string
          municipality_id: string
          status?: string
          tariffs_extracted?: number | null
          updated_at?: string
        }
        Update: {
          batch_index?: number
          batch_name?: string
          created_at?: string
          id?: string
          municipality_id?: string
          status?: string
          tariffs_extracted?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eskom_batch_status_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_runs: {
        Row: {
          ai_analysis: string | null
          ai_confidence: number | null
          completed_at: string | null
          corrections_made: number | null
          created_at: string
          id: string
          municipality_id: string
          run_type: string
          source_file_name: string | null
          source_file_path: string | null
          status: string
          tariffs_found: number | null
          tariffs_inserted: number | null
          tariffs_skipped: number | null
          tariffs_updated: number | null
        }
        Insert: {
          ai_analysis?: string | null
          ai_confidence?: number | null
          completed_at?: string | null
          corrections_made?: number | null
          created_at?: string
          id?: string
          municipality_id: string
          run_type?: string
          source_file_name?: string | null
          source_file_path?: string | null
          status?: string
          tariffs_found?: number | null
          tariffs_inserted?: number | null
          tariffs_skipped?: number | null
          tariffs_updated?: number | null
        }
        Update: {
          ai_analysis?: string | null
          ai_confidence?: number | null
          completed_at?: string | null
          corrections_made?: number | null
          created_at?: string
          id?: string
          municipality_id?: string
          run_type?: string
          source_file_name?: string | null
          source_file_path?: string | null
          status?: string
          tariffs_found?: number | null
          tariffs_inserted?: number | null
          tariffs_skipped?: number | null
          tariffs_updated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "extraction_runs_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      gantt_baseline_tasks: {
        Row: {
          baseline_id: string
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          task_id: string
        }
        Insert: {
          baseline_id: string
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          task_id: string
        }
        Update: {
          baseline_id?: string
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gantt_baseline_tasks_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "gantt_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gantt_baseline_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "gantt_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      gantt_baselines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gantt_baselines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gantt_milestones: {
        Row: {
          color: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          date: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gantt_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gantt_task_dependencies: {
        Row: {
          created_at: string
          dependency_type: Database["public"]["Enums"]["gantt_dependency_type"]
          id: string
          predecessor_id: string
          successor_id: string
        }
        Insert: {
          created_at?: string
          dependency_type?: Database["public"]["Enums"]["gantt_dependency_type"]
          id?: string
          predecessor_id: string
          successor_id: string
        }
        Update: {
          created_at?: string
          dependency_type?: Database["public"]["Enums"]["gantt_dependency_type"]
          id?: string
          predecessor_id?: string
          successor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gantt_task_dependencies_predecessor_id_fkey"
            columns: ["predecessor_id"]
            isOneToOne: false
            referencedRelation: "gantt_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gantt_task_dependencies_successor_id_fkey"
            columns: ["successor_id"]
            isOneToOne: false
            referencedRelation: "gantt_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      gantt_task_segments: {
        Row: {
          created_at: string
          end_date: string
          id: string
          start_date: string
          task_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          start_date: string
          task_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          start_date?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gantt_task_segments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "gantt_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      gantt_tasks: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          end_date: string
          id: string
          name: string
          owner: string | null
          progress: number
          project_id: string
          sort_order: number
          start_date: string
          status: Database["public"]["Enums"]["gantt_task_status"]
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          name: string
          owner?: string | null
          progress?: number
          project_id: string
          sort_order?: number
          start_date: string
          status?: Database["public"]["Enums"]["gantt_task_status"]
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          owner?: string | null
          progress?: number
          project_id?: string
          sort_order?: number
          start_date?: string
          status?: Database["public"]["Enums"]["gantt_task_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gantt_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_daily_records: {
        Row: {
          actual_kwh: number | null
          building_load_kwh: number | null
          created_at: string
          date: string
          id: string
          month: number
          project_id: string
          source: string | null
          year: number
        }
        Insert: {
          actual_kwh?: number | null
          building_load_kwh?: number | null
          created_at?: string
          date: string
          id?: string
          month: number
          project_id: string
          source?: string | null
          year: number
        }
        Update: {
          actual_kwh?: number | null
          building_load_kwh?: number | null
          created_at?: string
          date?: string
          id?: string
          month?: number
          project_id?: string
          source?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "generation_daily_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_readings: {
        Row: {
          actual_kwh: number | null
          building_load_kwh: number | null
          created_at: string
          id: string
          project_id: string
          source: string | null
          timestamp: string
        }
        Insert: {
          actual_kwh?: number | null
          building_load_kwh?: number | null
          created_at?: string
          id?: string
          project_id: string
          source?: string | null
          timestamp: string
        }
        Update: {
          actual_kwh?: number | null
          building_load_kwh?: number | null
          created_at?: string
          id?: string
          project_id?: string
          source?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_readings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_records: {
        Row: {
          actual_kwh: number | null
          building_load_kwh: number | null
          created_at: string
          expected_kwh: number | null
          guaranteed_kwh: number | null
          id: string
          month: number
          project_id: string
          source: string | null
          updated_at: string
          year: number
        }
        Insert: {
          actual_kwh?: number | null
          building_load_kwh?: number | null
          created_at?: string
          expected_kwh?: number | null
          guaranteed_kwh?: number | null
          id?: string
          month: number
          project_id: string
          source?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          actual_kwh?: number | null
          building_load_kwh?: number | null
          created_at?: string
          expected_kwh?: number | null
          guaranteed_kwh?: number | null
          id?: string
          month?: number
          project_id?: string
          source?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "generation_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_source_guarantees: {
        Row: {
          created_at: string
          guaranteed_kwh: number
          id: string
          meter_type: string
          month: number
          project_id: string
          reading_source: string | null
          source_label: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          guaranteed_kwh?: number
          id?: string
          meter_type?: string
          month: number
          project_id: string
          reading_source?: string | null
          source_label: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          guaranteed_kwh?: number
          id?: string
          meter_type?: string
          month?: number
          project_id?: string
          reading_source?: string | null
          source_label?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "generation_source_guarantees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      handover_checklist_items: {
        Row: {
          created_at: string
          id: string
          label: string
          project_id: string
          sort_order: number
          template_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          project_id: string
          sort_order?: number
          template_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          project_id?: string
          sort_order?: number
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "handover_checklist_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handover_checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      municipalities: {
        Row: {
          created_at: string
          financial_year: string | null
          id: string
          name: string
          nersa_increase_pct: number | null
          province_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          financial_year?: string | null
          id?: string
          name: string
          nersa_increase_pct?: number | null
          province_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          financial_year?: string | null
          id?: string
          name?: string
          nersa_increase_pct?: number | null
          province_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipalities_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_branding: {
        Row: {
          address: string | null
          company_name: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_document_folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          project_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          project_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_document_folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          created_at: string
          file_path: string | null
          file_size: number | null
          folder_id: string | null
          id: string
          mime_type: string | null
          name: string
          project_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          file_size?: number | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name: string
          project_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_path?: string | null
          file_size?: number | null
          folder_id?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          project_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "project_document_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_meter_connections: {
        Row: {
          child_meter_id: string
          created_at: string
          id: string
          parent_meter_id: string
          project_id: string
        }
        Insert: {
          child_meter_id: string
          created_at?: string
          id?: string
          parent_meter_id: string
          project_id: string
        }
        Update: {
          child_meter_id?: string
          created_at?: string
          id?: string
          parent_meter_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_meter_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_schematic_lines: {
        Row: {
          color: string | null
          created_at: string
          from_x: number
          from_y: number
          id: string
          line_type: string
          metadata: Json | null
          schematic_id: string
          stroke_width: number | null
          to_x: number
          to_y: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          from_x?: number
          from_y?: number
          id?: string
          line_type?: string
          metadata?: Json | null
          schematic_id: string
          stroke_width?: number | null
          to_x?: number
          to_y?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          from_x?: number
          from_y?: number
          id?: string
          line_type?: string
          metadata?: Json | null
          schematic_id?: string
          stroke_width?: number | null
          to_x?: number
          to_y?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_schematic_lines_schematic_id_fkey"
            columns: ["schematic_id"]
            isOneToOne: false
            referencedRelation: "project_schematics"
            referencedColumns: ["id"]
          },
        ]
      }
      project_schematic_meter_positions: {
        Row: {
          created_at: string
          id: string
          label: string | null
          meter_id: string
          scale_x: number | null
          scale_y: number | null
          schematic_id: string
          updated_at: string
          x_position: number
          y_position: number
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          meter_id: string
          scale_x?: number | null
          scale_y?: number | null
          schematic_id: string
          updated_at?: string
          x_position?: number
          y_position?: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          meter_id?: string
          scale_x?: number | null
          scale_y?: number | null
          schematic_id?: string
          updated_at?: string
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_schematic_meter_positions_schematic_id_fkey"
            columns: ["schematic_id"]
            isOneToOne: false
            referencedRelation: "project_schematics"
            referencedColumns: ["id"]
          },
        ]
      }
      project_schematics: {
        Row: {
          converted_image_path: string | null
          created_at: string
          description: string | null
          file_path: string | null
          file_type: string | null
          id: string
          name: string
          page_number: number
          project_id: string
          total_pages: number
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          converted_image_path?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          name: string
          page_number?: number
          project_id: string
          total_pages?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          converted_image_path?: string | null
          created_at?: string
          description?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          name?: string
          page_number?: number
          project_id?: string
          total_pages?: number
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_schematics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_simulations: {
        Row: {
          annual_battery_savings: number | null
          annual_grid_cost: number | null
          annual_solar_savings: number | null
          battery_capacity_kwh: number | null
          battery_power_kw: number | null
          created_at: string
          id: string
          name: string
          payback_years: number | null
          project_id: string
          results_json: Json | null
          roi_percentage: number | null
          simulation_type: string
          solar_capacity_kwp: number | null
          solar_orientation: string | null
          solar_tilt_degrees: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          annual_battery_savings?: number | null
          annual_grid_cost?: number | null
          annual_solar_savings?: number | null
          battery_capacity_kwh?: number | null
          battery_power_kw?: number | null
          created_at?: string
          id?: string
          name: string
          payback_years?: number | null
          project_id: string
          results_json?: Json | null
          roi_percentage?: number | null
          simulation_type?: string
          solar_capacity_kwp?: number | null
          solar_orientation?: string | null
          solar_tilt_degrees?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          annual_battery_savings?: number | null
          annual_grid_cost?: number | null
          annual_solar_savings?: number | null
          battery_capacity_kwh?: number | null
          battery_power_kw?: number | null
          created_at?: string
          id?: string
          name?: string
          payback_years?: number | null
          project_id?: string
          results_json?: Json | null
          roi_percentage?: number | null
          simulation_type?: string
          solar_capacity_kwp?: number | null
          solar_orientation?: string | null
          solar_tilt_degrees?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_simulations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_solar_data: {
        Row: {
          created_at: string
          data_json: Json
          data_type: string
          fetched_at: string
          id: string
          latitude: number
          longitude: number
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_json: Json
          data_type: string
          fetched_at?: string
          id?: string
          latitude: number
          longitude: number
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_json?: Json
          data_type?: string
          fetched_at?: string
          id?: string
          latitude?: number
          longitude?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_solar_data_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tenant_meters: {
        Row: {
          created_at: string
          id: string
          scada_import_id: string
          tenant_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          scada_import_id: string
          tenant_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          scada_import_id?: string
          tenant_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_tenant_meters_scada_import_id_fkey"
            columns: ["scada_import_id"]
            isOneToOne: false
            referencedRelation: "scada_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tenant_meters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "project_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tenants: {
        Row: {
          area_sqm: number
          cb_rating: string | null
          created_at: string
          id: string
          include_in_load_profile: boolean
          is_virtual: boolean
          monthly_kwh_override: number | null
          name: string
          project_id: string
          scada_import_id: string | null
          shop_name: string | null
          shop_number: string | null
          shop_type_id: string | null
          updated_at: string
        }
        Insert: {
          area_sqm: number
          cb_rating?: string | null
          created_at?: string
          id?: string
          include_in_load_profile?: boolean
          is_virtual?: boolean
          monthly_kwh_override?: number | null
          name: string
          project_id: string
          scada_import_id?: string | null
          shop_name?: string | null
          shop_number?: string | null
          shop_type_id?: string | null
          updated_at?: string
        }
        Update: {
          area_sqm?: number
          cb_rating?: string | null
          created_at?: string
          id?: string
          include_in_load_profile?: boolean
          is_virtual?: boolean
          monthly_kwh_override?: number | null
          name?: string
          project_id?: string
          scada_import_id?: string | null
          shop_name?: string | null
          shop_number?: string | null
          shop_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tenants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tenants_scada_import_id_fkey"
            columns: ["scada_import_id"]
            isOneToOne: false
            referencedRelation: "scada_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tenants_shop_type_id_fkey"
            columns: ["shop_type_id"]
            isOneToOne: false
            referencedRelation: "shop_types"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number | null
          client_name: string | null
          connection_size_kva: number | null
          created_at: string
          description: string | null
          id: string
          latitude: number | null
          location: string | null
          logo_url: string | null
          longitude: number | null
          name: string
          system_type: string | null
          target_date: string | null
          tariff_id: string | null
          total_area_sqm: number | null
          updated_at: string
        }
        Insert: {
          budget?: number | null
          client_name?: string | null
          connection_size_kva?: number | null
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          system_type?: string | null
          target_date?: string | null
          tariff_id?: string | null
          total_area_sqm?: number | null
          updated_at?: string
        }
        Update: {
          budget?: number | null
          client_name?: string | null
          connection_size_kva?: number | null
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          system_type?: string | null
          target_date?: string | null
          tariff_id?: string | null
          total_area_sqm?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariff_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assumptions: string | null
          branding: Json | null
          client_signature: string | null
          client_signed_at: string | null
          content_blocks: Json | null
          created_at: string
          custom_notes: string | null
          disclaimers: string | null
          document_type: string
          executive_summary: string | null
          id: string
          prepared_at: string | null
          prepared_by: string | null
          project_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          sandbox_id: string | null
          section_overrides: Json | null
          share_token: string | null
          simulation_id: string | null
          simulation_snapshot: Json | null
          status: string
          updated_at: string
          verification_checklist: Json
          verification_completed_at: string | null
          verification_completed_by: string | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assumptions?: string | null
          branding?: Json | null
          client_signature?: string | null
          client_signed_at?: string | null
          content_blocks?: Json | null
          created_at?: string
          custom_notes?: string | null
          disclaimers?: string | null
          document_type?: string
          executive_summary?: string | null
          id?: string
          prepared_at?: string | null
          prepared_by?: string | null
          project_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sandbox_id?: string | null
          section_overrides?: Json | null
          share_token?: string | null
          simulation_id?: string | null
          simulation_snapshot?: Json | null
          status?: string
          updated_at?: string
          verification_checklist?: Json
          verification_completed_at?: string | null
          verification_completed_by?: string | null
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assumptions?: string | null
          branding?: Json | null
          client_signature?: string | null
          client_signed_at?: string | null
          content_blocks?: Json | null
          created_at?: string
          custom_notes?: string | null
          disclaimers?: string | null
          document_type?: string
          executive_summary?: string | null
          id?: string
          prepared_at?: string | null
          prepared_by?: string | null
          project_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sandbox_id?: string | null
          section_overrides?: Json | null
          share_token?: string | null
          simulation_id?: string | null
          simulation_snapshot?: Json | null
          status?: string
          updated_at?: string
          verification_checklist?: Json
          verification_completed_at?: string | null
          verification_completed_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_sandbox_id_fkey"
            columns: ["sandbox_id"]
            isOneToOne: false
            referencedRelation: "sandbox_simulations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "project_simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      provinces: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pv_layout_folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          project_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          project_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pv_layout_folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pv_layouts: {
        Row: {
          cables: Json | null
          created_at: string
          equipment: Json | null
          folder_id: string | null
          id: string
          name: string
          pdf_data: string | null
          plant_setup: Json | null
          project_id: string
          pv_arrays: Json | null
          pv_config: Json | null
          roof_masks: Json | null
          scale_pixels_per_meter: number | null
          simulation_id: string | null
          updated_at: string
        }
        Insert: {
          cables?: Json | null
          created_at?: string
          equipment?: Json | null
          folder_id?: string | null
          id?: string
          name?: string
          pdf_data?: string | null
          plant_setup?: Json | null
          project_id: string
          pv_arrays?: Json | null
          pv_config?: Json | null
          roof_masks?: Json | null
          scale_pixels_per_meter?: number | null
          simulation_id?: string | null
          updated_at?: string
        }
        Update: {
          cables?: Json | null
          created_at?: string
          equipment?: Json | null
          folder_id?: string | null
          id?: string
          name?: string
          pdf_data?: string | null
          plant_setup?: Json | null
          project_id?: string
          pv_arrays?: Json | null
          pv_config?: Json | null
          roof_masks?: Json | null
          scale_pixels_per_meter?: number | null
          simulation_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pv_layouts_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "pv_layout_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_layouts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_layouts_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "project_simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_analytics: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          report_config_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          report_config_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          report_config_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_analytics_report_config_id_fkey"
            columns: ["report_config_id"]
            isOneToOne: false
            referencedRelation: "report_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      report_configs: {
        Row: {
          branding: Json | null
          created_at: string
          id: string
          name: string
          proposal_id: string | null
          segments: Json
          template: string
          updated_at: string
        }
        Insert: {
          branding?: Json | null
          created_at?: string
          id?: string
          name?: string
          proposal_id?: string | null
          segments?: Json
          template?: string
          updated_at?: string
        }
        Update: {
          branding?: Json | null
          created_at?: string
          id?: string
          name?: string
          proposal_id?: string | null
          segments?: Json
          template?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_configs_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      report_versions: {
        Row: {
          created_at: string
          generated_by: string | null
          id: string
          notes: string | null
          report_config_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          generated_by?: string | null
          id?: string
          notes?: string | null
          report_config_id: string
          snapshot: Json
          version?: number
        }
        Update: {
          created_at?: string
          generated_by?: string | null
          id?: string
          notes?: string | null
          report_config_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_versions_report_config_id_fkey"
            columns: ["report_config_id"]
            isOneToOne: false
            referencedRelation: "report_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      sandbox_simulations: {
        Row: {
          cloned_from_project_id: string | null
          created_at: string
          draft_notes: string | null
          history_index: number | null
          id: string
          is_draft: boolean | null
          name: string
          parameter_history: Json | null
          project_snapshot: Json | null
          scenario_a: Json | null
          scenario_b: Json | null
          scenario_c: Json | null
          sweep_config: Json | null
          updated_at: string
        }
        Insert: {
          cloned_from_project_id?: string | null
          created_at?: string
          draft_notes?: string | null
          history_index?: number | null
          id?: string
          is_draft?: boolean | null
          name: string
          parameter_history?: Json | null
          project_snapshot?: Json | null
          scenario_a?: Json | null
          scenario_b?: Json | null
          scenario_c?: Json | null
          sweep_config?: Json | null
          updated_at?: string
        }
        Update: {
          cloned_from_project_id?: string | null
          created_at?: string
          draft_notes?: string | null
          history_index?: number | null
          id?: string
          is_draft?: boolean | null
          name?: string
          parameter_history?: Json | null
          project_snapshot?: Json | null
          scenario_a?: Json | null
          scenario_b?: Json | null
          scenario_c?: Json | null
          sweep_config?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sandbox_simulations_cloned_from_project_id_fkey"
            columns: ["cloned_from_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      scada_imports: {
        Row: {
          area_sqm: number | null
          category_id: string | null
          created_at: string
          data_points: number | null
          date_range_end: string | null
          date_range_start: string | null
          detected_interval_minutes: number | null
          file_name: string | null
          id: string
          load_profile_weekday: number[] | null
          load_profile_weekend: number[] | null
          meter_color: string | null
          meter_label: string | null
          processed_at: string | null
          project_id: string | null
          raw_data: Json | null
          shop_name: string | null
          shop_number: string | null
          site_id: string | null
          site_name: string
          updated_at: string
          value_unit: string | null
          weekday_days: number | null
          weekend_days: number | null
        }
        Insert: {
          area_sqm?: number | null
          category_id?: string | null
          created_at?: string
          data_points?: number | null
          date_range_end?: string | null
          date_range_start?: string | null
          detected_interval_minutes?: number | null
          file_name?: string | null
          id?: string
          load_profile_weekday?: number[] | null
          load_profile_weekend?: number[] | null
          meter_color?: string | null
          meter_label?: string | null
          processed_at?: string | null
          project_id?: string | null
          raw_data?: Json | null
          shop_name?: string | null
          shop_number?: string | null
          site_id?: string | null
          site_name: string
          updated_at?: string
          value_unit?: string | null
          weekday_days?: number | null
          weekend_days?: number | null
        }
        Update: {
          area_sqm?: number | null
          category_id?: string | null
          created_at?: string
          data_points?: number | null
          date_range_end?: string | null
          date_range_start?: string | null
          detected_interval_minutes?: number | null
          file_name?: string | null
          id?: string
          load_profile_weekday?: number[] | null
          load_profile_weekend?: number[] | null
          meter_color?: string | null
          meter_label?: string | null
          processed_at?: string | null
          project_id?: string | null
          raw_data?: Json | null
          shop_name?: string | null
          shop_number?: string | null
          site_id?: string | null
          site_name?: string
          updated_at?: string
          value_unit?: string | null
          weekday_days?: number | null
          weekend_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scada_imports_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "shop_type_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scada_imports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scada_imports_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_type_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      shop_types: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          kwh_per_sqm_month: number
          load_profile_weekday: number[]
          load_profile_weekend: number[]
          name: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kwh_per_sqm_month?: number
          load_profile_weekday?: number[]
          load_profile_weekend?: number[]
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          kwh_per_sqm_month?: number
          load_profile_weekday?: number[]
          load_profile_weekend?: number[]
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "shop_type_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_presets: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config: Json
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          created_at: string
          description: string | null
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          name: string
          site_type: string | null
          total_area_sqm: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name: string
          site_type?: string | null
          total_area_sqm?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          name?: string
          site_type?: string | null
          total_area_sqm?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      stacked_profiles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          meter_ids: string[]
          name: string
          project_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          meter_ids?: string[]
          name: string
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          meter_ids?: string[]
          name?: string
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stacked_profiles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tariff_plans: {
        Row: {
          category: Database["public"]["Enums"]["customer_category"]
          created_at: string
          description: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_recommended: boolean | null
          is_redundant: boolean | null
          max_amps: number | null
          max_kva: number | null
          max_kw: number | null
          metering: Database["public"]["Enums"]["metering_type"] | null
          min_amps: number | null
          min_kva: number | null
          min_kw: number | null
          municipality_id: string
          name: string
          phase: string | null
          scale_code: string | null
          structure: Database["public"]["Enums"]["tariff_structure"]
          updated_at: string
          voltage: Database["public"]["Enums"]["voltage_level"] | null
        }
        Insert: {
          category: Database["public"]["Enums"]["customer_category"]
          created_at?: string
          description?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_recommended?: boolean | null
          is_redundant?: boolean | null
          max_amps?: number | null
          max_kva?: number | null
          max_kw?: number | null
          metering?: Database["public"]["Enums"]["metering_type"] | null
          min_amps?: number | null
          min_kva?: number | null
          min_kw?: number | null
          municipality_id: string
          name: string
          phase?: string | null
          scale_code?: string | null
          structure: Database["public"]["Enums"]["tariff_structure"]
          updated_at?: string
          voltage?: Database["public"]["Enums"]["voltage_level"] | null
        }
        Update: {
          category?: Database["public"]["Enums"]["customer_category"]
          created_at?: string
          description?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_recommended?: boolean | null
          is_redundant?: boolean | null
          max_amps?: number | null
          max_kva?: number | null
          max_kw?: number | null
          metering?: Database["public"]["Enums"]["metering_type"] | null
          min_amps?: number | null
          min_kva?: number | null
          min_kw?: number | null
          municipality_id?: string
          name?: string
          phase?: string | null
          scale_code?: string | null
          structure?: Database["public"]["Enums"]["tariff_structure"]
          updated_at?: string
          voltage?: Database["public"]["Enums"]["voltage_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "tariff_plans_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      tariff_rates: {
        Row: {
          amount: number
          block_max_kwh: number | null
          block_min_kwh: number | null
          block_number: number | null
          charge: Database["public"]["Enums"]["charge_type"]
          consumption_threshold_kwh: number | null
          created_at: string
          id: string
          is_above_threshold: boolean | null
          notes: string | null
          season: Database["public"]["Enums"]["season_type"]
          tariff_plan_id: string
          tou: Database["public"]["Enums"]["tou_period"]
          unit: string
        }
        Insert: {
          amount: number
          block_max_kwh?: number | null
          block_min_kwh?: number | null
          block_number?: number | null
          charge: Database["public"]["Enums"]["charge_type"]
          consumption_threshold_kwh?: number | null
          created_at?: string
          id?: string
          is_above_threshold?: boolean | null
          notes?: string | null
          season?: Database["public"]["Enums"]["season_type"]
          tariff_plan_id: string
          tou?: Database["public"]["Enums"]["tou_period"]
          unit: string
        }
        Update: {
          amount?: number
          block_max_kwh?: number | null
          block_min_kwh?: number | null
          block_number?: number | null
          charge?: Database["public"]["Enums"]["charge_type"]
          consumption_threshold_kwh?: number | null
          created_at?: string
          id?: string
          is_above_threshold?: boolean | null
          notes?: string | null
          season?: Database["public"]["Enums"]["season_type"]
          tariff_plan_id?: string
          tou?: Database["public"]["Enums"]["tou_period"]
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "tariff_rates_tariff_plan_id_fkey"
            columns: ["tariff_plan_id"]
            isOneToOne: false
            referencedRelation: "tariff_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_municipality_summary: {
        Row: {
          municipality: string | null
          nersa_increase_pct: number | null
          province: string | null
          tariff_plan_count: number | null
          total_rate_lines: number | null
        }
        Relationships: []
      }
      v_tariff_lookup: {
        Row: {
          amount: number | null
          block_max_kwh: number | null
          block_min_kwh: number | null
          block_number: number | null
          category: Database["public"]["Enums"]["customer_category"] | null
          charge: Database["public"]["Enums"]["charge_type"] | null
          consumption_threshold_kwh: number | null
          is_above_threshold: boolean | null
          is_recommended: boolean | null
          is_redundant: boolean | null
          max_amps: number | null
          max_kva: number | null
          metering: Database["public"]["Enums"]["metering_type"] | null
          min_amps: number | null
          min_kva: number | null
          municipality: string | null
          nersa_increase_pct: number | null
          notes: string | null
          phase: string | null
          province: string | null
          province_code: string | null
          scale_code: string | null
          season: Database["public"]["Enums"]["season_type"] | null
          structure: Database["public"]["Enums"]["tariff_structure"] | null
          tariff_name: string | null
          tou: Database["public"]["Enums"]["tou_period"] | null
          unit: string | null
          voltage: Database["public"]["Enums"]["voltage_level"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_monthly_cost: {
        Args: {
          p_category: Database["public"]["Enums"]["customer_category"]
          p_demand_kva?: number
          p_kwh_usage: number
          p_municipality_id: string
          p_season?: Database["public"]["Enums"]["season_type"]
        }
        Returns: {
          basic_charge: number
          demand_charge: number
          energy_charge: number
          tariff_name: string
          total_estimate: number
        }[]
      }
      generate_share_token: { Args: never; Returns: string }
    }
    Enums: {
      charge_type:
        | "basic"
        | "energy"
        | "demand"
        | "network_access"
        | "network_demand"
        | "reactive_energy"
        | "service"
        | "admin"
        | "maintenance"
        | "availability"
        | "capacity"
        | "ancillary"
        | "subsidy"
        | "surcharge"
        | "amperage"
        | "notified_demand"
      customer_category:
        | "domestic"
        | "domestic_indigent"
        | "commercial"
        | "industrial"
        | "agricultural"
        | "public_lighting"
        | "sports_facilities"
        | "public_benefit"
        | "bulk_reseller"
        | "departmental"
        | "availability"
        | "other"
      gantt_dependency_type:
        | "finish_to_start"
        | "start_to_start"
        | "finish_to_finish"
        | "start_to_finish"
      gantt_task_status: "not_started" | "in_progress" | "completed"
      metering_type: "prepaid" | "conventional" | "both" | "unmetered"
      season_type: "all" | "low" | "high"
      tariff_structure:
        | "flat"
        | "inclining_block"
        | "seasonal"
        | "time_of_use"
        | "demand"
        | "hybrid"
      tou_period: "all" | "peak" | "standard" | "off_peak"
      voltage_level: "low" | "medium" | "high"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      charge_type: [
        "basic",
        "energy",
        "demand",
        "network_access",
        "network_demand",
        "reactive_energy",
        "service",
        "admin",
        "maintenance",
        "availability",
        "capacity",
        "ancillary",
        "subsidy",
        "surcharge",
        "amperage",
        "notified_demand",
      ],
      customer_category: [
        "domestic",
        "domestic_indigent",
        "commercial",
        "industrial",
        "agricultural",
        "public_lighting",
        "sports_facilities",
        "public_benefit",
        "bulk_reseller",
        "departmental",
        "availability",
        "other",
      ],
      gantt_dependency_type: [
        "finish_to_start",
        "start_to_start",
        "finish_to_finish",
        "start_to_finish",
      ],
      gantt_task_status: ["not_started", "in_progress", "completed"],
      metering_type: ["prepaid", "conventional", "both", "unmetered"],
      season_type: ["all", "low", "high"],
      tariff_structure: [
        "flat",
        "inclining_block",
        "seasonal",
        "time_of_use",
        "demand",
        "hybrid",
      ],
      tou_period: ["all", "peak", "standard", "off_peak"],
      voltage_level: ["low", "medium", "high"],
    },
  },
} as const
