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
      project_tenants: {
        Row: {
          area_sqm: number
          created_at: string
          id: string
          monthly_kwh_override: number | null
          name: string
          project_id: string
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
          created_at: string
          description: string | null
          id: string
          location: string | null
          name: string
          tariff_id: string | null
          total_area_sqm: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name: string
          tariff_id?: string | null
          total_area_sqm?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          name?: string
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
      scada_imports: {
        Row: {
          category_id: string | null
          created_at: string
          data_points: number | null
          date_range_end: string | null
          date_range_start: string | null
          file_name: string | null
          id: string
          load_profile_weekday: number[] | null
          load_profile_weekend: number[] | null
          meter_color: string | null
          meter_label: string | null
          project_id: string | null
          raw_data: Json | null
          shop_name: string | null
          shop_number: string | null
          site_name: string
          updated_at: string
          weekday_days: number | null
          weekend_days: number | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          data_points?: number | null
          date_range_end?: string | null
          date_range_start?: string | null
          file_name?: string | null
          id?: string
          load_profile_weekday?: number[] | null
          load_profile_weekend?: number[] | null
          meter_color?: string | null
          meter_label?: string | null
          project_id?: string | null
          raw_data?: Json | null
          shop_name?: string | null
          shop_number?: string | null
          site_name: string
          updated_at?: string
          weekday_days?: number | null
          weekend_days?: number | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          data_points?: number | null
          date_range_end?: string | null
          date_range_start?: string | null
          file_name?: string | null
          id?: string
          load_profile_weekday?: number[] | null
          load_profile_weekend?: number[] | null
          meter_color?: string | null
          meter_label?: string | null
          project_id?: string | null
          raw_data?: Json | null
          shop_name?: string | null
          shop_number?: string | null
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
          block_end_kwh: number | null
          block_start_kwh: number | null
          created_at: string
          demand_charge_per_kva: number | null
          id: string
          rate_per_kwh: number
          reactive_energy_charge: number | null
          season: Database["public"]["Enums"]["season_type"]
          tariff_id: string
          time_of_use: Database["public"]["Enums"]["time_of_use_type"]
        }
        Insert: {
          block_end_kwh?: number | null
          block_start_kwh?: number | null
          created_at?: string
          demand_charge_per_kva?: number | null
          id?: string
          rate_per_kwh: number
          reactive_energy_charge?: number | null
          season?: Database["public"]["Enums"]["season_type"]
          tariff_id: string
          time_of_use?: Database["public"]["Enums"]["time_of_use_type"]
        }
        Update: {
          block_end_kwh?: number | null
          block_start_kwh?: number | null
          created_at?: string
          demand_charge_per_kva?: number | null
          id?: string
          rate_per_kwh?: number
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
          amperage_limit: string | null
          capacity_kva: number | null
          category_id: string
          created_at: string
          critical_peak_hours_per_month: number | null
          critical_peak_rate: number | null
          customer_category: string | null
          demand_charge_per_kva: number | null
          fixed_monthly_charge: number | null
          has_seasonal_rates: boolean | null
          id: string
          is_prepaid: boolean | null
          municipality_id: string
          name: string
          network_access_charge: number | null
          phase_type: Database["public"]["Enums"]["phase_type"] | null
          reactive_energy_charge: number | null
          tariff_type: Database["public"]["Enums"]["tariff_type"]
          updated_at: string
          voltage_level: Database["public"]["Enums"]["voltage_level"] | null
        }
        Insert: {
          amperage_limit?: string | null
          capacity_kva?: number | null
          category_id: string
          created_at?: string
          critical_peak_hours_per_month?: number | null
          critical_peak_rate?: number | null
          customer_category?: string | null
          demand_charge_per_kva?: number | null
          fixed_monthly_charge?: number | null
          has_seasonal_rates?: boolean | null
          id?: string
          is_prepaid?: boolean | null
          municipality_id: string
          name: string
          network_access_charge?: number | null
          phase_type?: Database["public"]["Enums"]["phase_type"] | null
          reactive_energy_charge?: number | null
          tariff_type?: Database["public"]["Enums"]["tariff_type"]
          updated_at?: string
          voltage_level?: Database["public"]["Enums"]["voltage_level"] | null
        }
        Update: {
          amperage_limit?: string | null
          capacity_kva?: number | null
          category_id?: string
          created_at?: string
          critical_peak_hours_per_month?: number | null
          critical_peak_rate?: number | null
          customer_category?: string | null
          demand_charge_per_kva?: number | null
          fixed_monthly_charge?: number | null
          has_seasonal_rates?: boolean | null
          id?: string
          is_prepaid?: boolean | null
          municipality_id?: string
          name?: string
          network_access_charge?: number | null
          phase_type?: Database["public"]["Enums"]["phase_type"] | null
          reactive_energy_charge?: number | null
          tariff_type?: Database["public"]["Enums"]["tariff_type"]
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
      [_ in never]: never
    }
    Enums: {
      day_type: "Weekday" | "Saturday" | "Sunday"
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
      voltage_level: ["LV", "MV", "HV"],
    },
  },
} as const
