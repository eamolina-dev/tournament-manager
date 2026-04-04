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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          circuit_id: string | null
          created_at: string
          id: string
          level: number
          name: string
          slug: string | null
        }
        Insert: {
          circuit_id?: string | null
          created_at?: string
          id?: string
          level: number
          name: string
          slug?: string | null
        }
        Update: {
          circuit_id?: string | null
          created_at?: string
          id?: string
          level?: number
          name?: string
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
        ]
      }
      circuits: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          name: string
          year: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          name: string
          year: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          name?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "circuits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          location: string | null
          logo_url: string | null
          name: string
          owner_user_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          name: string
          owner_user_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          name?: string
          owner_user_id?: string | null
          slug?: string
        }
        Relationships: []
      }
      group_teams: {
        Row: {
          created_at: string
          group_id: string
          id: string
          position: number | null
          team_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          position?: number | null
          team_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          position?: number | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_table_full"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team1_id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team2_id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_teams_with_players"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          group_key: string | null
          id: string
          name: string
          tournament_category_id: string
        }
        Insert: {
          created_at?: string
          group_key?: string | null
          id?: string
          name: string
          tournament_category_id: string
        }
        Update: {
          created_at?: string
          group_key?: string | null
          id?: string
          name?: string
          tournament_category_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_tournament_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      match_sets: {
        Row: {
          created_at: string
          id: string
          match_id: string
          set_number: number
          team1_games: number
          team2_games: number
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          set_number: number
          team1_games: number
          team2_games: number
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          set_number?: number
          team1_games?: number
          team2_games?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_sets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_sets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_sets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_sets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          court: string | null
          created_at: string
          group_id: string | null
          id: string
          match_number: number | null
          next_match_id: string | null
          next_match_slot: number | null
          order_in_day: number | null
          round: number | null
          round_order: number | null
          scheduled_at: string | null
          stage: Database["public"]["Enums"]["match_stage"]
          status: string | null
          team1_id: string | null
          team1_source: string | null
          team2_id: string | null
          team2_source: string | null
          tournament_category_id: string
          winner_team_id: string | null
        }
        Insert: {
          court?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          match_number?: number | null
          next_match_id?: string | null
          next_match_slot?: number | null
          order_in_day?: number | null
          round?: number | null
          round_order?: number | null
          scheduled_at?: string | null
          stage: Database["public"]["Enums"]["match_stage"]
          status?: string | null
          team1_id?: string | null
          team1_source?: string | null
          team2_id?: string | null
          team2_source?: string | null
          tournament_category_id: string
          winner_team_id?: string | null
        }
        Update: {
          court?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          match_number?: number | null
          next_match_id?: string | null
          next_match_slot?: number | null
          order_in_day?: number | null
          round?: number | null
          round_order?: number | null
          scheduled_at?: string | null
          stage?: Database["public"]["Enums"]["match_stage"]
          status?: string | null
          team1_id?: string | null
          team1_source?: string | null
          team2_id?: string | null
          team2_source?: string | null
          tournament_category_id?: string
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "v_group_table_full"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_next_match_id_fkey"
            columns: ["next_match_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team1_id"]
          },
          {
            foreignKeyName: "matches_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team2_id"]
          },
          {
            foreignKeyName: "matches_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "matches_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "matches_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "matches_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "matches_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "v_teams_with_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team1_id"]
          },
          {
            foreignKeyName: "matches_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team2_id"]
          },
          {
            foreignKeyName: "matches_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "matches_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "matches_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "matches_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "matches_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "v_teams_with_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team1_id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team2_id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_teams_with_players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          client_id: string | null
          created_at: string
          current_category_id: string | null
          gender: string | null
          id: string
          name: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          current_category_id?: string | null
          gender?: string | null
          id?: string
          name: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          current_category_id?: string | null
          gender?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_category_fkey"
            columns: ["current_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_rules: {
        Row: {
          circuit_id: string
          created_at: string
          id: string
          points: number
          position: number
        }
        Insert: {
          circuit_id: string
          created_at?: string
          id?: string
          points: number
          position: number
        }
        Update: {
          circuit_id?: string
          created_at?: string
          id?: string
          points?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "ranking_rules_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
        ]
      }
      team_results: {
        Row: {
          created_at: string
          final_position: number
          id: string
          points_awarded: number | null
          team_id: string
          tournament_category_id: string | null
        }
        Insert: {
          created_at?: string
          final_position: number
          id?: string
          points_awarded?: number | null
          team_id: string
          tournament_category_id?: string | null
        }
        Update: {
          created_at?: string
          final_position?: number
          id?: string
          points_awarded?: number | null
          team_id?: string
          tournament_category_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "v_bracket"
            referencedColumns: ["team1_id"]
          },
          {
            foreignKeyName: "team_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "v_bracket"
            referencedColumns: ["team2_id"]
          },
          {
            foreignKeyName: "team_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "team_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "team_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "team_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "team_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "v_teams_with_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_results_tournament_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          player1_id: string
          player2_id: string
          tournament_category_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          player1_id: string
          player2_id: string
          tournament_category_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          player1_id?: string
          player2_id?: string
          tournament_category_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_tournament_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_categories: {
        Row: {
          category_id: string | null
          courts_count: number | null
          created_at: string
          gender: string | null
          id: string
          is_suma: boolean | null
          match_interval_minutes: number | null
          schedule_start_times: Json | null
          suma_value: number | null
          tournament_id: string | null
        }
        Insert: {
          category_id?: string | null
          courts_count?: number | null
          created_at?: string
          gender?: string | null
          id?: string
          is_suma?: boolean | null
          match_interval_minutes?: number | null
          schedule_start_times?: Json | null
          suma_value?: number | null
          tournament_id?: string | null
        }
        Update: {
          category_id?: string | null
          courts_count?: number | null
          created_at?: string
          gender?: string | null
          id?: string
          is_suma?: boolean | null
          match_interval_minutes?: number | null
          schedule_start_times?: Json | null
          suma_value?: number | null
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_categories_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "home_tournaments_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_categories_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          circuit_id: string | null
          client_id: string | null
          created_at: string
          end_date: string | null
          id: string
          name: string | null
          slug: string | null
          start_date: string | null
          sum_limit: number | null
          type: string | null
        }
        Insert: {
          circuit_id?: string | null
          client_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string | null
          slug?: string | null
          start_date?: string | null
          sum_limit?: number | null
          type?: string | null
        }
        Update: {
          circuit_id?: string | null
          client_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string | null
          slug?: string | null
          start_date?: string | null
          sum_limit?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Tournament_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      home_tournaments_view: {
        Row: {
          categories_data: Json | null
          end_date: string | null
          id: string | null
          name: string | null
          slug: string | null
          start_date: string | null
        }
        Relationships: []
      }
      v_bracket: {
        Row: {
          id: string | null
          match_number: number | null
          stage: Database["public"]["Enums"]["match_stage"] | null
          team1_id: string | null
          team1_source: string | null
          team2_id: string | null
          team2_source: string | null
          winner_team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team1_id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team2_id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_teams_with_players"
            referencedColumns: ["id"]
          },
        ]
      }
      v_group_standings: {
        Row: {
          group_name: string | null
          position: number | null
          team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team1_id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team2_id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_teams_with_players"
            referencedColumns: ["id"]
          },
        ]
      }
      v_group_table_full: {
        Row: {
          games_won: number | null
          group_id: string | null
          group_name: string | null
          matches_won: number | null
          sets_won: number | null
          team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team1_id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team2_id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_teams_with_players"
            referencedColumns: ["id"]
          },
        ]
      }
      v_groups_with_teams: {
        Row: {
          group_name: string | null
          team_id: string | null
          team_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team1_id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team2_id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "v_teams_with_players"
            referencedColumns: ["id"]
          },
        ]
      }
      v_matches_detailed: {
        Row: {
          group_name: string | null
          id: string | null
          match_number: number | null
          stage: Database["public"]["Enums"]["match_stage"] | null
          team1: string | null
          team2: string | null
          winner_team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team1_id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team2_id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_teams_with_players"
            referencedColumns: ["id"]
          },
        ]
      }
      v_matches_with_teams: {
        Row: {
          id: string | null
          stage: Database["public"]["Enums"]["match_stage"] | null
          team1: string | null
          team2: string | null
          winner_team_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team1_id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_bracket"
            referencedColumns: ["team2_id"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_detailed"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team1"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_matches_with_teams"
            referencedColumns: ["team2"]
          },
          {
            foreignKeyName: "matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "v_teams_with_players"
            referencedColumns: ["id"]
          },
        ]
      }
      v_teams_with_players: {
        Row: {
          id: string | null
          player1: string | null
          player2: string | null
          team_name: string | null
          tournament_category_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_tournament_category_id_fkey"
            columns: ["tournament_category_id"]
            isOneToOne: false
            referencedRelation: "tournament_categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      advance_winner: { Args: { p_match_id: string }; Returns: undefined }
      assign_teams_to_groups: {
        Args: { p_tournament_category_id: string }
        Returns: undefined
      }
      calculate_group_wins: {
        Args: { p_group_id: string }
        Returns: {
          team_id: string
          wins: number
        }[]
      }
      generate_full_tournament: {
        Args: { p_tournament_category_id: string }
        Returns: undefined
      }
      generate_group_matches: {
        Args: { p_tournament_category_id: string }
        Returns: undefined
      }
      generate_groups: {
        Args: { p_tournament_category_id: string }
        Returns: undefined
      }
      generate_playoffs: {
        Args: { p_tournament_category_id: string }
        Returns: undefined
      }
      generate_playoffs_after_groups: {
        Args: { p_tournament_category_id: string }
        Returns: undefined
      }
      update_group_positions: {
        Args: { p_group_id: string }
        Returns: undefined
      }
    }
    Enums: {
      match_stage:
        | "group"
        | "quarter"
        | "semi"
        | "final"
        | "round_of_32"
        | "round_of_16"
        | "round_of_8"
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
      match_stage: [
        "group",
        "quarter",
        "semi",
        "final",
        "round_of_32",
        "round_of_16",
        "round_of_8",
      ],
    },
  },
} as const
