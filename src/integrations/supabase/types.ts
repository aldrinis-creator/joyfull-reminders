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
      checklist_items: {
        Row: {
          created_at: string
          done: boolean
          id: string
          label: string
          reminder_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          label: string
          reminder_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          label?: string
          reminder_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          birth_date: string | null
          birth_year: number | null
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          gift_hints: string | null
          greetings_enabled: boolean
          id: string
          likes: string[]
          music_genres: string[]
          notes: string | null
          photo_url: string | null
          pincode: string | null
          relationship: string
          updated_at: string
          user_id: string
          whatsapp_phone: string | null
          whatsapp_verified_at: string | null
        }
        Insert: {
          birth_date?: string | null
          birth_year?: number | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          gift_hints?: string | null
          greetings_enabled?: boolean
          id?: string
          likes?: string[]
          music_genres?: string[]
          notes?: string | null
          photo_url?: string | null
          pincode?: string | null
          relationship?: string
          updated_at?: string
          user_id: string
          whatsapp_phone?: string | null
          whatsapp_verified_at?: string | null
        }
        Update: {
          birth_date?: string | null
          birth_year?: number | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          gift_hints?: string | null
          greetings_enabled?: boolean
          id?: string
          likes?: string[]
          music_genres?: string[]
          notes?: string | null
          photo_url?: string | null
          pincode?: string | null
          relationship?: string
          updated_at?: string
          user_id?: string
          whatsapp_phone?: string | null
          whatsapp_verified_at?: string | null
        }
        Relationships: []
      }
      greetings: {
        Row: {
          card_style: string
          channel: Database["public"]["Enums"]["greeting_channel"]
          created_at: string
          error_message: string | null
          family_member_id: string | null
          id: string
          message: string
          occasion: string
          occasion_key: string
          provider_message_id: string | null
          recipient: string | null
          reminder_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["greeting_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          card_style?: string
          channel?: Database["public"]["Enums"]["greeting_channel"]
          created_at?: string
          error_message?: string | null
          family_member_id?: string | null
          id?: string
          message: string
          occasion?: string
          occasion_key: string
          provider_message_id?: string | null
          recipient?: string | null
          reminder_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["greeting_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          card_style?: string
          channel?: Database["public"]["Enums"]["greeting_channel"]
          created_at?: string
          error_message?: string | null
          family_member_id?: string | null
          id?: string
          message?: string
          occasion?: string
          occasion_key?: string
          provider_message_id?: string | null
          recipient?: string | null
          reminder_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["greeting_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "greetings_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "greetings_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          created_at: string
          id: string
          note: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_paise: number
          created_at: string
          delivery_address: string | null
          delivery_city: string | null
          delivery_date: string | null
          delivery_pincode: string | null
          family_member_id: string | null
          gift_message: string | null
          id: string
          product_id: string | null
          quantity: number
          recipient_name: string | null
          reminder_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_date?: string | null
          delivery_pincode?: string | null
          family_member_id?: string | null
          gift_message?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          recipient_name?: string | null
          reminder_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id: string
          vendor_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_date?: string | null
          delivery_pincode?: string | null
          family_member_id?: string | null
          gift_message?: string | null
          id?: string
          product_id?: string | null
          quantity?: number
          recipient_name?: string | null
          reminder_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vendor_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paise: number
          created_at: string
          id: string
          order_id: string
          provider: string
          provider_order_id: string | null
          provider_payment_id: string | null
          signature_verified: boolean
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          id?: string
          order_id: string
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          signature_verified?: boolean
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          id?: string
          order_id?: string
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          signature_verified?: boolean
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_otp_challenges: {
        Row: {
          attempts: number
          channel: string
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          ip: string | null
          phone: string
          provider_error: string | null
          provider_message_id: string | null
          provider_status: string
          purpose: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          channel: string
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          ip?: string | null
          phone: string
          provider_error?: string | null
          provider_message_id?: string | null
          provider_status?: string
          purpose?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          channel?: string
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          phone?: string
          provider_error?: string | null
          provider_message_id?: string | null
          provider_status?: string
          purpose?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pincodes: {
        Row: {
          city: string
          code: string
          created_at: string
          latitude: number
          longitude: number
          state: string
        }
        Insert: {
          city: string
          code: string
          created_at?: string
          latitude: number
          longitude: number
          state: string
        }
        Update: {
          city?: string
          code?: string
          created_at?: string
          latitude?: number
          longitude?: number
          state?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          alarm_sound: string
          avatar_url: string | null
          calendar_token: string | null
          city: string | null
          created_at: string
          email_enabled: boolean
          full_name: string | null
          id: string
          latitude: number | null
          longitude: number | null
          onboarded: boolean
          phone: string | null
          phone_verified_at: string | null
          pincode: string | null
          push_enabled: boolean
          updated_at: string
        }
        Insert: {
          address?: string | null
          alarm_sound?: string
          avatar_url?: string | null
          calendar_token?: string | null
          city?: string | null
          created_at?: string
          email_enabled?: boolean
          full_name?: string | null
          id: string
          latitude?: number | null
          longitude?: number | null
          onboarded?: boolean
          phone?: string | null
          phone_verified_at?: string | null
          pincode?: string | null
          push_enabled?: boolean
          updated_at?: string
        }
        Update: {
          address?: string | null
          alarm_sound?: string
          avatar_url?: string | null
          calendar_token?: string | null
          city?: string | null
          created_at?: string
          email_enabled?: boolean
          full_name?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          onboarded?: boolean
          phone?: string | null
          phone_verified_at?: string | null
          pincode?: string | null
          push_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      reminder_alerts: {
        Row: {
          created_at: string
          id: string
          label: string | null
          last_notified_occurrence_at: string | null
          offset_minutes: number
          reminder_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          last_notified_occurrence_at?: string | null
          offset_minutes?: number
          reminder_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          last_notified_occurrence_at?: string | null
          offset_minutes?: number
          reminder_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_alerts_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_occurrences: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          id: string
          occurrence_at: string
          reminder_id: string
          snoozed_until: string | null
          status: Database["public"]["Enums"]["occurrence_status"]
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          occurrence_at: string
          reminder_id: string
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["occurrence_status"]
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          occurrence_at?: string
          reminder_id?: string
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["occurrence_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_occurrences_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          action_type: string | null
          amount_paise: number | null
          birth_year: number | null
          category: Database["public"]["Enums"]["reminder_category"]
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string
          family_member_id: string | null
          id: string
          institution: string | null
          location: string | null
          occasion_kind: Database["public"]["Enums"]["special_date_kind"] | null
          participants: string | null
          payment_amount: number | null
          payment_url: string | null
          priority: Database["public"]["Enums"]["reminder_priority"]
          recurrence: Database["public"]["Enums"]["recurrence_kind"]
          recurrence_interval_days: number | null
          title: string
          updated_at: string
          upi_id: string | null
          upi_payee_name: string | null
          user_id: string
          vehicle_number: string | null
        }
        Insert: {
          action_type?: string | null
          amount_paise?: number | null
          birth_year?: number | null
          category?: Database["public"]["Enums"]["reminder_category"]
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at: string
          family_member_id?: string | null
          id?: string
          institution?: string | null
          location?: string | null
          occasion_kind?:
            | Database["public"]["Enums"]["special_date_kind"]
            | null
          participants?: string | null
          payment_amount?: number | null
          payment_url?: string | null
          priority?: Database["public"]["Enums"]["reminder_priority"]
          recurrence?: Database["public"]["Enums"]["recurrence_kind"]
          recurrence_interval_days?: number | null
          title: string
          updated_at?: string
          upi_id?: string | null
          upi_payee_name?: string | null
          user_id: string
          vehicle_number?: string | null
        }
        Update: {
          action_type?: string | null
          amount_paise?: number | null
          birth_year?: number | null
          category?: Database["public"]["Enums"]["reminder_category"]
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string
          family_member_id?: string | null
          id?: string
          institution?: string | null
          location?: string | null
          occasion_kind?:
            | Database["public"]["Enums"]["special_date_kind"]
            | null
          participants?: string | null
          payment_amount?: number | null
          payment_url?: string | null
          priority?: Database["public"]["Enums"]["reminder_priority"]
          recurrence?: Database["public"]["Enums"]["recurrence_kind"]
          recurrence_interval_days?: number | null
          title?: string
          updated_at?: string
          upi_id?: string | null
          upi_payee_name?: string | null
          user_id?: string
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      special_dates: {
        Row: {
          created_at: string
          event_date: string
          family_member_id: string
          id: string
          kind: Database["public"]["Enums"]["special_date_kind"]
          recurring: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_date: string
          family_member_id: string
          id?: string
          kind?: Database["public"]["Enums"]["special_date_kind"]
          recurring?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_date?: string
          family_member_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["special_date_kind"]
          recurring?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_dates_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          badges: string[]
          current_streak: number
          last_completed_on: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          badges?: string[]
          current_streak?: number
          last_completed_on?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          badges?: string[]
          current_streak?: number
          last_completed_on?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vendor_products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price_paise: number
          tag: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price_paise: number
          tag?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price_paise?: number
          tag?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_demo: boolean
          kind: Database["public"]["Enums"]["vendor_kind"]
          latitude: number | null
          longitude: number | null
          name: string
          owner_id: string | null
          phone: string | null
          pincode: string | null
          rating: number
          service_radius_km: number
          serviceable_pincodes: string[]
          ships_all_india: boolean
          updated_at: string
          upi_id: string | null
          upi_payee_name: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["vendor_kind"]
          latitude?: number | null
          longitude?: number | null
          name: string
          owner_id?: string | null
          phone?: string | null
          pincode?: string | null
          rating?: number
          service_radius_km?: number
          serviceable_pincodes?: string[]
          ships_all_india?: boolean
          updated_at?: string
          upi_id?: string | null
          upi_payee_name?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_demo?: boolean
          kind?: Database["public"]["Enums"]["vendor_kind"]
          latitude?: number | null
          longitude?: number | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          pincode?: string | null
          rating?: number
          service_radius_km?: number
          serviceable_pincodes?: string[]
          ships_all_india?: boolean
          updated_at?: string
          upi_id?: string | null
          upi_payee_name?: string | null
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          family_member_id: string | null
          fulfilled: boolean
          id: string
          notes: string | null
          price_paise: number | null
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          family_member_id?: string | null
          fulfilled?: boolean
          id?: string
          notes?: string | null
          price_paise?: number | null
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          family_member_id?: string | null
          fulfilled?: boolean
          id?: string
          notes?: string | null
          price_paise?: number | null
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "vendor" | "admin"
      greeting_channel: "email" | "whatsapp" | "share"
      greeting_status: "draft" | "sent" | "failed" | "skipped"
      occurrence_status:
        | "pending"
        | "snoozed"
        | "acknowledged"
        | "completed"
        | "missed"
      order_status:
        | "pending_payment"
        | "paid"
        | "confirmed"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "failed"
      payment_status: "created" | "captured" | "failed" | "refunded"
      recurrence_kind:
        | "once"
        | "daily"
        | "weekly"
        | "monthly"
        | "yearly"
        | "custom"
      reminder_category:
        | "personal_family"
        | "finance_tax"
        | "automotive"
        | "academic_career"
        | "subscription"
        | "health"
        | "household"
        | "custom"
        | "appointment"
        | "meeting"
      reminder_priority: "low" | "normal" | "high"
      special_date_kind:
        | "birthday"
        | "anniversary"
        | "memorial"
        | "exam"
        | "milestone"
        | "other"
      vendor_kind: "florist" | "bakery" | "gift_shop" | "other"
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
      app_role: ["user", "vendor", "admin"],
      greeting_channel: ["email", "whatsapp", "share"],
      greeting_status: ["draft", "sent", "failed", "skipped"],
      occurrence_status: [
        "pending",
        "snoozed",
        "acknowledged",
        "completed",
        "missed",
      ],
      order_status: [
        "pending_payment",
        "paid",
        "confirmed",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "failed",
      ],
      payment_status: ["created", "captured", "failed", "refunded"],
      recurrence_kind: [
        "once",
        "daily",
        "weekly",
        "monthly",
        "yearly",
        "custom",
      ],
      reminder_category: [
        "personal_family",
        "finance_tax",
        "automotive",
        "academic_career",
        "subscription",
        "health",
        "household",
        "custom",
        "appointment",
        "meeting",
      ],
      reminder_priority: ["low", "normal", "high"],
      special_date_kind: [
        "birthday",
        "anniversary",
        "memorial",
        "exam",
        "milestone",
        "other",
      ],
      vendor_kind: ["florist", "bakery", "gift_shop", "other"],
    },
  },
} as const
