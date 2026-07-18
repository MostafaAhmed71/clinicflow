import { getSpecialtyPack } from './specialtyPacks'

export type MedicalExamKind =
  | 'lab'
  | 'imaging'
  | 'endoscopy'
  | 'functional'
  | 'biopsy'
  | 'cardiac'
  | 'procedure'

export type MedicalExamCategory = 'lab' | 'radiology' | 'functional' | 'pathology'

export type MedicalExamSpecialty = {
  id: string
  name_ar: string
  name_en: string
  sort_order: number
}

export type MedicalExam = {
  id: string
  specialty_id: string
  exam_kind: MedicalExamKind
  category: MedicalExamCategory
  name_ar: string
  name_en: string
  code: string | null
  requires_fasting: boolean
  result_tat_hours: number | null
  doctor_notes: string | null
  is_active: boolean
  sort_order: number
}

/** Resolve catalog specialty id from clinic/doctor specialty setting */
export function catalogSpecialtyForTenant(tenantSpecialty: string | null | undefined): string {
  return getSpecialtyPack(tenantSpecialty).catalogId
}

export function examDisplayName(exam: MedicalExam, lang: 'ar' | 'en'): string {
  return lang === 'en' ? exam.name_en : exam.name_ar
}

export function examLineLabel(exam: MedicalExam, lang: 'ar' | 'en'): string {
  const name = examDisplayName(exam, lang)
  const tags: string[] = []
  if (exam.requires_fasting) tags.push(lang === 'en' ? 'fasting' : 'صيام')
  if (exam.result_tat_hours != null) {
    tags.push(lang === 'en' ? `~${exam.result_tat_hours}h` : `~${exam.result_tat_hours}س`)
  }
  return tags.length ? `${name} (${tags.join(' · ')})` : name
}

export function filterExamsByCategory(
  exams: MedicalExam[],
  category: MedicalExamCategory | 'all',
): MedicalExam[] {
  if (category === 'all') return exams
  return exams.filter((e) => e.category === category)
}
