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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      cities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_schedules: {
        Row: {
          code: number
          created_at: string
          created_by: string | null
          driver_id: string | null
          driver_user_id: string | null
          id: string
          observations: string | null
          schedule_date: string
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          code?: number
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          driver_user_id?: string | null
          id?: string
          observations?: string | null
          schedule_date: string
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          code?: number
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          driver_user_id?: string | null
          id?: string
          observations?: string | null
          schedule_date?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedules_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedules_driver_user_id_fkey"
            columns: ["driver_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_schedules_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      destinations: {
        Row: {
          address: string | null
          city: string | null
          city_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          place_type: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          city_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          place_type?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          city_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          place_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "destinations_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          address: string | null
          address_number: string | null
          birth_date: string | null
          city: string | null
          cnh_categories: string[]
          cnh_expires_at: string | null
          cnh_first_at: string | null
          cnh_issued_at: string | null
          cnh_notes: string | null
          complement: string | null
          cpf: string | null
          created_at: string
          district: string | null
          driver_type: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          is_authorized: boolean
          license_category: string | null
          license_number: string | null
          mobile: string | null
          notes: string | null
          phone: string | null
          profile_id: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          birth_date?: string | null
          city?: string | null
          cnh_categories?: string[]
          cnh_expires_at?: string | null
          cnh_first_at?: string | null
          cnh_issued_at?: string | null
          cnh_notes?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          district?: string | null
          driver_type?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          is_authorized?: boolean
          license_category?: string | null
          license_number?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_number?: string | null
          birth_date?: string | null
          city?: string | null
          cnh_categories?: string[]
          cnh_expires_at?: string | null
          cnh_first_at?: string | null
          cnh_issued_at?: string | null
          cnh_notes?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          district?: string | null
          driver_type?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_authorized?: boolean
          license_category?: string | null
          license_number?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_records: {
        Row: {
          created_at: string
          filled_at: string
          id: string
          liters: number | null
          notes: string | null
          odometer: number | null
          station: string | null
          total_cost: number | null
          unit_price: number | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          filled_at?: string
          id?: string
          liters?: number | null
          notes?: string | null
          odometer?: number | null
          station?: string | null
          total_cost?: number | null
          unit_price?: number | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          filled_at?: string
          id?: string
          liters?: number | null
          notes?: string | null
          odometer?: number | null
          station?: string | null
          total_cost?: number | null
          unit_price?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          title: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_history: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          field_changed: string | null
          id: string
          new_value: string | null
          old_value: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_history_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          address_number: string | null
          birth_date: string | null
          city: string | null
          cnh_categories: string[]
          cnh_expires_at: string | null
          cnh_first_at: string | null
          cnh_issued_at: string | null
          cnh_notes: string | null
          cnh_number: string | null
          complement: string | null
          cpf: string | null
          created_at: string
          district: string | null
          full_name: string
          id: string
          is_active: boolean
          is_coordinator: boolean
          is_sre_driver: boolean
          mobile: string | null
          phone: string | null
          registration: string | null
          sector: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          birth_date?: string | null
          city?: string | null
          cnh_categories?: string[]
          cnh_expires_at?: string | null
          cnh_first_at?: string | null
          cnh_issued_at?: string | null
          cnh_notes?: string | null
          cnh_number?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          district?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          is_coordinator?: boolean
          is_sre_driver?: boolean
          mobile?: string | null
          phone?: string | null
          registration?: string | null
          sector?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_number?: string | null
          birth_date?: string | null
          city?: string | null
          cnh_categories?: string[]
          cnh_expires_at?: string | null
          cnh_first_at?: string | null
          cnh_issued_at?: string | null
          cnh_notes?: string | null
          cnh_number?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          district?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          is_coordinator?: boolean
          is_sre_driver?: boolean
          mobile?: string | null
          phone?: string | null
          registration?: string | null
          sector?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      ride_requests: {
        Row: {
          created_at: string
          decision_note: string | null
          id: string
          reason: string | null
          requester_id: string
          seats: number
          status: Database["public"]["Enums"]["ride_status"]
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision_note?: string | null
          id?: string
          reason?: string | null
          requester_id: string
          seats?: number
          status?: Database["public"]["Enums"]["ride_status"]
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision_note?: string | null
          id?: string
          reason?: string | null
          requester_id?: string
          seats?: number
          status?: Database["public"]["Enums"]["ride_status"]
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_assignments: {
        Row: {
          actual_arrival: string | null
          actual_departure: string | null
          created_at: string
          created_by: string | null
          destination_city_id: string | null
          destination_id: string | null
          destination_text: string
          id: string
          notes: string | null
          order_index: number
          origin_city_id: string | null
          origin_destination_id: string | null
          origin_text: string
          passengers: number
          passengers_names: string | null
          requested_at: string | null
          schedule_id: string
          scheduled_arrival: string
          scheduled_departure: string
          segment_type: Database["public"]["Enums"]["segment_type"]
          status: Database["public"]["Enums"]["assignment_status"]
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          actual_arrival?: string | null
          actual_departure?: string | null
          created_at?: string
          created_by?: string | null
          destination_city_id?: string | null
          destination_id?: string | null
          destination_text?: string
          id?: string
          notes?: string | null
          order_index?: number
          origin_city_id?: string | null
          origin_destination_id?: string | null
          origin_text?: string
          passengers?: number
          passengers_names?: string | null
          requested_at?: string | null
          schedule_id: string
          scheduled_arrival: string
          scheduled_departure: string
          segment_type?: Database["public"]["Enums"]["segment_type"]
          status?: Database["public"]["Enums"]["assignment_status"]
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_arrival?: string | null
          actual_departure?: string | null
          created_at?: string
          created_by?: string | null
          destination_city_id?: string | null
          destination_id?: string | null
          destination_text?: string
          id?: string
          notes?: string | null
          order_index?: number
          origin_city_id?: string | null
          origin_destination_id?: string | null
          origin_text?: string
          passengers?: number
          passengers_names?: string | null
          requested_at?: string | null
          schedule_id?: string
          scheduled_arrival?: string
          scheduled_departure?: string
          segment_type?: Database["public"]["Enums"]["segment_type"]
          status?: Database["public"]["Enums"]["assignment_status"]
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_destination_city_id_fkey"
            columns: ["destination_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_origin_city_id_fkey"
            columns: ["origin_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_origin_destination_id_fkey"
            columns: ["origin_destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "daily_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_history: {
        Row: {
          action: string
          assignment_id: string | null
          created_at: string
          field_changed: string | null
          id: string
          new_value: string | null
          old_value: string | null
          schedule_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          assignment_id?: string | null
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          schedule_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          assignment_id?: string | null
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          schedule_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_history_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "schedule_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_history_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "daily_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_incidents: {
        Row: {
          assignment_id: string | null
          created_at: string
          description: string
          id: string
          kind: string
          schedule_id: string
          user_id: string | null
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          description: string
          id?: string
          kind?: string
          schedule_id: string
          user_id?: string | null
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: string
          schedule_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_incidents_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "schedule_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_incidents_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "daily_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_history: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: string | null
          id: string
          trip_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          trip_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_history_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_requests: {
        Row: {
          admin_notes: string | null
          allows_rides: boolean
          assigned_driver_user_id: string | null
          city_id: string | null
          city_text: string | null
          code: number
          created_at: string
          departure_at: string
          destination_id: string | null
          destination_text: string
          driver_id: string | null
          id: string
          needs_sre_driver: boolean
          occupants_names: string | null
          passengers: number
          period: unknown
          purpose: string
          pw_number: string | null
          pw_registered_at: string | null
          rejection_reason: string | null
          requested_driver_id: string | null
          requester_id: string | null
          requester_name: string | null
          requester_notes: string | null
          return_at: string
          status: Database["public"]["Enums"]["trip_status"]
          suggested_driver: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          allows_rides?: boolean
          assigned_driver_user_id?: string | null
          city_id?: string | null
          city_text?: string | null
          code?: number
          created_at?: string
          departure_at: string
          destination_id?: string | null
          destination_text: string
          driver_id?: string | null
          id?: string
          needs_sre_driver?: boolean
          occupants_names?: string | null
          passengers?: number
          period?: unknown
          purpose: string
          pw_number?: string | null
          pw_registered_at?: string | null
          rejection_reason?: string | null
          requested_driver_id?: string | null
          requester_id?: string | null
          requester_name?: string | null
          requester_notes?: string | null
          return_at: string
          status?: Database["public"]["Enums"]["trip_status"]
          suggested_driver?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          allows_rides?: boolean
          assigned_driver_user_id?: string | null
          city_id?: string | null
          city_text?: string | null
          code?: number
          created_at?: string
          departure_at?: string
          destination_id?: string | null
          destination_text?: string
          driver_id?: string | null
          id?: string
          needs_sre_driver?: boolean
          occupants_names?: string | null
          passengers?: number
          period?: unknown
          purpose?: string
          pw_number?: string | null
          pw_registered_at?: string | null
          rejection_reason?: string | null
          requested_driver_id?: string | null
          requester_id?: string | null
          requester_name?: string | null
          requester_notes?: string | null
          return_at?: string
          status?: Database["public"]["Enums"]["trip_status"]
          suggested_driver?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_requests_assigned_driver_user_id_fkey"
            columns: ["assigned_driver_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_requested_driver_id_fkey"
            columns: ["requested_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_stops: {
        Row: {
          city_id: string | null
          city_text: string | null
          created_at: string
          destination_id: string | null
          id: string
          place_text: string | null
          position: number
          trip_id: string
          updated_at: string
        }
        Insert: {
          city_id?: string | null
          city_text?: string | null
          created_at?: string
          destination_id?: string | null
          id?: string
          place_text?: string | null
          position?: number
          trip_id: string
          updated_at?: string
        }
        Update: {
          city_id?: string | null
          city_text?: string | null
          created_at?: string
          destination_id?: string | null
          id?: string
          place_text?: string | null
          position?: number
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_stops_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_stops_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_stops_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_requests"
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
          role: Database["public"]["Enums"]["app_role"]
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
      vehicle_blocks: {
        Row: {
          block_type: Database["public"]["Enums"]["block_type"]
          city: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          ends_at: string
          expected_return_at: string | null
          finished_at: string | null
          id: string
          is_open: boolean
          notes: string | null
          odometer_in: number | null
          odometer_out: number | null
          period: unknown
          reason: string | null
          service_done: string | null
          starts_at: string
          updated_at: string
          vehicle_id: string
          workshop: string | null
        }
        Insert: {
          block_type: Database["public"]["Enums"]["block_type"]
          city?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          expected_return_at?: string | null
          finished_at?: string | null
          id?: string
          is_open?: boolean
          notes?: string | null
          odometer_in?: number | null
          odometer_out?: number | null
          period?: unknown
          reason?: string | null
          service_done?: string | null
          starts_at: string
          updated_at?: string
          vehicle_id: string
          workshop?: string | null
        }
        Update: {
          block_type?: Database["public"]["Enums"]["block_type"]
          city?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          expected_return_at?: string | null
          finished_at?: string | null
          id?: string
          is_open?: boolean
          notes?: string | null
          odometer_in?: number | null
          odometer_out?: number | null
          period?: unknown
          reason?: string | null
          service_done?: string | null
          starts_at?: string
          updated_at?: string
          vehicle_id?: string
          workshop?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_blocks_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          asset_number: string | null
          base_status: Database["public"]["Enums"]["vehicle_status"]
          capacity: number
          created_at: string
          fuel: string | null
          id: string
          is_active: boolean
          manufacturer: string
          model: string
          notes: string | null
          odometer: number
          photo_url: string | null
          plate: string
          updated_at: string
          vehicle_type: string | null
          year: number | null
        }
        Insert: {
          asset_number?: string | null
          base_status?: Database["public"]["Enums"]["vehicle_status"]
          capacity?: number
          created_at?: string
          fuel?: string | null
          id?: string
          is_active?: boolean
          manufacturer: string
          model: string
          notes?: string | null
          odometer?: number
          photo_url?: string | null
          plate: string
          updated_at?: string
          vehicle_type?: string | null
          year?: number | null
        }
        Update: {
          asset_number?: string | null
          base_status?: Database["public"]["Enums"]["vehicle_status"]
          capacity?: number
          created_at?: string
          fuel?: string | null
          id?: string
          is_active?: boolean
          manufacturer?: string
          model?: string
          notes?: string | null
          odometer?: number
          photo_url?: string | null
          plate?: string
          updated_at?: string
          vehicle_type?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      driver_user_busy: {
        Args: {
          _end: string
          _exclude_trip?: string
          _start: string
          _user_id: string
        }
        Returns: {
          code: number
          departure_at: string
          destination_text: string
          return_at: string
          trip_id: string
        }[]
      }
      fleet_availability: {
        Args: { p_end: string; p_passengers?: number; p_start: string }
        Returns: {
          capacity: number
          conflict_end: string
          conflict_start: string
          detail: string
          fuel: string
          is_available: boolean
          manufacturer: string
          model: string
          photo_url: string
          plate: string
          reason: string
          vehicle_id: string
        }[]
      }
      fleet_now: {
        Args: never
        Returns: {
          capacity: number
          detail: string
          manufacturer: string
          model: string
          next_trip_at: string
          next_trip_dest: string
          photo_url: string
          plate: string
          status: string
          until_at: string
          vehicle_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_coordinator_of: {
        Args: { _sector: string; _user_id: string }
        Returns: boolean
      }
      is_schedule_driver: {
        Args: { _schedule_id: string; _user_id: string }
        Returns: boolean
      }
      is_sre_driver: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      notify_users: {
        Args: {
          _body: string
          _title: string
          _trip_id?: string
          _user_ids: string[]
        }
        Returns: number
      }
      profile_sector: { Args: { _user_id: string }; Returns: string }
      schedule_conflicts: {
        Args: {
          _driver_id: string
          _driver_user_id: string
          _end: string
          _exclude_assignment?: string
          _start: string
          _vehicle_id: string
        }
        Returns: {
          assignment_id: string
          ends_at: string
          kind: string
          label: string
          schedule_code: number
          schedule_id: string
          starts_at: string
        }[]
      }
      set_user_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      suggest_free_slot: {
        Args: {
          _driver_id: string
          _driver_user_id: string
          _end: string
          _exclude_assignment?: string
          _start: string
          _vehicle_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "servidor" | "super_admin"
      assignment_status:
        | "PENDENTE"
        | "PROGRAMADO"
        | "EM_ANDAMENTO"
        | "CONCLUIDO"
        | "NAO_REALIZADO"
        | "CANCELADO"
      block_type: "MANUTENCAO" | "INDISPONIVEL"
      ride_status: "PENDENTE" | "APROVADA" | "REJEITADA"
      schedule_status:
        | "RASCUNHO"
        | "PLANEJADA"
        | "PUBLICADA"
        | "EM_EXECUCAO"
        | "CONCLUIDA"
        | "CANCELADA"
      segment_type: "LEVAR" | "BUSCAR" | "DESLOCAMENTO" | "AGUARDAR" | "RETORNO"
      trip_status:
        | "PENDENTE"
        | "CORRECAO"
        | "APROVADA"
        | "PROGRAMADA"
        | "EM_ANDAMENTO"
        | "CONCLUIDA"
        | "REJEITADA"
        | "CANCELADA"
      vehicle_status:
        | "DISPONIVEL"
        | "RESERVADO"
        | "EM_VIAGEM"
        | "EM_MANUTENCAO"
        | "INDISPONIVEL"
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
      app_role: ["admin", "servidor", "super_admin"],
      assignment_status: [
        "PENDENTE",
        "PROGRAMADO",
        "EM_ANDAMENTO",
        "CONCLUIDO",
        "NAO_REALIZADO",
        "CANCELADO",
      ],
      block_type: ["MANUTENCAO", "INDISPONIVEL"],
      ride_status: ["PENDENTE", "APROVADA", "REJEITADA"],
      schedule_status: [
        "RASCUNHO",
        "PLANEJADA",
        "PUBLICADA",
        "EM_EXECUCAO",
        "CONCLUIDA",
        "CANCELADA",
      ],
      segment_type: ["LEVAR", "BUSCAR", "DESLOCAMENTO", "AGUARDAR", "RETORNO"],
      trip_status: [
        "PENDENTE",
        "CORRECAO",
        "APROVADA",
        "PROGRAMADA",
        "EM_ANDAMENTO",
        "CONCLUIDA",
        "REJEITADA",
        "CANCELADA",
      ],
      vehicle_status: [
        "DISPONIVEL",
        "RESERVADO",
        "EM_VIAGEM",
        "EM_MANUTENCAO",
        "INDISPONIVEL",
      ],
    },
  },
} as const
