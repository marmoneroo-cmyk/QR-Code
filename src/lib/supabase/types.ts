export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string;
          slug: string;
          name: string;
          default_lang: 'en' | 'he';
          brand_color: string | null;
          logo_url: string | null;
          created_at: string;
        };
        Insert: {
          slug: string;
          name: string;
          default_lang?: 'en' | 'he';
          brand_color?: string | null;
          logo_url?: string | null;
        };
        Update: Partial<Database['public']['Tables']['restaurants']['Insert']>;
        Relationships: [];
      };
      restaurant_members: {
        Row: {
          id: string;
          restaurant_id: string;
          user_id: string;
          role: 'owner' | 'manager' | 'staff';
          created_at: string;
        };
        Insert: {
          restaurant_id: string;
          user_id: string;
          role?: 'owner' | 'manager' | 'staff';
        };
        Update: Partial<Database['public']['Tables']['restaurant_members']['Insert']>;
        Relationships: [];
      };
      cocktails: {
        Row: {
          id: string;
          restaurant_id: string;
          slug: string;
          status: 'draft' | 'published' | 'archived';
          title_en: string;
          title_he: string | null;
          subtitle_en: string;
          subtitle_he: string;
          tagline_en: string | null;
          tagline_he: string | null;
          category: 'citrus' | 'smoky' | 'bitter' | 'sweet' | 'mocktail';
          hero_image: string;
          hero_prompt: string | null;
          flavor: Json;
          bartender_note_en: string | null;
          bartender_note_he: string | null;
          bartender_name: string | null;
          dietary: Json;
          price_ils: number | null;
          cost_ils: number | null;
          pairings: Json | null;
          available_hours: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          restaurant_id: string;
          slug: string;
          status?: 'draft' | 'published' | 'archived';
          title_en: string;
          title_he?: string | null;
          subtitle_en?: string;
          subtitle_he?: string;
          tagline_en?: string | null;
          tagline_he?: string | null;
          category: 'citrus' | 'smoky' | 'bitter' | 'sweet' | 'mocktail';
          hero_image: string;
          hero_prompt?: string | null;
          flavor?: Json;
          bartender_note_en?: string | null;
          bartender_note_he?: string | null;
          bartender_name?: string | null;
          dietary?: Json;
          price_ils?: number | null;
          cost_ils?: number | null;
          pairings?: Json | null;
          available_hours?: Json | null;
        };
        Update: Partial<Database['public']['Tables']['cocktails']['Insert']>;
        Relationships: [];
      };
      cocktail_layers: {
        Row: {
          id: string;
          cocktail_id: string;
          layer_id: string;
          image: string;
          y: number;
          z: number;
          scale: number;
          float_amp: number;
          float_speed: number;
          parallax_factor: number;
          generation_prompt: string | null;
          position: number;
        };
        Insert: Omit<Database['public']['Tables']['cocktail_layers']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['cocktail_layers']['Insert']>;
        Relationships: [];
      };
      cocktail_labels: {
        Row: {
          id: string;
          cocktail_id: string;
          label_id: string;
          number: string;
          name_en: string;
          name_he: string | null;
          description_en: string;
          description_he: string | null;
          origin_en: string | null;
          origin_he: string | null;
          layer_id: string;
          position: number;
        };
        Insert: Omit<Database['public']['Tables']['cocktail_labels']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['cocktail_labels']['Insert']>;
        Relationships: [];
      };
      events: {
        Row: {
          id: number;
          restaurant_id: string;
          cocktail_id: string | null;
          event_type: 'view' | 'hover_layer' | 'share' | 'favorite' | 'order' | null;
          event_name: string | null;
          cocktail_slug: string | null;
          table_id: string | null;
          device_type: string | null;
          language: string | null;
          referrer: string | null;
          value_num: number | null;
          metadata: Json | null;
          session_id: string | null;
          visitor_id: string | null;
          occurred_at: string | null;
          created_at: string;
        };
        Insert: {
          restaurant_id: string;
          cocktail_id?: string | null;
          event_type?: 'view' | 'hover_layer' | 'share' | 'favorite' | 'order' | null;
          event_name?: string | null;
          cocktail_slug?: string | null;
          table_id?: string | null;
          device_type?: string | null;
          language?: string | null;
          referrer?: string | null;
          value_num?: number | null;
          metadata?: Json | null;
          session_id?: string | null;
          visitor_id?: string | null;
          occurred_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
        Relationships: [];
      };
      promotions: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          type: 'percentage' | 'fixed';
          value: number;
          scope: 'item' | 'category' | 'all';
          target_slugs: Json | null;
          target_categories: Json | null;
          schedule: Json | null;
          badge_kind: string | null;
          badge_label: Json | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          restaurant_id: string;
          name: string;
          type: 'percentage' | 'fixed';
          value: number;
          scope: 'item' | 'category' | 'all';
          target_slugs?: Json | null;
          target_categories?: Json | null;
          schedule?: Json | null;
          badge_kind?: string | null;
          badge_label?: Json | null;
          active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['promotions']['Insert']>;
        Relationships: [];
      };
      menu_experience: {
        Row: {
          id: string;
          restaurant_id: string;
          slug: string;
          config: Json;
          updated_at: string;
        };
        Insert: {
          restaurant_id: string;
          slug: string;
          config: Json;
        };
        Update: Partial<Database['public']['Tables']['menu_experience']['Insert']>;
        Relationships: [];
      };
      sales: {
        Row: {
          id: string;
          restaurant_id: string;
          slug: string;
          units: number;
          revenue: number;
          period_start: string;
          period_end: string;
          created_at: string;
        };
        Insert: {
          restaurant_id: string;
          slug: string;
          units: number;
          revenue: number;
          period_start: string;
          period_end: string;
        };
        Update: Partial<Database['public']['Tables']['sales']['Insert']>;
        Relationships: [];
      };
      changes: {
        Row: {
          id: string;
          restaurant_id: string;
          change_type: string;
          entity_type: string;
          entity_id: string | null;
          before: Json | null;
          after: Json | null;
          summary: string | null;
          source: 'auto' | 'manual';
          created_at: string;
        };
        Insert: {
          restaurant_id: string;
          change_type: string;
          entity_type: string;
          entity_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          summary?: string | null;
          source?: 'auto' | 'manual';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['changes']['Insert']>;
        Relationships: [];
      };
    };
    // These keys are required by supabase-js's GenericSchema constraint.
    // Without them, insert/update/upsert argument types collapse to `never`.
    Views: {
      cocktail_funnel: {
        Row: {
          restaurant_id: string;
          cocktail_slug: string | null;
          seen: number;
          opened: number;
          ingredients: number;
          breakdown: number;
          called: number;
          ordered: number;
        };
        Relationships: [];
      };
    };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
