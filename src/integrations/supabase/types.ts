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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audits: {
        Row: {
          completed_at: string | null
          created_at: string
          failure_count: number
          id: string
          pillar_scores: Json
          root_url: string
          sku_count: number
          started_at: string | null
          status: string
          store_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          failure_count?: number
          id?: string
          pillar_scores?: Json
          root_url: string
          sku_count?: number
          started_at?: string | null
          status?: string
          store_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          failure_count?: number
          id?: string
          pillar_scores?: Json
          root_url?: string
          sku_count?: number
          started_at?: string | null
          status?: string
          store_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          attempts: number
          audit_id: string
          created_at: string
          error: string | null
          id: string
          last_audited_at: string | null
          next_run_at: string
          sku: string | null
          status: string
          title: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          attempts?: number
          audit_id: string
          created_at?: string
          error?: string | null
          id?: string
          last_audited_at?: string | null
          next_run_at?: string
          sku?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          attempts?: number
          audit_id?: string
          created_at?: string
          error?: string | null
          id?: string
          last_audited_at?: string | null
          next_run_at?: string
          sku?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
        ]
      }
      failures: {
        Row: {
          audit_id: string
          catalog_item_id: string | null
          created_at: string
          detail: Json
          detected_at: string
          failure_code: string
          id: string
          pillar: string
          severity: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audit_id: string
          catalog_item_id?: string | null
          created_at?: string
          detail?: Json
          detected_at?: string
          failure_code: string
          id?: string
          pillar: string
          severity: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audit_id?: string
          catalog_item_id?: string | null
          created_at?: string
          detail?: Json
          detected_at?: string
          failure_code?: string
          id?: string
          pillar?: string
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "failures_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "failures_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      fix_history: {
        Row: {
          audit_id: string
          created_at: string
          delta: number
          detail: string | null
          failure_id: string
          id: string
          pillar: string
          pillar_delta: number
          scores_after: Json
          scores_before: Json
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          audit_id: string
          created_at?: string
          delta?: number
          detail?: string | null
          failure_id: string
          id?: string
          pillar: string
          pillar_delta?: number
          scores_after?: Json
          scores_before?: Json
          severity: string
          title: string
          user_id: string
        }
        Update: {
          audit_id?: string
          created_at?: string
          delta?: number
          detail?: string | null
          failure_id?: string
          id?: string
          pillar?: string
          pillar_delta?: number
          scores_after?: Json
          scores_before?: Json
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fix_history_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fix_history_failure_id_fkey"
            columns: ["failure_id"]
            isOneToOne: false
            referencedRelation: "failures"
            referencedColumns: ["id"]
          },
        ]
      }
      fixes: {
        Row: {
          after_text: string | null
          before_text: string | null
          created_at: string
          deployed_at: string | null
          failure_id: string
          generated_by: string
          grounding_score: number
          hallucination_score: number
          id: string
          reasoning: string | null
          status: string
          updated_at: string
          user_feedback: string | null
          user_id: string
        }
        Insert: {
          after_text?: string | null
          before_text?: string | null
          created_at?: string
          deployed_at?: string | null
          failure_id: string
          generated_by: string
          grounding_score?: number
          hallucination_score?: number
          id?: string
          reasoning?: string | null
          status?: string
          updated_at?: string
          user_feedback?: string | null
          user_id: string
        }
        Update: {
          after_text?: string | null
          before_text?: string | null
          created_at?: string
          deployed_at?: string | null
          failure_id?: string
          generated_by?: string
          grounding_score?: number
          hallucination_score?: number
          id?: string
          reasoning?: string | null
          status?: string
          updated_at?: string
          user_feedback?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixes_failure_id_fkey"
            columns: ["failure_id"]
            isOneToOne: false
            referencedRelation: "failures"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          audit_runs_used: number
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          monitor_runs_used: number
          period_started_at: string
          plan: Database["public"]["Enums"]["app_plan"]
          tier: Database["public"]["Enums"]["app_tier"]
          updated_at: string
        }
        Insert: {
          audit_runs_used?: number
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          monitor_runs_used?: number
          period_started_at?: string
          plan?: Database["public"]["Enums"]["app_plan"]
          tier?: Database["public"]["Enums"]["app_tier"]
          updated_at?: string
        }
        Update: {
          audit_runs_used?: number
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          monitor_runs_used?: number
          period_started_at?: string
          plan?: Database["public"]["Enums"]["app_plan"]
          tier?: Database["public"]["Enums"]["app_tier"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_audit_run: { Args: { _limit: number }; Returns: number }
      increment_monitor_run: { Args: { _limit: number }; Returns: number }
    }
    Enums: {
      app_plan: "free" | "audit" | "monitor" | "bundle"
      app_tier: "free" | "starter" | "pro" | "enterprise"
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
      app_plan: ["free", "audit", "monitor", "bundle"],
      app_tier: ["free", "starter", "pro", "enterprise"],
    },
  },
} as const
