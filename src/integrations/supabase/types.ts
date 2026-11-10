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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      allocations: {
        Row: {
          hours_per_week: number
          id: string
          section: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          hours_per_week?: number
          id?: string
          section?: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          hours_per_week?: number
          id?: string
          section?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocations_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string | null
          body: string
          created_at: string | null
          department_id: string | null
          id: string
          title: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string | null
          department_id?: string | null
          id?: string
          title: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string | null
          department_id?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          allocation_id: string
          class_date: string
          created_at: string | null
          id: string
          present_count: number
          total_students: number
        }
        Insert: {
          allocation_id: string
          class_date?: string
          created_at?: string | null
          id?: string
          present_count: number
          total_students: number
        }
        Update: {
          allocation_id?: string
          class_date?: string
          created_at?: string | null
          id?: string
          present_count?: number
          total_students?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      dept_requests: {
        Row: {
          body: string
          created_at: string | null
          department_id: string | null
          id: string
          review_note: string | null
          reviewed_by: string | null
          status: string
          teacher_id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string | null
          department_id?: string | null
          id?: string
          review_note?: string | null
          reviewed_by?: string | null
          status?: string
          teacher_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string | null
          department_id?: string | null
          id?: string
          review_note?: string | null
          reviewed_by?: string | null
          status?: string
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "dept_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dept_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dept_requests_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faculty_attendance: {
        Row: {
          id: string
          status: string
          teacher_id: string
          work_date: string
        }
        Insert: {
          id?: string
          status?: string
          teacher_id: string
          work_date?: string
        }
        Update: {
          id?: string
          status?: string
          teacher_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "faculty_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string | null
          department_id: string | null
          end_date: string
          id: string
          leave_type: string
          reason: string
          review_note: string | null
          reviewed_by: string | null
          start_date: string
          status: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          department_id?: string | null
          end_date: string
          id?: string
          leave_type?: string
          reason?: string
          review_note?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          department_id?: string | null
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string
          review_note?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marks: {
        Row: {
          allocation_id: string
          created_at: string | null
          exam_name: string
          id: string
          marks_obtained: number
          max_marks: number
          student_roll: string
        }
        Insert: {
          allocation_id: string
          created_at?: string | null
          exam_name: string
          id?: string
          marks_obtained: number
          max_marks?: number
          student_roll: string
        }
        Update: {
          allocation_id?: string
          created_at?: string | null
          exam_name?: string
          id?: string
          marks_obtained?: number
          max_marks?: number
          student_roll?: string
        }
        Relationships: [
          {
            foreignKeyName: "marks_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          blood_group: string | null
          created_at: string | null
          date_of_birth: string | null
          date_of_joining: string | null
          department_id: string | null
          designation: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          experience_years: number | null
          full_name: string
          gender: string | null
          id: string
          personal_email: string | null
          phone: string | null
          qualification: string | null
        }
        Insert: {
          address?: string | null
          blood_group?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          date_of_joining?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          experience_years?: number | null
          full_name?: string
          gender?: string | null
          id: string
          personal_email?: string | null
          phone?: string | null
          qualification?: string | null
        }
        Update: {
          address?: string | null
          blood_group?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          date_of_joining?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          experience_years?: number | null
          full_name?: string
          gender?: string | null
          id?: string
          personal_email?: string | null
          phone?: string | null
          qualification?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          allocation_id: string
          day_of_week: number
          end_time: string
          id: string
          room: string | null
          start_time: string
        }
        Insert: {
          allocation_id: string
          day_of_week: number
          end_time: string
          id?: string
          room?: string | null
          start_time: string
        }
        Update: {
          allocation_id?: string
          day_of_week?: number
          end_time?: string
          id?: string
          room?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          credits: number
          department_id: string
          id: string
          name: string
          semester: number
        }
        Insert: {
          code: string
          credits?: number
          department_id: string
          id?: string
          name: string
          semester?: number
        }
        Update: {
          code?: string
          credits?: number
          department_id?: string
          id?: string
          name?: string
          semester?: number
        }
        Relationships: [
          {
            foreignKeyName: "subjects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      alloc_teacher: { Args: { _a: string }; Returns: string }
      dept_of: { Args: { _uid: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_dept: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "hod" | "teacher"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "hod", "teacher"],
    },
  },
} as const
