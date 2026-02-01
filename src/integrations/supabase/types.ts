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
      eskom_batch_status: {
        Row: {
          batch_index: number
          batch_name: string
          created_at: string | null
          error_message: string | null
          id: string
          municipality_id: string
          status: string
          tariffs_extracted: number | null
          updated_at: string | null
        }
        Insert: {
          batch_index: number
          batch_name: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          municipality_id: string
          status?: string
          tariffs_extracted?: number | null
          updated_at?: string | null
        }
        Update: {
          batch_index?: number
          batch_name?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          municipality_id?: string
          status?: string
          tariffs_extracted?: number | null
          updated_at?: string | null
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
          error_message: string | null
          id: string
          municipality_id: string
          run_type: string
          started_at: string
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
          error_message?: string | null
          id?: string
          municipality_id: string
          run_type: string
          started_at?: string
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
          error_message?: string | null
          id?: string
          municipality_id?: string
          run_type?: string
          started_at?: string
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
      municipalities: {
        Row: {
          ai_confidence: number | null
          created_at: string
          extraction_error: string | null
          extraction_score: number | null
          extraction_status: string | null
          id: string
          increase_percentage: number | null
          last_extraction_at: string | null
          last_reprise_at: string | null
          name: string
          province_id: string
          reprise_count: number | null
          source_file_path: string | null
          total_corrections: number | null
          total_tariffs: number | null
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          created_at?: string
          extraction_error?: string | null
          extraction_score?: number | null
          extraction_status?: string | null
          id?: string
          increase_percentage?: number | null
          last_extraction_at?: string | null
          last_reprise_at?: string | null
          name: string
          province_id: string
          reprise_count?: number | null
          source_file_path?: string | null
          total_corrections?: number | null
          total_tariffs?: number | null
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          created_at?: string
          extraction_error?: string | null
          extraction_score?: number | null
          extraction_status?: string | null
          id?: string
          increase_percentage?: number | null
          last_extraction_at?: string | null
          last_reprise_at?: string | null
          name?: string
          province_id?: string
          reprise_count?: number | null
          source_file_path?: string | null
          total_corrections?: number | null
          total_tariffs?: number | null
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
          created_at: string
          id: string
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
          created_at?: string
          id?: string
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
          created_at?: string
          id?: string
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
            referencedRelation: "tariffs"
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
          created_at: string
          custom_notes: string | null
          disclaimers: string | null
          executive_summary: string | null
          id: string
          prepared_at: string | null
          prepared_by: string | null
          project_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          sandbox_id: string | null
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
          created_at?: string
          custom_notes?: string | null
          disclaimers?: string | null
          executive_summary?: string | null
          id?: string
          prepared_at?: string | null
          prepared_by?: string | null
          project_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sandbox_id?: string | null
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
          created_at?: string
          custom_notes?: string | null
          disclaimers?: string | null
          executive_summary?: string | null
          id?: string
          prepared_at?: string | null
          prepared_by?: string | null
          project_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sandbox_id?: string | null
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
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
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
      tariff_categories: {
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
      tariff_rates: {
        Row: {
          affordability_subsidy_per_kwh: number | null
          affordability_subsidy_per_kwh_incl_vat: number | null
          ancillary_charge_per_kwh: number | null
          ancillary_charge_per_kwh_incl_vat: number | null
          block_end_kwh: number | null
          block_start_kwh: number | null
          created_at: string
          demand_charge_per_kva: number | null
          demand_charge_per_kva_incl_vat: number | null
          electrification_rural_per_kwh: number | null
          electrification_rural_per_kwh_incl_vat: number | null
          energy_charge_per_kwh: number | null
          energy_charge_per_kwh_incl_vat: number | null
          id: string
          network_charge_per_kwh: number | null
          network_charge_per_kwh_incl_vat: number | null
          rate_per_kwh: number
          rate_per_kwh_incl_vat: number | null
          reactive_energy_charge: number | null
          season: Database["public"]["Enums"]["season_type"]
          tariff_id: string
          time_of_use: Database["public"]["Enums"]["time_of_use_type"]
        }
        Insert: {
          affordability_subsidy_per_kwh?: number | null
          affordability_subsidy_per_kwh_incl_vat?: number | null
          ancillary_charge_per_kwh?: number | null
          ancillary_charge_per_kwh_incl_vat?: number | null
          block_end_kwh?: number | null
          block_start_kwh?: number | null
          created_at?: string
          demand_charge_per_kva?: number | null
          demand_charge_per_kva_incl_vat?: number | null
          electrification_rural_per_kwh?: number | null
          electrification_rural_per_kwh_incl_vat?: number | null
          energy_charge_per_kwh?: number | null
          energy_charge_per_kwh_incl_vat?: number | null
          id?: string
          network_charge_per_kwh?: number | null
          network_charge_per_kwh_incl_vat?: number | null
          rate_per_kwh: number
          rate_per_kwh_incl_vat?: number | null
          reactive_energy_charge?: number | null
          season?: Database["public"]["Enums"]["season_type"]
          tariff_id: string
          time_of_use?: Database["public"]["Enums"]["time_of_use_type"]
        }
        Update: {
          affordability_subsidy_per_kwh?: number | null
          affordability_subsidy_per_kwh_incl_vat?: number | null
          ancillary_charge_per_kwh?: number | null
          ancillary_charge_per_kwh_incl_vat?: number | null
          block_end_kwh?: number | null
          block_start_kwh?: number | null
          created_at?: string
          demand_charge_per_kva?: number | null
          demand_charge_per_kva_incl_vat?: number | null
          electrification_rural_per_kwh?: number | null
          electrification_rural_per_kwh_incl_vat?: number | null
          energy_charge_per_kwh?: number | null
          energy_charge_per_kwh_incl_vat?: number | null
          id?: string
          network_charge_per_kwh?: number | null
          network_charge_per_kwh_incl_vat?: number | null
          rate_per_kwh?: number
          rate_per_kwh_incl_vat?: number | null
          reactive_energy_charge?: number | null
          season?: Database["public"]["Enums"]["season_type"]
          tariff_id?: string
          time_of_use?: Database["public"]["Enums"]["time_of_use_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tariff_rates_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      tariffs: {
        Row: {
          administration_charge_per_day: number | null
          administration_charge_per_day_incl_vat: number | null
          amperage_limit: string | null
          capacity_kva: number | null
          category_id: string
          created_at: string
          critical_peak_hours_per_month: number | null
          critical_peak_rate: number | null
          customer_category: string | null
          demand_charge_per_kva: number | null
          demand_charge_per_kva_incl_vat: number | null
          effective_from: string | null
          effective_to: string | null
          fixed_monthly_charge: number | null
          fixed_monthly_charge_incl_vat: number | null
          generation_capacity_charge: number | null
          generation_capacity_charge_incl_vat: number | null
          has_seasonal_rates: boolean | null
          id: string
          is_prepaid: boolean | null
          is_unbundled: boolean | null
          legacy_charge_per_kwh: number | null
          legacy_charge_per_kwh_incl_vat: number | null
          municipality_id: string
          name: string
          network_access_charge: number | null
          network_access_charge_incl_vat: number | null
          phase_type: Database["public"]["Enums"]["phase_type"] | null
          reactive_energy_charge: number | null
          reactive_energy_charge_incl_vat: number | null
          service_charge_per_day: number | null
          service_charge_per_day_incl_vat: number | null
          tariff_family: string | null
          tariff_type: Database["public"]["Enums"]["tariff_type"]
          transmission_zone:
            | Database["public"]["Enums"]["transmission_zone_type"]
            | null
          updated_at: string
          voltage_level: Database["public"]["Enums"]["voltage_level"] | null
        }
        Insert: {
          administration_charge_per_day?: number | null
          administration_charge_per_day_incl_vat?: number | null
          amperage_limit?: string | null
          capacity_kva?: number | null
          category_id: string
          created_at?: string
          critical_peak_hours_per_month?: number | null
          critical_peak_rate?: number | null
          customer_category?: string | null
          demand_charge_per_kva?: number | null
          demand_charge_per_kva_incl_vat?: number | null
          effective_from?: string | null
          effective_to?: string | null
          fixed_monthly_charge?: number | null
          fixed_monthly_charge_incl_vat?: number | null
          generation_capacity_charge?: number | null
          generation_capacity_charge_incl_vat?: number | null
          has_seasonal_rates?: boolean | null
          id?: string
          is_prepaid?: boolean | null
          is_unbundled?: boolean | null
          legacy_charge_per_kwh?: number | null
          legacy_charge_per_kwh_incl_vat?: number | null
          municipality_id: string
          name: string
          network_access_charge?: number | null
          network_access_charge_incl_vat?: number | null
          phase_type?: Database["public"]["Enums"]["phase_type"] | null
          reactive_energy_charge?: number | null
          reactive_energy_charge_incl_vat?: number | null
          service_charge_per_day?: number | null
          service_charge_per_day_incl_vat?: number | null
          tariff_family?: string | null
          tariff_type?: Database["public"]["Enums"]["tariff_type"]
          transmission_zone?:
            | Database["public"]["Enums"]["transmission_zone_type"]
            | null
          updated_at?: string
          voltage_level?: Database["public"]["Enums"]["voltage_level"] | null
        }
        Update: {
          administration_charge_per_day?: number | null
          administration_charge_per_day_incl_vat?: number | null
          amperage_limit?: string | null
          capacity_kva?: number | null
          category_id?: string
          created_at?: string
          critical_peak_hours_per_month?: number | null
          critical_peak_rate?: number | null
          customer_category?: string | null
          demand_charge_per_kva?: number | null
          demand_charge_per_kva_incl_vat?: number | null
          effective_from?: string | null
          effective_to?: string | null
          fixed_monthly_charge?: number | null
          fixed_monthly_charge_incl_vat?: number | null
          generation_capacity_charge?: number | null
          generation_capacity_charge_incl_vat?: number | null
          has_seasonal_rates?: boolean | null
          id?: string
          is_prepaid?: boolean | null
          is_unbundled?: boolean | null
          legacy_charge_per_kwh?: number | null
          legacy_charge_per_kwh_incl_vat?: number | null
          municipality_id?: string
          name?: string
          network_access_charge?: number | null
          network_access_charge_incl_vat?: number | null
          phase_type?: Database["public"]["Enums"]["phase_type"] | null
          reactive_energy_charge?: number | null
          reactive_energy_charge_incl_vat?: number | null
          service_charge_per_day?: number | null
          service_charge_per_day_incl_vat?: number | null
          tariff_family?: string | null
          tariff_type?: Database["public"]["Enums"]["tariff_type"]
          transmission_zone?:
            | Database["public"]["Enums"]["transmission_zone_type"]
            | null
          updated_at?: string
          voltage_level?: Database["public"]["Enums"]["voltage_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "tariffs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tariff_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tariffs_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      tou_periods: {
        Row: {
          created_at: string
          day_type: Database["public"]["Enums"]["day_type"]
          demand_charge_per_kva: number | null
          end_hour: number
          id: string
          rate_per_kwh: number
          season: Database["public"]["Enums"]["season_type"]
          start_hour: number
          tariff_id: string
          time_of_use: Database["public"]["Enums"]["time_of_use_type"]
        }
        Insert: {
          created_at?: string
          day_type?: Database["public"]["Enums"]["day_type"]
          demand_charge_per_kva?: number | null
          end_hour: number
          id?: string
          rate_per_kwh: number
          season?: Database["public"]["Enums"]["season_type"]
          start_hour: number
          tariff_id: string
          time_of_use?: Database["public"]["Enums"]["time_of_use_type"]
        }
        Update: {
          created_at?: string
          day_type?: Database["public"]["Enums"]["day_type"]
          demand_charge_per_kva?: number | null
          end_hour?: number
          id?: string
          rate_per_kwh?: number
          season?: Database["public"]["Enums"]["season_type"]
          start_hour?: number
          tariff_id?: string
          time_of_use?: Database["public"]["Enums"]["time_of_use_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tou_periods_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_share_token: { Args: never; Returns: string }
    }
    Enums: {
      day_type: "Weekday" | "Saturday" | "Sunday"
      gantt_dependency_type:
        | "finish_to_start"
        | "start_to_start"
        | "finish_to_finish"
        | "start_to_finish"
      gantt_task_status: "not_started" | "in_progress" | "completed"
      phase_type: "Single Phase" | "Three Phase"
      season_type: "All Year" | "High/Winter" | "Low/Summer"
      tariff_type: "Fixed" | "IBT" | "TOU"
      time_of_use_type:
        | "Any"
        | "Peak"
        | "Standard"
        | "Off-Peak"
        | "High Demand"
        | "Low Demand"
        | "Critical Peak"
      transmission_zone_type:
        | "Zone 0-300km"
        | "Zone 300-600km"
        | "Zone 600-900km"
        | "Zone >900km"
      voltage_level: "LV" | "MV" | "HV"
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
      day_type: ["Weekday", "Saturday", "Sunday"],
      gantt_dependency_type: [
        "finish_to_start",
        "start_to_start",
        "finish_to_finish",
        "start_to_finish",
      ],
      gantt_task_status: ["not_started", "in_progress", "completed"],
      phase_type: ["Single Phase", "Three Phase"],
      season_type: ["All Year", "High/Winter", "Low/Summer"],
      tariff_type: ["Fixed", "IBT", "TOU"],
      time_of_use_type: [
        "Any",
        "Peak",
        "Standard",
        "Off-Peak",
        "High Demand",
        "Low Demand",
        "Critical Peak",
      ],
      transmission_zone_type: [
        "Zone 0-300km",
        "Zone 300-600km",
        "Zone 600-900km",
        "Zone >900km",
      ],
      voltage_level: ["LV", "MV", "HV"],
    },
  },
} as const
