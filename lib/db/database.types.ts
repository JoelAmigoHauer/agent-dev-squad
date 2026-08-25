// GENERATED FILE — do not edit by hand.
// Produced from the live schema of Supabase project `lepawvuapeqqwoygpuww` on 2026-08-24.
// Regenerate after EVERY schema change, before writing code against the change
// (Engineer guardrail 4). Hand-writing types that mirror the database is banned:
// it is how a column that says non-null and a type that says nullable drift apart.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.15" }
  public: {
    Tables: {
      accounts: {
        Row: {
          as_of: string | null
          cash_balance: number
          created_at: string
          custodian: string
          custodian_account_id: string
          display_name: string
          firm_id: string
          household_id: string
          id: string
          tax_treatment: Database["public"]["Enums"]["account_tax_treatment"]
        }
        Insert: {
          as_of?: string | null
          cash_balance?: number
          created_at?: string
          custodian: string
          custodian_account_id: string
          display_name: string
          firm_id: string
          household_id: string
          id?: string
          tax_treatment: Database["public"]["Enums"]["account_tax_treatment"]
        }
        Update: {
          as_of?: string | null
          cash_balance?: number
          created_at?: string
          custodian?: string
          custodian_account_id?: string
          display_name?: string
          firm_id?: string
          household_id?: string
          id?: string
          tax_treatment?: Database["public"]["Enums"]["account_tax_treatment"]
        }
        Relationships: [
          {
            foreignKeyName: "accounts_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_profiles: {
        Row: {
          created_at: string
          email: string
          firm_id: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["advisor_role"]
        }
        Insert: {
          created_at?: string
          email: string
          firm_id: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["advisor_role"]
        }
        Update: {
          created_at?: string
          email?: string
          firm_id?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["advisor_role"]
        }
        Relationships: [
          {
            foreignKeyName: "advisor_profiles_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          firm_id: string
          household_id: string
          id: string
          mandate_id: string
          started_at: string
          status: Database["public"]["Enums"]["run_status"]
          trigger: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          firm_id: string
          household_id: string
          id?: string
          mandate_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          trigger: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          firm_id?: string
          household_id?: string
          id?: string
          mandate_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_steps: {
        Row: {
          agent: string
          id: string
          input: Json | null
          latency_ms: number | null
          model: string | null
          output: Json | null
          run_id: string
          seq: number
          started_at: string
          step_type: string
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          agent: string
          id?: string
          input?: Json | null
          latency_ms?: number | null
          model?: string | null
          output?: Json | null
          run_id: string
          seq: number
          started_at?: string
          step_type: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          agent?: string
          id?: string
          input?: Json | null
          latency_ms?: number | null
          model?: string | null
          output?: Json | null
          run_id?: string
          seq?: number
          started_at?: string
          step_type?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      aggregator_connections: {
        Row: {
          created_at: string
          external_id: string | null
          firm_id: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          status: Database["public"]["Enums"]["aggregator_status"]
          vendor: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          firm_id: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          status?: Database["public"]["Enums"]["aggregator_status"]
          vendor: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          firm_id?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          status?: Database["public"]["Enums"]["aggregator_status"]
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "aggregator_connections_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_ledger: {
        Row: {
          actor_id: string | null
          actor_type: string
          agent_identity: string | null
          data_sources: Json
          event_type: string
          firm_id: string
          household_id: string | null
          id: number
          occurred_at: string
          payload: Json
          prev_hash: string
          row_hash: string
          seq: number
          subject_id: string | null
          subject_type: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          agent_identity?: string | null
          data_sources?: Json
          event_type: string
          firm_id: string
          household_id?: string | null
          id?: number
          occurred_at?: string
          payload: Json
          prev_hash: string
          row_hash: string
          seq: number
          subject_id?: string | null
          subject_type?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          agent_identity?: string | null
          data_sources?: Json
          event_type?: string
          firm_id?: string
          household_id?: string | null
          id?: number
          occurred_at?: string
          payload?: Json
          prev_hash?: string
          row_hash?: string
          seq?: number
          subject_id?: string | null
          subject_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_ledger_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_ledger_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          crd_number: string | null
          created_at: string
          id: string
          name: string
          shadow_mode: boolean
        }
        Insert: {
          crd_number?: string | null
          created_at?: string
          id?: string
          name: string
          shadow_mode?: boolean
        }
        Update: {
          crd_number?: string | null
          created_at?: string
          id?: string
          name?: string
          shadow_mode?: boolean
        }
        Relationships: []
      }
      households: {
        Row: {
          created_at: string
          firm_id: string
          id: string
          name: string
          primary_advisor_id: string | null
        }
        Insert: {
          created_at?: string
          firm_id: string
          id?: string
          name: string
          primary_advisor_id?: string | null
        }
        Update: {
          created_at?: string
          firm_id?: string
          id?: string
          name?: string
          primary_advisor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "households_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "households_primary_advisor_id_fkey"
            columns: ["primary_advisor_id"]
            isOneToOne: false
            referencedRelation: "advisor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mandate_allocations: {
        Row: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          id: string
          mandate_id: string
          max_bps: number
          min_bps: number
          target_bps: number
        }
        Insert: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          id?: string
          mandate_id: string
          max_bps: number
          min_bps: number
          target_bps: number
        }
        Update: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          id?: string
          mandate_id?: string
          max_bps?: number
          min_bps?: number
          target_bps?: number
        }
        Relationships: [
          {
            foreignKeyName: "mandate_allocations_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
        ]
      }
      mandate_autonomy: {
        Row: {
          action: Database["public"]["Enums"]["action_type"]
          id: string
          mandate_id: string
          max_daily_amount: number | null
          max_trade_amount: number | null
          tier: Database["public"]["Enums"]["autonomy_tier"]
        }
        Insert: {
          action: Database["public"]["Enums"]["action_type"]
          id?: string
          mandate_id: string
          max_daily_amount?: number | null
          max_trade_amount?: number | null
          tier?: Database["public"]["Enums"]["autonomy_tier"]
        }
        Update: {
          action?: Database["public"]["Enums"]["action_type"]
          id?: string
          mandate_id?: string
          max_daily_amount?: number | null
          max_trade_amount?: number | null
          tier?: Database["public"]["Enums"]["autonomy_tier"]
        }
        Relationships: [
          {
            foreignKeyName: "mandate_autonomy_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
        ]
      }
      mandate_constraints: {
        Row: {
          id: string
          kind: Database["public"]["Enums"]["constraint_kind"]
          limit_bps: number | null
          mandate_id: string
          note: string | null
          sector: string | null
          security_id: string | null
        }
        Insert: {
          id?: string
          kind: Database["public"]["Enums"]["constraint_kind"]
          limit_bps?: number | null
          mandate_id: string
          note?: string | null
          sector?: string | null
          security_id?: string | null
        }
        Update: {
          id?: string
          kind?: Database["public"]["Enums"]["constraint_kind"]
          limit_bps?: number | null
          mandate_id?: string
          note?: string | null
          sector?: string | null
          security_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mandate_constraints_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandate_constraints_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      mandates: {
        Row: {
          created_at: string
          created_by: string
          drift_tolerance_bps: number
          firm_id: string
          household_id: string
          id: string
          liquidity_by: string | null
          liquidity_need: number
          max_drawdown_bps: number | null
          min_cash_bps: number
          min_trade_amount: number
          objective: string
          price_staleness_hours: number
          published_at: string | null
          published_by: string | null
          realized_gain_budget: number | null
          rebalance_trigger: Database["public"]["Enums"]["rebalance_trigger"]
          risk_target: number
          status: Database["public"]["Enums"]["mandate_status"]
          superseded_at: string | null
          tax_sensitivity: Database["public"]["Enums"]["tax_sensitivity"]
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          drift_tolerance_bps?: number
          firm_id: string
          household_id: string
          id?: string
          liquidity_by?: string | null
          liquidity_need?: number
          max_drawdown_bps?: number | null
          min_cash_bps?: number
          min_trade_amount?: number
          objective?: string
          price_staleness_hours?: number
          published_at?: string | null
          published_by?: string | null
          realized_gain_budget?: number | null
          rebalance_trigger?: Database["public"]["Enums"]["rebalance_trigger"]
          risk_target?: number
          status?: Database["public"]["Enums"]["mandate_status"]
          superseded_at?: string | null
          tax_sensitivity?: Database["public"]["Enums"]["tax_sensitivity"]
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string
          drift_tolerance_bps?: number
          firm_id?: string
          household_id?: string
          id?: string
          liquidity_by?: string | null
          liquidity_need?: number
          max_drawdown_bps?: number | null
          min_cash_bps?: number
          min_trade_amount?: number
          objective?: string
          price_staleness_hours?: number
          published_at?: string | null
          published_by?: string | null
          realized_gain_budget?: number | null
          rebalance_trigger?: Database["public"]["Enums"]["rebalance_trigger"]
          risk_target?: number
          status?: Database["public"]["Enums"]["mandate_status"]
          superseded_at?: string | null
          tax_sensitivity?: Database["public"]["Enums"]["tax_sensitivity"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "mandates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "advisor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "advisor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      observations: {
        Row: {
          asset_class: Database["public"]["Enums"]["asset_class"] | null
          detail: Json
          detected_at: string
          firm_id: string
          household_id: string
          id: string
          kind: Database["public"]["Enums"]["observation_kind"]
          run_id: string
          security_id: string | null
          severity: Database["public"]["Enums"]["severity"]
        }
        Insert: {
          asset_class?: Database["public"]["Enums"]["asset_class"] | null
          detail: Json
          detected_at?: string
          firm_id: string
          household_id: string
          id?: string
          kind: Database["public"]["Enums"]["observation_kind"]
          run_id: string
          security_id?: string | null
          severity: Database["public"]["Enums"]["severity"]
        }
        Update: {
          asset_class?: Database["public"]["Enums"]["asset_class"] | null
          detail?: Json
          detected_at?: string
          firm_id?: string
          household_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["observation_kind"]
          run_id?: string
          security_id?: string | null
          severity?: Database["public"]["Enums"]["severity"]
        }
        Relationships: [
          {
            foreignKeyName: "observations_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          account_id: string
          as_of: string
          cost_basis: number
          created_at: string
          firm_id: string
          id: string
          market_value: number
          quantity: number
          security_id: string
        }
        Insert: {
          account_id: string
          as_of: string
          cost_basis: number
          created_at?: string
          firm_id: string
          id?: string
          market_value: number
          quantity: number
          security_id: string
        }
        Update: {
          account_id?: string
          as_of?: string
          cost_basis?: number
          created_at?: string
          firm_id?: string
          id?: string
          market_value?: number
          quantity?: number
          security_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_legs: {
        Row: {
          account_id: string
          est_amount: number
          est_price: number
          id: string
          quantity: number
          recommendation_id: string
          security_id: string
          seq: number
          side: string
          superseded: boolean
          tax_lot_id: string | null
        }
        Insert: {
          account_id: string
          est_amount: number
          est_price: number
          id?: string
          quantity: number
          recommendation_id: string
          security_id: string
          seq: number
          side: string
          superseded?: boolean
          tax_lot_id?: string | null
        }
        Update: {
          account_id?: string
          est_amount?: number
          est_price?: number
          id?: string
          quantity?: number
          recommendation_id?: string
          security_id?: string
          seq?: number
          side?: string
          superseded?: boolean
          tax_lot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_legs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_legs_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_legs_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_legs_tax_lot_id_fkey"
            columns: ["tax_lot_id"]
            isOneToOne: false
            referencedRelation: "tax_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          action: Database["public"]["Enums"]["action_type"]
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          expires_at: string
          firm_id: string
          guardrail_result: Json
          household_id: string
          id: string
          mandate_id: string
          projected_drift_bps_after: number
          projected_drift_bps_before: number
          projected_realized_gain: number
          projected_tax_cost: number
          provenance: Json
          rank: number
          rationale: string
          run_id: string
          stale_data: boolean
          status: Database["public"]["Enums"]["recommendation_status"]
        }
        Insert: {
          action: Database["public"]["Enums"]["action_type"]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          expires_at: string
          firm_id: string
          guardrail_result: Json
          household_id: string
          id?: string
          mandate_id: string
          projected_drift_bps_after: number
          projected_drift_bps_before: number
          projected_realized_gain?: number
          projected_tax_cost?: number
          provenance: Json
          rank: number
          rationale: string
          run_id: string
          stale_data?: boolean
          status?: Database["public"]["Enums"]["recommendation_status"]
        }
        Update: {
          action?: Database["public"]["Enums"]["action_type"]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          expires_at?: string
          firm_id?: string
          guardrail_result?: Json
          household_id?: string
          id?: string
          mandate_id?: string
          projected_drift_bps_after?: number
          projected_drift_bps_before?: number
          projected_realized_gain?: number
          projected_tax_cost?: number
          provenance?: Json
          rank?: number
          rationale?: string
          run_id?: string
          stale_data?: boolean
          status?: Database["public"]["Enums"]["recommendation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "advisor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      securities: {
        Row: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          created_at: string
          cusip: string | null
          id: string
          is_etf: boolean
          name: string
          sector: string | null
          symbol: string
        }
        Insert: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          created_at?: string
          cusip?: string | null
          id?: string
          is_etf?: boolean
          name: string
          sector?: string | null
          symbol: string
        }
        Update: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          created_at?: string
          cusip?: string | null
          id?: string
          is_etf?: boolean
          name?: string
          sector?: string | null
          symbol?: string
        }
        Relationships: []
      }
      security_prices: {
        Row: {
          close_price: number
          fetched_at: string
          price_date: string
          security_id: string
          source: string
        }
        Insert: {
          close_price: number
          fetched_at?: string
          price_date: string
          security_id: string
          source: string
        }
        Update: {
          close_price?: number
          fetched_at?: string
          price_date?: string
          security_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_prices_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_lots: {
        Row: {
          account_id: string
          as_of: string
          cost_basis: number
          custodian_lot_id: string | null
          firm_id: string
          id: string
          open_date: string
          quantity: number
          security_id: string
        }
        Insert: {
          account_id: string
          as_of: string
          cost_basis: number
          custodian_lot_id?: string | null
          firm_id: string
          id?: string
          open_date: string
          quantity: number
          security_id: string
        }
        Update: {
          account_id?: string
          as_of?: string
          cost_basis?: number
          custodian_lot_id?: string | null
          firm_id?: string
          id?: string
          open_date?: string
          quantity?: number
          security_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_lots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_lots_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_lots_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          custodian_txn_id: string | null
          firm_id: string
          id: string
          price: number | null
          quantity: number | null
          security_id: string | null
          settle_date: string | null
          trade_date: string
          txn_type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          custodian_txn_id?: string | null
          firm_id: string
          id?: string
          price?: number | null
          quantity?: number | null
          security_id?: string | null
          settle_date?: string | null
          trade_date: string
          txn_type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          custodian_txn_id?: string | null
          firm_id?: string
          id?: string
          price?: number | null
          quantity?: number | null
          security_id?: string | null
          settle_date?: string | null
          trade_date?: string
          txn_type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      can_write: { Args: never; Returns: boolean }
      current_advisor_role: { Args: never; Returns: Database["public"]["Enums"]["advisor_role"] }
      current_firm_id: { Args: never; Returns: string }
      is_principal: { Args: never; Returns: boolean }
    }
    Enums: {
      account_tax_treatment:
        | "taxable" | "traditional_ira" | "roth_ira" | "employer_401k" | "trust" | "other"
      action_type:
        | "rebalance_trade" | "tax_loss_harvest" | "cash_raise" | "cash_invest" | "alert_only"
      advisor_role: "principal" | "advisor" | "readonly"
      aggregator_status: "pending" | "connected" | "error" | "revoked"
      asset_class:
        | "us_equity" | "intl_developed_equity" | "emerging_equity" | "us_bond" | "intl_bond"
        | "real_assets" | "cash" | "other"
      autonomy_tier: "observe" | "propose" | "auto_execute"
      constraint_kind:
        | "prohibited_security" | "prohibited_sector" | "concentration_cap" | "hold_minimum"
      mandate_status: "draft" | "published" | "superseded"
      observation_kind:
        | "allocation_drift" | "risk_breach" | "cash_event" | "tax_opportunity"
        | "constraint_violation"
      rebalance_trigger: "band" | "calendar" | "both"
      recommendation_status:
        | "pending" | "approved" | "rejected" | "modified_approved" | "expired" | "auto_executed"
      run_status: "running" | "complete" | "failed"
      severity: "info" | "warning" | "critical"
      tax_sensitivity: "none" | "moderate" | "high"
      transaction_type:
        | "buy" | "sell" | "dividend" | "interest" | "deposit" | "withdrawal" | "fee"
        | "transfer_in" | "transfer_out"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]
