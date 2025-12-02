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
      municipalities: {
        Row: {
          created_at: string
          id: string
          increase_percentage: number | null
          name: string
          province_id: string
          source_file_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          increase_percentage?: number | null
          name: string
          province_id: string
          source_file_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          increase_percentage?: number | null
          name?: string
          province_id?: string
          source_file_path?: string | null
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
          category_id: string
          created_at: string
          demand_charge_per_kva: number | null
          fixed_monthly_charge: number | null
          has_seasonal_rates: boolean | null
          id: string
          is_prepaid: boolean | null
          municipality_id: string
          name: string
          network_access_charge: number | null
          phase_type: Database["public"]["Enums"]["phase_type"] | null
          tariff_type: Database["public"]["Enums"]["tariff_type"]
          updated_at: string
        }
        Insert: {
          amperage_limit?: string | null
          category_id: string
          created_at?: string
          demand_charge_per_kva?: number | null
          fixed_monthly_charge?: number | null
          has_seasonal_rates?: boolean | null
          id?: string
          is_prepaid?: boolean | null
          municipality_id: string
          name: string
          network_access_charge?: number | null
          phase_type?: Database["public"]["Enums"]["phase_type"] | null
          tariff_type?: Database["public"]["Enums"]["tariff_type"]
          updated_at?: string
        }
        Update: {
          amperage_limit?: string | null
          category_id?: string
          created_at?: string
          demand_charge_per_kva?: number | null
          fixed_monthly_charge?: number | null
          has_seasonal_rates?: boolean | null
          id?: string
          is_prepaid?: boolean | null
          municipality_id?: string
          name?: string
          network_access_charge?: number | null
          phase_type?: Database["public"]["Enums"]["phase_type"] | null
          tariff_type?: Database["public"]["Enums"]["tariff_type"]
          updated_at?: string
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
      ],
    },
  },
} as const
