export type AppRole = 'doctor' | 'secretary' | 'super_admin' | 'clinic_manager'

export type UserProfile = {
  id: string
  tenant_id: string | null
  full_name: string
  email: string
  role: AppRole
}

export type Tenant = {
  id: string
  name: string
  logo_url: string | null
  address: string | null
  phone: string | null
  working_hours: Record<string, unknown> | null
  default_language: 'ar' | 'en'
  print_format: 'a4' | 'thermal' | 'both'
  subscription_plan: 'starter' | 'professional' | 'enterprise'
  consultation_fee: number | null
  follow_up_fee?: number | null
  tax_rate: number | null
  trial_ends_at: string | null
  created_at: string
  specialty?: string | null
  stamp_url?: string | null
  doctor_signature_url?: string | null
}

export type Patient = {
  id: string
  tenant_id: string
  full_name: string
  phone: string | null
  national_id: string | null
  birth_date: string | null
  gender: 'male' | 'female' | 'other' | null
  occupation: string | null
  address: string | null
  marital_status: string | null
  blood_type: string | null
  insurance_provider: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  file_number: number
  created_at: string
}

export type MedicalHistory = {
  id: string
  patient_id: string
  tenant_id: string
  chronic_diseases: string | null
  surgeries: string | null
  allergies: string | null
  hereditary_diseases: string | null
  smoking: boolean | null
  alcohol: boolean | null
  pregnancy_status: string | null
  vaccinations: unknown
  updated_at: string
}

export type VitalSign = {
  id: string
  patient_id: string
  tenant_id: string
  visit_id: string | null
  blood_pressure: string | null
  blood_sugar: string | null
  weight: number | null
  height: number | null
  temperature: number | null
  pulse: number | null
  oxygen_saturation: number | null
  recorded_at: string
}

export type Visit = {
  id: string
  tenant_id: string
  patient_id: string
  doctor_id: string | null
  visit_date: string
  chief_complaint: string | null
  history_of_present_illness: string | null
  clinical_exam: string | null
  diagnosis: string | null
  treatment_plan: string | null
  notes: string | null
  follow_up_date: string | null
  status: string
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      users: { Row: UserProfile; Insert: Partial<UserProfile>; Update: Partial<UserProfile> }
      tenants: { Row: Tenant; Insert: Partial<Tenant>; Update: Partial<Tenant> }
      patients: {
        Row: Patient
        Insert: Partial<Omit<Patient, 'id' | 'file_number' | 'created_at'>> & {
          tenant_id: string
          full_name: string
        }
        Update: Partial<Patient>
      }
      medical_history: {
        Row: MedicalHistory
        Insert: Partial<MedicalHistory> & { patient_id: string; tenant_id: string }
        Update: Partial<MedicalHistory>
      }
      vital_signs: {
        Row: VitalSign
        Insert: Partial<VitalSign> & { patient_id: string; tenant_id: string }
        Update: Partial<VitalSign>
      }
      visits: { Row: Visit; Insert: Partial<Visit>; Update: Partial<Visit> }
      audit_log: {
        Row: {
          id: string
          tenant_id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          meta: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          tenant_id: string
          user_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          meta?: Record<string, unknown>
        }
        Update: Record<string, unknown>
      }
    }
    Functions: {
      onboard_clinic: {
        Args: {
          p_clinic_name: string
          p_full_name: string
          p_default_language?: string
          p_print_format?: string
          p_phone?: string | null
          p_address?: string | null
          p_trial_days?: number
        }
        Returns: Record<string, unknown>
      }
    }
  }
}
