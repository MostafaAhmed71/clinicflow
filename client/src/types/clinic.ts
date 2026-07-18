export type Attachment = {
  id: string
  tenant_id: string
  patient_id: string
  visit_id: string | null
  file_url: string
  file_type: 'image' | 'pdf' | 'lab' | 'radiology' | 'report'
  uploaded_at: string
}

export type Appointment = {
  id: string
  tenant_id: string
  patient_id: string
  doctor_id: string | null
  scheduled_at: string
  duration_minutes: number
  status: 'waiting' | 'with_doctor' | 'done' | 'no_show' | 'cancelled'
  payment_status?: 'unpaid' | 'paid' | 'waived'
  visit_kind?: 'new_visit' | 'follow_up'
  fee_amount?: number | null
  visit_id?: string | null
  created_at: string
  patients?: { full_name: string; phone: string | null; file_number: number } | null
}

export type Prescription = {
  id: string
  tenant_id: string
  visit_id: string
  template_id: string | null
  created_at: string
}

export type PrescriptionItem = {
  id: string
  prescription_id: string
  drug_name: string
  dosage: string | null
  duration: string | null
  notes: string | null
}

export type PrescriptionTemplate = {
  id: string
  tenant_id: string
  doctor_id: string | null
  name: string
  items: { drug_name: string; dosage?: string; duration?: string; notes?: string }[]
  created_at: string
}
