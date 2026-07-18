import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ar, enUS } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { writeAuditLog } from '../lib/audit'
import { useAuth } from '../hooks/useAuth'
import { BirthDateFields } from '../components/BirthDateFields'
import type { MedicalHistory, Patient, Visit, VitalSign } from '../types/database'
import type { Attachment } from '../types/clinic'
import { Icon } from '../components/Icon'
import { Toast } from '../components/Toast'

type Tab = 'overview' | 'history' | 'vitals' | 'visits' | 'attachments'

const emptyVisit = {
  chief_complaint: '',
  history_of_present_illness: '',
  clinical_exam: '',
  diagnosis: '',
  treatment_plan: '',
  notes: '',
  follow_up_date: '',
  status: 'completed' as 'open' | 'completed' | 'cancelled',
}

function emptyHistory(patientId: string, tenantId: string): MedicalHistory {
  return {
    id: '',
    patient_id: patientId,
    tenant_id: tenantId,
    chronic_diseases: null,
    surgeries: null,
    allergies: null,
    hereditary_diseases: null,
    smoking: false,
    alcohol: false,
    pregnancy_status: null,
    vaccinations: [],
    updated_at: new Date().toISOString(),
  }
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg bg-surface-container-low px-md py-sm">
      <div className="text-[11px] font-semibold text-outline">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-on-surface">{value?.trim() ? value : '—'}</div>
    </div>
  )
}

function VisitField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null
  return (
    <div className="border-b border-outline-variant/60 py-sm last:border-0">
      <div className="text-[11px] font-semibold text-outline">{label}</div>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-on-surface">{value}</p>
    </div>
  )
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const { tenant, user } = useAuth()
  const locale = i18n.language === 'ar' ? ar : enUS

  const [patient, setPatient] = useState<Patient | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Patient>>({})
  const [history, setHistory] = useState<MedicalHistory | null>(null)
  const [vitals, setVitals] = useState<VitalSign[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showVisitForm, setShowVisitForm] = useState(false)
  const [fileToast, setFileToast] = useState<string | null>(null)
  const [visitForm, setVisitForm] = useState(emptyVisit)
  const [vitalForm, setVitalForm] = useState({
    blood_pressure: '',
    blood_sugar: '',
    weight: '',
    height: '',
    temperature: '',
    pulse: '',
    oxygen_saturation: '',
  })

  const tabs = useMemo(
    () =>
      [
        { id: 'overview' as const, label: t('patients.overview'), icon: 'badge' },
        { id: 'history' as const, label: t('patients.history'), icon: 'history_edu' },
        { id: 'vitals' as const, label: t('patients.vitals'), icon: 'monitor_heart' },
        { id: 'visits' as const, label: t('patients.visits'), icon: 'clinical_notes', count: visits.length },
        { id: 'attachments' as const, label: t('patients.attachments'), icon: 'attach_file', count: attachments.length },
      ] as const,
    [t, visits.length, attachments.length],
  )

  async function load() {
    if (!id || !tenant) return
    setError(null)

    const { data: p, error: pErr } = await supabase
      .from('patients')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', id)
      .maybeSingle()

    if (pErr || !p) {
      setError(pErr?.message ?? 'Not found')
      setPatient(null)
      return
    }

    setPatient(p as Patient)
    setEditForm(p as Patient)
    await writeAuditLog('read', 'patients', p.id)

    const [{ data: h }, { data: v }, { data: vs }, { data: atts }] = await Promise.all([
      supabase.from('medical_history').select('*').eq('patient_id', id).maybeSingle(),
      supabase
        .from('vital_signs')
        .select('*')
        .eq('patient_id', id)
        .order('recorded_at', { ascending: false })
        .limit(20),
      supabase
        .from('visits')
        .select('*')
        .eq('patient_id', id)
        .order('visit_date', { ascending: false })
        .limit(50),
      supabase
        .from('attachments')
        .select('*')
        .eq('patient_id', id)
        .order('uploaded_at', { ascending: false }),
    ])

    setHistory((h as MedicalHistory | null) ?? null)
    setVitals((v as VitalSign[]) ?? [])
    setVisits((vs as Visit[]) ?? [])
    setAttachments((atts as Attachment[]) ?? [])
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tenant?.id])

  async function savePatient(e: FormEvent) {
    e.preventDefault()
    if (!patient || !tenant) return
    setBusy(true)
    const { error: err } = await supabase
      .from('patients')
      .update({
        full_name: editForm.full_name,
        phone: editForm.phone || null,
        national_id: editForm.national_id || null,
        birth_date: editForm.birth_date || null,
        gender: editForm.gender || null,
        occupation: editForm.occupation || null,
        address: editForm.address || null,
        marital_status: editForm.marital_status || null,
        blood_type: editForm.blood_type || null,
        insurance_provider: editForm.insurance_provider || null,
        emergency_contact_name: editForm.emergency_contact_name || null,
        emergency_contact_phone: editForm.emergency_contact_phone || null,
      })
      .eq('id', patient.id)
      .eq('tenant_id', tenant.id)

    if (err) setError(err.message)
    else {
      setEditMode(false)
      await load()
    }
    setBusy(false)
  }

  async function saveHistory(e: FormEvent) {
    e.preventDefault()
    if (!patient || !tenant) return
    setBusy(true)
    const base = history ?? emptyHistory(patient.id, tenant.id)
    const payload = {
      patient_id: patient.id,
      tenant_id: tenant.id,
      chronic_diseases: base.chronic_diseases ?? null,
      surgeries: base.surgeries ?? null,
      allergies: base.allergies ?? null,
      hereditary_diseases: base.hereditary_diseases ?? null,
      smoking: base.smoking ?? false,
      alcohol: base.alcohol ?? false,
      pregnancy_status: base.pregnancy_status ?? null,
      vaccinations: base.vaccinations ?? [],
      updated_at: new Date().toISOString(),
    }
    const { error: err } = await supabase
      .from('medical_history')
      .upsert(payload, { onConflict: 'patient_id' })
    if (err) setError(err.message)
    else setFileToast(t('patients.historySaved'))
    setBusy(false)
    await load()
  }

  function patchHistory<K extends keyof MedicalHistory>(key: K, value: MedicalHistory[K]) {
    setHistory((h) => {
      const base = h ?? emptyHistory(patient!.id, tenant!.id)
      return { ...base, [key]: value }
    })
  }

  async function addVital(e: FormEvent) {
    e.preventDefault()
    if (!patient || !tenant) return
    setBusy(true)
    const { error: err } = await supabase.from('vital_signs').insert({
      patient_id: patient.id,
      tenant_id: tenant.id,
      blood_pressure: vitalForm.blood_pressure || null,
      blood_sugar: vitalForm.blood_sugar || null,
      weight: vitalForm.weight ? Number(vitalForm.weight) : null,
      height: vitalForm.height ? Number(vitalForm.height) : null,
      temperature: vitalForm.temperature ? Number(vitalForm.temperature) : null,
      pulse: vitalForm.pulse ? Number(vitalForm.pulse) : null,
      oxygen_saturation: vitalForm.oxygen_saturation
        ? Number(vitalForm.oxygen_saturation)
        : null,
    })
    if (err) setError(err.message)
    else setFileToast(t('patients.vitalsSaved'))
    setBusy(false)
    setVitalForm({
      blood_pressure: '',
      blood_sugar: '',
      weight: '',
      height: '',
      temperature: '',
      pulse: '',
      oxygen_saturation: '',
    })
    await load()
  }

  async function addVisit(e: FormEvent) {
    e.preventDefault()
    if (!patient || !tenant) return
    setBusy(true)
    const { data, error: err } = await supabase
      .from('visits')
      .insert({
        tenant_id: tenant.id,
        patient_id: patient.id,
        doctor_id: user?.id ?? null,
        visit_date: new Date().toISOString(),
        chief_complaint: visitForm.chief_complaint || null,
        history_of_present_illness: visitForm.history_of_present_illness || null,
        clinical_exam: visitForm.clinical_exam || null,
        diagnosis: visitForm.diagnosis || null,
        treatment_plan: visitForm.treatment_plan || null,
        notes: visitForm.notes || null,
        follow_up_date: visitForm.follow_up_date || null,
        status: visitForm.status,
      })
      .select('id')
      .single()

    if (err) setError(err.message)
    else {
      setVisitForm(emptyVisit)
      setShowVisitForm(false)
      if (data?.id) setExpandedVisitId(data.id)
      setFileToast(t('patients.visitSaved'))
    }
    setBusy(false)
    await load()
  }

  async function uploadAttachment(file: File) {
    if (!patient || !tenant) return
    setBusy(true)
    setError(null)
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `${tenant.id}/${patient.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('attachments').upload(path, file)
    if (upErr) {
      setError(upErr.message)
      setBusy(false)
      return
    }

    const fileType: Attachment['file_type'] = file.type.includes('pdf')
      ? 'pdf'
      : file.type.startsWith('image/')
        ? 'image'
        : 'report'

    const { error: dbErr } = await supabase.from('attachments').insert({
      tenant_id: tenant.id,
      patient_id: patient.id,
      file_url: path,
      file_type: fileType,
    })
    if (dbErr) setError(dbErr.message)
    setBusy(false)
    await load()
  }

  async function openAttachment(att: Attachment) {
    const { data, error: err } = await supabase.storage
      .from('attachments')
      .createSignedUrl(att.file_url, 60)
    if (err || !data?.signedUrl) {
      setError(err?.message ?? t('common.error'))
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  function genderLabel(g: Patient['gender']) {
    if (g === 'male') return t('patients.male')
    if (g === 'female') return t('patients.female')
    if (g === 'other') return t('patients.other')
    return '—'
  }

  function visitStatusLabel(status: string) {
    if (status === 'completed') return t('appointments.status.done')
    if (status === 'open') return t('appointments.status.with_doctor')
    if (status === 'cancelled') return t('appointments.status.cancelled')
    return status
  }

  const historyAlerts = useMemo(() => {
    const chips: { tone: 'danger' | 'warning' | 'info'; label: string; value: string }[] = []
    if (history?.allergies?.trim()) {
      chips.push({ tone: 'danger', label: t('patients.allergies'), value: history.allergies.trim() })
    }
    if (history?.chronic_diseases?.trim()) {
      chips.push({ tone: 'warning', label: t('patients.chronic'), value: history.chronic_diseases.trim() })
    }
    if (history?.pregnancy_status?.trim()) {
      chips.push({ tone: 'info', label: t('patients.pregnancy'), value: history.pregnancy_status.trim() })
    }
    if (history?.smoking) {
      chips.push({ tone: 'warning', label: t('patients.smoking'), value: t('patients.yes') })
    }
    return chips
  }, [history, t])

  const historyFilled =
    !!history?.allergies?.trim() ||
    !!history?.chronic_diseases?.trim() ||
    !!history?.surgeries?.trim() ||
    !!history?.hereditary_diseases?.trim() ||
    !!history?.pregnancy_status?.trim() ||
    !!history?.smoking ||
    !!history?.alcohol

  if (!patient) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-xl text-center text-on-surface-variant">
        {error ?? t('common.loading')}
      </div>
    )
  }

  return (
    <div className="cf-page-enter space-y-lg">
      <Toast message={fileToast} tone="success" onDismiss={() => setFileToast(null)} />
      {/* Header */}
      <header className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="border-b border-outline-variant bg-gradient-to-l from-primary-fixed/40 to-transparent px-md py-md md:px-lg md:py-lg">
          <Link to="/patients" className="mb-sm inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <Icon name="arrow_forward" className="text-[16px]" />
            {t('patients.title')}
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-md">
            <div className="flex items-start gap-md">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-on-primary">
                {patient.full_name.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-semibold text-primary">{t('patients.patientFile')}</p>
                <h1 className="font-headline-md text-headline-md font-bold text-on-surface">
                  {patient.full_name}
                </h1>
                <div className="mt-sm flex flex-wrap gap-sm text-xs text-on-surface-variant">
                  <span className="cf-badge cf-badge-info">
                    {t('patients.fileNumber')} #{patient.file_number}
                  </span>
                  {patient.phone && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-lowest px-sm py-0.5">
                      <Icon name="call" className="text-[14px]" />
                      {patient.phone}
                    </span>
                  )}
                  {patient.birth_date && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-lowest px-sm py-0.5">
                      <Icon name="cake" className="text-[14px]" />
                      {patient.birth_date}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-lowest px-sm py-0.5">
                    {genderLabel(patient.gender)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-sm">
              <Link
                to={`/consultation?patientId=${patient.id}`}
                className="cf-btn cf-btn-primary !text-white"
              >
                <Icon name="stethoscope" />
                {t('consultation.start')}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setEditMode(true)
                  setTab('overview')
                }}
                className="cf-btn cf-btn-secondary"
              >
                <Icon name="edit" />
                {t('common.edit')}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex gap-1 overflow-x-auto px-sm py-sm">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-md py-sm text-sm transition-colors ${
                tab === item.id
                  ? 'bg-primary font-bold text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <Icon name={item.icon} className="text-[18px]" />
              {item.label}
              {'count' in item && item.count != null && item.count > 0 && (
                <span
                  className={`ms-1 rounded-full px-1.5 text-[10px] font-bold ${
                    tab === item.id ? 'bg-white/20' : 'bg-primary-fixed text-primary'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {error && (
        <p className="rounded-lg border border-error-container bg-error-container px-md py-sm text-sm text-on-error-container">
          {error}
        </p>
      )}

      {/* Overview */}
      {tab === 'overview' && (
        <section className="space-y-md">
          {editMode ? (
            <form
              onSubmit={savePatient}
              className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-sm sm:grid-cols-2"
            >
              <h2 className="sm:col-span-2 font-title-lg text-title-lg font-medium">
                {t('patients.basicInfo')}
              </h2>
              {(
                [
                  ['full_name', t('patients.fullName')],
                  ['phone', t('patients.phone')],
                  ['national_id', t('patients.nationalId')],
                  ['occupation', t('patients.occupation')],
                  ['address', t('patients.address')],
                  ['marital_status', t('patients.maritalStatus')],
                  ['blood_type', t('patients.bloodType')],
                  ['insurance_provider', t('patients.insurance')],
                  ['emergency_contact_name', t('patients.emergencyName')],
                  ['emergency_contact_phone', t('patients.emergencyPhone')],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm">
                  <span className="cf-label">{label}</span>
                  <input
                    type="text"
                    className="cf-input"
                    value={(editForm[key] as string | null) ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    required={key === 'full_name'}
                  />
                </label>
              ))}
              <div className="block text-sm">
                <span className="cf-label">{t('patients.birthDate')}</span>
                <BirthDateFields
                  value={editForm.birth_date}
                  onChange={(iso) => setEditForm((f) => ({ ...f, birth_date: iso || null }))}
                />
              </div>
              <label className="block text-sm">
                <span className="cf-label">{t('patients.gender')}</span>
                <select
                  className="cf-input"
                  value={editForm.gender ?? ''}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      gender: (e.target.value || null) as Patient['gender'],
                    }))
                  }
                >
                  <option value="">—</option>
                  <option value="male">{t('patients.male')}</option>
                  <option value="female">{t('patients.female')}</option>
                  <option value="other">{t('patients.other')}</option>
                </select>
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" disabled={busy} className="cf-btn cf-btn-primary !text-white">
                  {t('patients.save')}
                </button>
                <button type="button" onClick={() => setEditMode(false)} className="cf-btn cf-btn-ghost">
                  {t('patients.cancel')}
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-sm">
              <div className="mb-md flex items-center justify-between">
                <h2 className="font-title-lg text-title-lg font-medium">{t('patients.basicInfo')}</h2>
                <button type="button" onClick={() => setEditMode(true)} className="cf-btn cf-btn-ghost py-1 text-xs">
                  <Icon name="edit" className="text-[16px]" />
                  {t('common.edit')}
                </button>
              </div>
              <div className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow label={t('patients.fullName')} value={patient.full_name} />
                <InfoRow label={t('patients.phone')} value={patient.phone} />
                <InfoRow label={t('patients.nationalId')} value={patient.national_id} />
                <InfoRow label={t('patients.birthDate')} value={patient.birth_date} />
                <InfoRow label={t('patients.gender')} value={genderLabel(patient.gender)} />
                <InfoRow label={t('patients.bloodType')} value={patient.blood_type} />
                <InfoRow label={t('patients.occupation')} value={patient.occupation} />
                <InfoRow label={t('patients.address')} value={patient.address} />
                <InfoRow label={t('patients.insurance')} value={patient.insurance_provider} />
                <InfoRow label={t('patients.emergencyName')} value={patient.emergency_contact_name} />
                <InfoRow label={t('patients.emergencyPhone')} value={patient.emergency_contact_phone} />
              </div>
            </div>
          )}

          <div className="grid gap-md lg:grid-cols-2">
            <button
              type="button"
              onClick={() => setTab('visits')}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md text-start shadow-sm transition hover:border-primary"
            >
              <div className="mb-sm flex items-center gap-sm text-primary">
                <Icon name="clinical_notes" filled />
                <span className="font-medium">{t('patients.visits')}</span>
              </div>
              <p className="text-3xl font-bold">{visits.length}</p>
              <p className="mt-1 text-xs text-on-surface-variant">{t('patients.openVisit')}</p>
            </button>
            <button
              type="button"
              onClick={() => setTab('vitals')}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md text-start shadow-sm transition hover:border-primary"
            >
              <div className="mb-sm flex items-center gap-sm text-secondary">
                <Icon name="monitor_heart" filled />
                <span className="font-medium">{t('patients.vitals')}</span>
              </div>
              <p className="text-3xl font-bold">{vitals.length}</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {vitals[0]
                  ? format(new Date(vitals[0].recorded_at), 'dd MMM yyyy HH:mm', { locale })
                  : t('patients.noVitals')}
              </p>
            </button>
          </div>
        </section>
      )}

      {/* History */}
      {tab === 'history' && (
        <section className="space-y-md">
          <div className="cf-history-hero">
            <div className="min-w-0">
              <div className="flex items-center gap-sm">
                <span className="cf-history-card-icon bg-primary-fixed text-primary">
                  <Icon name="history_edu" />
                </span>
                <div>
                  <h2 className="font-title-lg text-title-lg font-bold text-on-surface">
                    {t('patients.history')}
                  </h2>
                  <p className="mt-0.5 text-sm text-on-surface-variant">{t('patients.historyHint')}</p>
                </div>
              </div>
            </div>
            {history?.updated_at && historyFilled ? (
              <p className="text-xs text-on-surface-variant">
                {t('patients.historyUpdated')}:{' '}
                <span className="font-semibold text-on-surface">
                  {format(new Date(history.updated_at), 'dd MMM yyyy · HH:mm', { locale })}
                </span>
              </p>
            ) : null}
          </div>

          {historyAlerts.length > 0 ? (
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-sm">
              <p className="mb-sm text-xs font-bold uppercase tracking-wide text-outline">
                {t('patients.riskFlags')}
              </p>
              <div className="flex flex-wrap gap-sm">
                {historyAlerts.map((chip) => (
                  <span
                    key={`${chip.label}-${chip.value}`}
                    className={`cf-history-chip cf-history-chip-${chip.tone}`}
                    title={chip.value}
                  >
                    <Icon
                      name={
                        chip.tone === 'danger'
                          ? 'warning'
                          : chip.tone === 'warning'
                            ? 'monitor_heart'
                            : 'info'
                      }
                      className="text-[15px]"
                    />
                    <span className="font-bold">{chip.label}:</span>
                    <span className="max-w-[14rem] truncate">{chip.value}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : !historyFilled ? (
            <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low/40 px-md py-lg text-center">
              <Icon name="clinical_notes" className="mb-sm text-4xl text-outline" />
              <p className="font-semibold text-on-surface">{t('patients.historyEmpty')}</p>
              <p className="mt-xs text-sm text-on-surface-variant">{t('patients.historyEmptyHint')}</p>
            </div>
          ) : null}

          <form onSubmit={saveHistory} className="space-y-md">
            <div>
              <h3 className="mb-sm text-sm font-bold text-on-surface">{t('patients.historyCritical')}</h3>
              <div className="cf-history-card cf-history-card-danger">
                <div className="cf-history-card-head">
                  <span className="cf-history-card-icon">
                    <Icon name="warning" />
                  </span>
                  <div>
                    <p className="font-semibold text-on-surface">{t('patients.allergies')}</p>
                    <p className="text-xs text-on-surface-variant">{t('patients.allergiesHint')}</p>
                  </div>
                </div>
                <div className="cf-history-card-body">
                  <textarea
                    className="cf-input min-h-[5rem]"
                    rows={3}
                    placeholder={t('patients.allergiesHint')}
                    value={history?.allergies ?? ''}
                    onChange={(e) => patchHistory('allergies', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-sm text-sm font-bold text-on-surface">{t('patients.historyConditions')}</h3>
              <div className="grid gap-md lg:grid-cols-2">
                {(
                  [
                    {
                      key: 'chronic_diseases' as const,
                      label: t('patients.chronic'),
                      hint: t('patients.chronicHint'),
                      icon: 'monitor_heart',
                      tone: 'warning' as const,
                    },
                    {
                      key: 'surgeries' as const,
                      label: t('patients.surgeries'),
                      hint: t('patients.surgeriesHint'),
                      icon: 'healing',
                      tone: 'info' as const,
                    },
                    {
                      key: 'hereditary_diseases' as const,
                      label: t('patients.hereditary'),
                      hint: t('patients.hereditaryHint'),
                      icon: 'family_restroom',
                      tone: 'muted' as const,
                    },
                    ...(patient.gender !== 'male'
                      ? ([
                          {
                            key: 'pregnancy_status' as const,
                            label: t('patients.pregnancy'),
                            hint: t('patients.pregnancyHint'),
                            icon: 'pregnant_woman',
                            tone: 'info' as const,
                          },
                        ] as const)
                      : []),
                  ] as const
                ).map((field) => (
                  <div key={field.key} className={`cf-history-card cf-history-card-${field.tone}`}>
                    <div className="cf-history-card-head">
                      <span className="cf-history-card-icon">
                        <Icon name={field.icon} />
                      </span>
                      <div>
                        <p className="font-semibold text-on-surface">{field.label}</p>
                        <p className="text-xs text-on-surface-variant">{field.hint}</p>
                      </div>
                    </div>
                    <div className="cf-history-card-body">
                      <textarea
                        className="cf-input min-h-[4.5rem]"
                        rows={3}
                        placeholder={field.hint}
                        value={(history?.[field.key] as string | null) ?? ''}
                        onChange={(e) => patchHistory(field.key, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-sm text-sm font-bold text-on-surface">{t('patients.historyLifestyle')}</h3>
              <div className="grid gap-md sm:grid-cols-2">
                {(
                  [
                    { key: 'smoking' as const, label: t('patients.smoking'), icon: 'smoking_rooms' },
                    { key: 'alcohol' as const, label: t('patients.alcohol'), icon: 'local_bar' },
                  ] as const
                ).map((item) => {
                  const on = !!history?.[item.key]
                  return (
                    <div key={item.key} className="cf-history-card cf-history-card-muted">
                      <div className="flex flex-wrap items-center justify-between gap-md px-md py-md">
                        <div className="flex items-center gap-sm">
                          <span className="cf-history-card-icon">
                            <Icon name={item.icon} />
                          </span>
                          <p className="font-semibold text-on-surface">{item.label}</p>
                        </div>
                        <div className="cf-history-toggle" role="group" aria-label={item.label}>
                          <button
                            type="button"
                            className={!on ? 'is-on' : ''}
                            onClick={() => patchHistory(item.key, false)}
                          >
                            {t('patients.no')}
                          </button>
                          <button
                            type="button"
                            className={on ? 'is-on is-risk' : ''}
                            onClick={() => patchHistory(item.key, true)}
                          >
                            {t('patients.yes')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="cf-history-actions">
              <p className="text-xs text-on-surface-variant">
                {historyFilled
                  ? t('patients.historyHint')
                  : t('patients.historyEmptyHint')}
              </p>
              <button type="submit" disabled={busy} className="cf-btn cf-btn-primary !text-white">
                <Icon name={busy ? 'progress_activity' : 'save'} className={busy ? 'animate-spin' : ''} />
                {t('patients.save')}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Vitals */}
      {tab === 'vitals' && (
        <section className="space-y-md">
          <div className="cf-history-hero">
            <div className="min-w-0">
              <div className="flex items-center gap-sm">
                <span className="cf-history-card-icon bg-secondary-container text-on-secondary-container">
                  <Icon name="monitor_heart" />
                </span>
                <div>
                  <h2 className="font-title-lg text-title-lg font-bold text-on-surface">
                    {t('patients.vitals')}
                  </h2>
                  <p className="mt-0.5 text-sm text-on-surface-variant">{t('patients.vitalsHint')}</p>
                </div>
              </div>
            </div>
            {vitals[0] ? (
              <p className="text-xs text-on-surface-variant">
                {t('patients.vitalsLatest')}:{' '}
                <span className="font-semibold text-on-surface">
                  {format(new Date(vitals[0].recorded_at), 'dd MMM yyyy · HH:mm', { locale })}
                </span>
              </p>
            ) : null}
          </div>

          {vitals[0] ? (
            <div>
              <h3 className="mb-sm text-sm font-bold text-on-surface">{t('patients.vitalsLatest')}</h3>
              <div className="grid gap-sm grid-cols-2 md:grid-cols-4">
                {(
                  [
                    {
                      icon: 'bloodtype',
                      label: t('patients.bloodPressure'),
                      value: vitals[0].blood_pressure,
                      unit: t('patients.unitMmHg'),
                    },
                    {
                      icon: 'water_drop',
                      label: t('patients.bloodSugar'),
                      value: vitals[0].blood_sugar,
                      unit: t('patients.unitMgDl'),
                    },
                    {
                      icon: 'monitor_weight',
                      label: t('patients.weight'),
                      value: vitals[0].weight,
                      unit: t('patients.unitKg'),
                    },
                    {
                      icon: 'height',
                      label: t('patients.height'),
                      value: vitals[0].height,
                      unit: t('patients.unitCm'),
                    },
                    {
                      icon: 'thermostat',
                      label: t('patients.temperature'),
                      value: vitals[0].temperature,
                      unit: t('patients.unitC'),
                    },
                    {
                      icon: 'cardiology',
                      label: t('patients.pulse'),
                      value: vitals[0].pulse,
                      unit: t('patients.unitBpm'),
                    },
                    {
                      icon: 'air',
                      label: t('patients.oxygen'),
                      value: vitals[0].oxygen_saturation,
                      unit: t('patients.unitPercent'),
                    },
                  ] as const
                ).map((m) => (
                  <div key={m.label} className="cf-vital-metric">
                    <div className="cf-vital-metric-label">
                      <Icon name={m.icon} className="text-[16px] text-primary" />
                      {m.label}
                    </div>
                    <div className="cf-vital-metric-value">{m.value ?? '—'}</div>
                    <div className="cf-vital-metric-unit">{m.unit}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <form onSubmit={addVital} className="cf-history-card cf-history-card-info overflow-visible">
            <div className="cf-history-card-head">
              <span className="cf-history-card-icon">
                <Icon name="add_circle" />
              </span>
              <div>
                <p className="font-semibold text-on-surface">{t('patients.addVital')}</p>
                <p className="text-xs text-on-surface-variant">{t('patients.vitalsEmptyHint')}</p>
              </div>
            </div>
            <div className="cf-history-card-body space-y-md">
              <div className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    {
                      key: 'blood_pressure' as const,
                      label: t('patients.bloodPressure'),
                      unit: t('patients.unitMmHg'),
                      icon: 'bloodtype',
                      placeholder: '120/80',
                    },
                    {
                      key: 'blood_sugar' as const,
                      label: t('patients.bloodSugar'),
                      unit: t('patients.unitMgDl'),
                      icon: 'water_drop',
                      placeholder: '100',
                    },
                    {
                      key: 'weight' as const,
                      label: t('patients.weight'),
                      unit: t('patients.unitKg'),
                      icon: 'monitor_weight',
                      placeholder: '70',
                    },
                    {
                      key: 'height' as const,
                      label: t('patients.height'),
                      unit: t('patients.unitCm'),
                      icon: 'height',
                      placeholder: '170',
                    },
                    {
                      key: 'temperature' as const,
                      label: t('patients.temperature'),
                      unit: t('patients.unitC'),
                      icon: 'thermostat',
                      placeholder: '37',
                    },
                    {
                      key: 'pulse' as const,
                      label: t('patients.pulse'),
                      unit: t('patients.unitBpm'),
                      icon: 'cardiology',
                      placeholder: '72',
                    },
                    {
                      key: 'oxygen_saturation' as const,
                      label: t('patients.oxygen'),
                      unit: t('patients.unitPercent'),
                      icon: 'air',
                      placeholder: '98',
                    },
                  ] as const
                ).map((field) => (
                  <label key={field.key} className="cf-vital-field">
                    <span className="cf-vital-field-head">
                      <Icon name={field.icon} className="text-[16px] text-primary" />
                      {field.label}
                      <span className="ms-auto text-[11px] font-semibold text-outline">{field.unit}</span>
                    </span>
                    <input
                      className="cf-input !mt-0"
                      inputMode="decimal"
                      placeholder={field.placeholder}
                      value={vitalForm[field.key]}
                      onChange={(e) => setVitalForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={busy} className="cf-btn cf-btn-primary !text-white">
                  <Icon name={busy ? 'progress_activity' : 'add'} className={busy ? 'animate-spin' : ''} />
                  {t('patients.addVital')}
                </button>
              </div>
            </div>
          </form>

          {vitals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low/40 px-md py-lg text-center">
              <Icon name="monitor_heart" className="mb-sm text-4xl text-outline" />
              <p className="font-semibold text-on-surface">{t('patients.noVitals')}</p>
              <p className="mt-xs text-sm text-on-surface-variant">{t('patients.vitalsEmptyHint')}</p>
            </div>
          ) : (
            <div>
              <h3 className="mb-sm text-sm font-bold text-on-surface">
                {t('patients.vitalsHistory')}
                <span className="ms-2 font-normal text-on-surface-variant">({vitals.length})</span>
              </h3>
              <div className="space-y-sm">
                {vitals.map((v) => (
                  <article key={v.id} className="cf-vital-row">
                    <div className="cf-vital-row-meta">
                      <span className="inline-flex items-center gap-xs font-semibold text-on-surface">
                        <Icon name="schedule" className="text-[15px] text-primary" />
                        {format(new Date(v.recorded_at), 'EEEE d MMM yyyy · HH:mm', { locale })}
                      </span>
                    </div>
                    <div className="cf-vital-chips">
                      {(
                        [
                          [t('patients.bloodPressure'), v.blood_pressure, t('patients.unitMmHg')],
                          [t('patients.bloodSugar'), v.blood_sugar, t('patients.unitMgDl')],
                          [t('patients.weight'), v.weight, t('patients.unitKg')],
                          [t('patients.height'), v.height, t('patients.unitCm')],
                          [t('patients.temperature'), v.temperature, t('patients.unitC')],
                          [t('patients.pulse'), v.pulse, t('patients.unitBpm')],
                          [t('patients.oxygen'), v.oxygen_saturation, t('patients.unitPercent')],
                        ] as const
                      )
                        .filter(([, val]) => val != null && String(val).trim() !== '')
                        .map(([label, val, unit]) => (
                          <span key={label} className="cf-vital-chip" title={label}>
                            <span>{label}</span>
                            <strong>{val}</strong>
                            <span>{unit}</span>
                          </span>
                        ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Visits */}
      {tab === 'visits' && (
        <section className="space-y-md">
          <div className="cf-history-hero">
            <div className="min-w-0">
              <div className="flex items-center gap-sm">
                <span className="cf-history-card-icon bg-primary-fixed text-primary">
                  <Icon name="clinical_notes" />
                </span>
                <div>
                  <h2 className="font-title-lg text-title-lg font-bold text-on-surface">
                    {t('patients.visits')}
                    <span className="ms-2 text-base font-semibold text-on-surface-variant">
                      ({visits.length})
                    </span>
                  </h2>
                  <p className="mt-0.5 text-sm text-on-surface-variant">{t('patients.visitsHint')}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-sm">
              <Link
                to={`/consultation?patientId=${patient.id}`}
                className="cf-btn cf-btn-primary !text-white"
              >
                <Icon name="stethoscope" />
                {t('consultation.start')}
              </Link>
              <button
                type="button"
                onClick={() => setShowVisitForm((v) => !v)}
                className="cf-btn cf-btn-secondary"
              >
                <Icon name={showVisitForm ? 'close' : 'add'} />
                {showVisitForm ? t('patients.cancel') : t('patients.addVisitManual')}
              </button>
            </div>
          </div>

          {showVisitForm && (
            <form onSubmit={addVisit} className="space-y-md rounded-xl border border-primary/25 bg-primary-fixed/15 p-md">
              <div className="grid gap-md lg:grid-cols-2">
                <div className="cf-visit-form-section space-y-sm lg:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-outline">
                    {t('patients.visitComplaint')}
                  </p>
                  {(
                    [
                      ['chief_complaint', t('visits.chiefComplaint')],
                      ['history_of_present_illness', t('visits.hpi')],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block text-sm">
                      <span className="cf-label">{label}</span>
                      <textarea
                        className="cf-input"
                        rows={2}
                        value={visitForm[key]}
                        onChange={(e) => setVisitForm((f) => ({ ...f, [key]: e.target.value }))}
                      />
                    </label>
                  ))}
                </div>
                <div className="cf-visit-form-section space-y-sm lg:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-outline">
                    {t('patients.visitDiagnosisShort')}
                  </p>
                  {(
                    [
                      ['clinical_exam', t('visits.exam')],
                      ['diagnosis', t('visits.diagnosis')],
                      ['treatment_plan', t('visits.plan')],
                      ['notes', t('visits.notes')],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block text-sm">
                      <span className="cf-label">{label}</span>
                      <textarea
                        className="cf-input"
                        rows={2}
                        value={visitForm[key]}
                        onChange={(e) => setVisitForm((f) => ({ ...f, [key]: e.target.value }))}
                      />
                    </label>
                  ))}
                </div>
                <label className="cf-visit-form-section block text-sm">
                  <span className="cf-label">{t('visits.followUp')}</span>
                  <input
                    type="date"
                    className="cf-input"
                    value={visitForm.follow_up_date}
                    onChange={(e) => setVisitForm((f) => ({ ...f, follow_up_date: e.target.value }))}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={busy} className="cf-btn cf-btn-primary !text-white">
                  <Icon name={busy ? 'progress_activity' : 'save'} className={busy ? 'animate-spin' : ''} />
                  {t('patients.save')}
                </button>
                <button type="button" onClick={() => setShowVisitForm(false)} className="cf-btn cf-btn-ghost">
                  {t('patients.cancel')}
                </button>
              </div>
            </form>
          )}

          {visits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low/40 px-md py-xl text-center">
              <Icon name="clinical_notes" className="mb-sm text-4xl text-outline" />
              <p className="font-semibold text-on-surface">{t('patients.noVisits')}</p>
              <p className="mt-xs text-sm text-on-surface-variant">{t('patients.visitsEmptyHint')}</p>
              <div className="mt-md flex flex-wrap justify-center gap-sm">
                <Link
                  to={`/consultation?patientId=${patient.id}`}
                  className="cf-btn cf-btn-primary py-sm text-sm !text-white"
                >
                  <Icon name="stethoscope" />
                  {t('consultation.start')}
                </Link>
                <button
                  type="button"
                  onClick={() => setShowVisitForm(true)}
                  className="cf-btn cf-btn-secondary py-sm text-sm"
                >
                  <Icon name="add" />
                  {t('patients.addVisitManual')}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="mb-sm text-sm font-bold text-on-surface">{t('patients.visitsTimeline')}</h3>
              <ul className="cf-visit-timeline">
                {visits.map((v) => {
                  const open = expandedVisitId === v.id
                  const rail =
                    v.status === 'completed'
                      ? 'cf-visit-card-rail-done'
                      : v.status === 'cancelled'
                        ? 'cf-visit-card-rail-cancelled'
                        : 'cf-visit-card-rail-open'
                  return (
                    <li key={v.id} className={`cf-visit-card ${open ? 'is-open' : ''}`}>
                      <span className={`cf-visit-card-rail ${rail}`} aria-hidden />
                      <button
                        type="button"
                        className="cf-visit-card-btn"
                        onClick={() => setExpandedVisitId(open ? null : v.id)}
                      >
                        <div className="cf-visit-date-badge">
                          <span className="day">{format(new Date(v.visit_date), 'd')}</span>
                          <span className="mon">{format(new Date(v.visit_date), 'MMM', { locale })}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-sm">
                            <span className="font-semibold text-on-surface">
                              {format(new Date(v.visit_date), 'EEEE · HH:mm', { locale })}
                            </span>
                            <span
                              className={
                                v.status === 'completed'
                                  ? 'cf-badge cf-badge-status-done'
                                  : v.status === 'cancelled'
                                    ? 'cf-badge cf-badge-muted'
                                    : 'cf-badge cf-badge-status-doctor'
                              }
                            >
                              {visitStatusLabel(v.status)}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm text-on-surface-variant">
                            {v.diagnosis || v.chief_complaint || t('patients.openVisit')}
                          </p>
                          {(v.diagnosis || v.chief_complaint) && (
                            <div className="mt-sm flex flex-wrap gap-sm">
                              {v.chief_complaint ? (
                                <span className="cf-badge cf-badge-muted">
                                  {t('patients.visitComplaint')}: {v.chief_complaint.slice(0, 40)}
                                  {v.chief_complaint.length > 40 ? '…' : ''}
                                </span>
                              ) : null}
                              {v.diagnosis ? (
                                <span className="cf-badge cf-badge-info">
                                  {t('patients.visitDiagnosisShort')}: {v.diagnosis.slice(0, 40)}
                                  {v.diagnosis.length > 40 ? '…' : ''}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </div>
                        <Icon
                          name={open ? 'expand_less' : 'expand_more'}
                          className="mt-1 shrink-0 text-2xl text-outline transition"
                        />
                      </button>

                      {open && (
                        <div className="border-t border-outline-variant bg-surface-container-low/40 px-md py-md">
                          <div className="mb-md flex flex-wrap gap-sm">
                            <Link
                              to={`/consultation?patientId=${patient.id}&visitId=${v.id}`}
                              className="cf-btn cf-btn-primary py-sm text-xs !text-white"
                            >
                              <Icon name="stethoscope" className="text-[16px]" />
                              {t('patients.openInConsultation')}
                            </Link>
                            <button
                              type="button"
                              className="cf-btn cf-btn-ghost py-sm text-xs"
                              onClick={() => setExpandedVisitId(null)}
                            >
                              {t('patients.closeVisit')}
                            </button>
                          </div>
                          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest px-md">
                            <VisitField
                              label={t('patients.visitDate')}
                              value={format(new Date(v.visit_date), 'PPpp', { locale })}
                            />
                            <VisitField label={t('patients.visitStatus')} value={visitStatusLabel(v.status)} />
                            <VisitField label={t('visits.chiefComplaint')} value={v.chief_complaint} />
                            <VisitField label={t('visits.hpi')} value={v.history_of_present_illness} />
                            <VisitField label={t('visits.exam')} value={v.clinical_exam} />
                            <VisitField label={t('visits.diagnosis')} value={v.diagnosis} />
                            <VisitField label={t('visits.plan')} value={v.treatment_plan} />
                            <VisitField label={t('visits.notes')} value={v.notes} />
                            <VisitField label={t('visits.followUp')} value={v.follow_up_date} />
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Attachments */}
      {tab === 'attachments' && (
        <section className="space-y-md rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-sm">
          <h2 className="font-title-lg text-title-lg font-medium">{t('patients.attachments')}</h2>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-sm rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-md py-lg text-sm hover:border-primary">
            <Icon name="upload_file" className="text-3xl text-primary" />
            <span className="font-medium">{t('patients.uploadAttachment')}</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadAttachment(file)
                e.target.value = ''
              }}
            />
          </label>

          {attachments.length === 0 ? (
            <p className="py-md text-center text-sm text-on-surface-variant">{t('patients.noAttachments')}</p>
          ) : (
            <ul className="space-y-sm">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-outline-variant px-md py-sm"
                >
                  <div className="flex items-center gap-sm min-w-0">
                    <Icon
                      name={a.file_type === 'pdf' ? 'picture_as_pdf' : 'image'}
                      className="text-primary"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{a.file_type}</div>
                      <div className="text-xs text-on-surface-variant">
                        {format(new Date(a.uploaded_at), 'dd/MM/yyyy HH:mm', { locale })}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="cf-btn cf-btn-secondary py-1 text-xs"
                    onClick={() => void openAttachment(a)}
                  >
                    {t('common.view')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
