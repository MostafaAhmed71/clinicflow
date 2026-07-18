import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import {
  catalogSpecialtyForTenant,
  examDisplayName,
  examLineLabel,
  type MedicalExam,
  type MedicalExamCategory,
  type MedicalExamSpecialty,
} from '../lib/medicalExams'
import { getSpecialtyPack } from '../lib/specialtyPacks'
import { Icon } from './Icon'

type Props = {
  tenantSpecialty?: string | null
  /** Which request box is this for */
  target: 'lab' | 'radiology' | 'functional'
  onPick: (line: string, exam: MedicalExam) => void
  compact?: boolean
}

const TARGET_CATEGORIES: Record<Props['target'], MedicalExamCategory[]> = {
  lab: ['lab', 'pathology'],
  radiology: ['radiology'],
  functional: ['functional'],
}

export function ExamCatalogPicker({ tenantSpecialty, target, onPick, compact }: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'ar'
  const pack = getSpecialtyPack(tenantSpecialty)
  const lockedSpecialtyId = catalogSpecialtyForTenant(tenantSpecialty)

  const [specialties, setSpecialties] = useState<MedicalExamSpecialty[]>([])
  const [specialtyId, setSpecialtyId] = useState(lockedSpecialtyId)
  const [allowOther, setAllowOther] = useState(false)
  const [exams, setExams] = useState<MedicalExam[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    setSpecialtyId(catalogSpecialtyForTenant(tenantSpecialty))
    setAllowOther(false)
  }, [tenantSpecialty])

  useEffect(() => {
    void (async () => {
      const { data, error: err } = await supabase
        .from('medical_exam_specialties')
        .select('id, name_ar, name_en, sort_order')
        .order('sort_order')
      if (err) setError(err.message)
      else setSpecialties((data as MedicalExamSpecialty[]) ?? [])
    })()
  }, [])

  const activeSpecialty = useMemo(
    () => specialties.find((s) => s.id === specialtyId) ?? null,
    [specialties, specialtyId],
  )

  const loadExams = useCallback(async () => {
    setLoading(true)
    setError(null)
    const cats = TARGET_CATEGORIES[target]
    const { data, error: err } = await supabase
      .from('medical_exams')
      .select(
        'id, specialty_id, exam_kind, category, name_ar, name_en, code, requires_fasting, result_tat_hours, doctor_notes, is_active, sort_order',
      )
      .eq('specialty_id', specialtyId)
      .eq('is_active', true)
      .in('category', cats)
      .order('sort_order')
    if (err) setError(err.message)
    else setExams((data as MedicalExam[]) ?? [])
    setLoading(false)
  }, [specialtyId, target])

  useEffect(() => {
    void loadExams()
  }, [loadExams])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return exams
    return exams.filter(
      (e) =>
        e.name_ar.toLowerCase().includes(q) ||
        e.name_en.toLowerCase().includes(q) ||
        (e.code ?? '').toLowerCase().includes(q),
    )
  }, [exams, query])

  const specialtyLabel =
    activeSpecialty != null
      ? lang === 'en'
        ? activeSpecialty.name_en
        : activeSpecialty.name_ar
      : t(`specialty.${pack.id}`)

  if (!open && compact) {
    return (
      <button
        type="button"
        className="cf-btn cf-btn-ghost mb-sm w-full py-sm text-xs"
        onClick={() => setOpen(true)}
      >
        <Icon name="menu_book" className="text-base" />
        {t('exams.browseForSpecialty', { specialty: specialtyLabel })}
      </button>
    )
  }

  return (
    <div className="cf-exam-picker mb-sm">
      <div className="mb-sm flex flex-wrap items-center justify-between gap-sm">
        <div className="min-w-0">
          <p className="text-xs font-bold text-outline">{t('exams.catalog')}</p>
          <p className="mt-0.5 text-[11px] text-on-surface-variant">
            {t('exams.forSpecialty')}:{' '}
            <span className="font-bold text-primary">{specialtyLabel}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!allowOther ? (
            <button
              type="button"
              className="text-[11px] font-semibold text-primary hover:underline"
              onClick={() => setAllowOther(true)}
            >
              {t('exams.otherSpecialty')}
            </button>
          ) : (
            <button
              type="button"
              className="text-[11px] font-semibold text-on-surface-variant hover:underline"
              onClick={() => {
                setAllowOther(false)
                setSpecialtyId(lockedSpecialtyId)
              }}
            >
              {t('exams.backToMySpecialty')}
            </button>
          )}
          {compact ? (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              {t('patients.cancel')}
            </button>
          ) : null}
        </div>
      </div>

      <div className={`mb-sm grid gap-sm ${allowOther ? 'sm:grid-cols-[1fr_1fr]' : ''}`}>
        {allowOther ? (
          <label className="block text-xs">
            <span className="cf-label !text-[11px]">{t('exams.specialty')}</span>
            <select
              className="cf-input py-1.5 text-xs"
              value={specialtyId}
              onChange={(e) => setSpecialtyId(e.target.value)}
            >
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {lang === 'en' ? s.name_en : s.name_ar}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block text-xs">
          <span className="cf-label !text-[11px]">{t('exams.search')}</span>
          <input
            className="cf-input py-1.5 text-xs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('exams.searchPh')}
          />
        </label>
      </div>

      {error && (
        <p className="mb-sm rounded-lg bg-error-container px-sm py-1 text-[11px] text-on-error-container">
          {error.includes('medical_exams') || error.includes('does not exist')
            ? t('exams.needMigration')
            : error}
        </p>
      )}

      {loading ? (
        <p className="py-sm text-center text-xs text-on-surface-variant">{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <p className="py-sm text-center text-xs text-on-surface-variant">{t('exams.empty')}</p>
      ) : (
        <div className="cf-exam-chip-list custom-scrollbar max-h-48 overflow-y-auto">
          {filtered.map((exam) => (
            <button
              key={exam.id}
              type="button"
              title={exam.doctor_notes ?? exam.code ?? undefined}
              className="cf-exam-chip"
              onClick={() => onPick(examLineLabel(exam, lang), exam)}
            >
              <span className="font-semibold">{examDisplayName(exam, lang)}</span>
              {exam.requires_fasting ? (
                <span className="cf-exam-chip-tag">{t('exams.fasting')}</span>
              ) : null}
              {exam.result_tat_hours != null ? (
                <span className="cf-exam-chip-tag muted">
                  ~{exam.result_tat_hours}
                  {lang === 'en' ? 'h' : 'س'}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
