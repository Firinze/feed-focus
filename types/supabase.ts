export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          created_at: string
          updated_at: string
          last_login: string | null
        }
        Insert: {
          id: string
          email: string
          created_at?: string
          updated_at?: string
          last_login?: string | null
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
          updated_at?: string
          last_login?: string | null
        }
      }
      feeds: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          unique_id: string | null
          name: string
          title: string | null
          image_url: string | null
          linkedin_url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          unique_id?: string | null
          name: string
          title?: string | null
          image_url?: string | null
          linkedin_url: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          unique_id?: string | null
          name?: string
          title?: string | null
          image_url?: string | null
          linkedin_url?: string
          created_at?: string
          updated_at?: string
        }
      }
      feed_profiles: {
        Row: {
          id: string
          feed_id: string
          profile_id: string
          created_at: string
        }
        Insert: {
          id?: string
          feed_id: string
          profile_id: string
          created_at?: string
        }
        Update: {
          id?: string
          feed_id?: string
          profile_id?: string
          created_at?: string
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          focus_mode: boolean
          keyword_filter: string | null
          content_type: string
          current_feed_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          focus_mode?: boolean
          keyword_filter?: string | null
          content_type?: string
          current_feed_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          focus_mode?: boolean
          keyword_filter?: string | null
          content_type?: string
          current_feed_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type Feed = Database["public"]["Tables"]["feeds"]["Row"]
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"]
export type FeedProfile = Database["public"]["Tables"]["feed_profiles"]["Row"]
