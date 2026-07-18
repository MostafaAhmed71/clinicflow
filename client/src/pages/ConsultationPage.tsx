import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useFocusMode } from '../hooks/useFocusMode'
import { useAppointmentsLive } from '../hooks/useAppointmentsLive'
import type { MedicalHistory, Patient, Visit } from '../types/database'
import type { Appointment, PrescriptionItem, PrescriptionTemplate } from '../types/clinic'
import { printDischargeSlip, printPrescription, printRequestList } from '../lib/print'
import { detectDrugAllergyConflicts } from '../lib/allergyAlerts'
import { getSpecialtyPack } from '../lib/specialtyPacks'
import {
  getBuiltinInstructionTemplates,
  type BuiltinInstructionTemplate,
} from '../lib/specialtyInstructionTemplates'
import { Icon } from '../components/Icon'
import { Toast } from '../components/Toast'
import { ExamCatalogPicker } from '../components/ExamCatalogPicker'
import { DrugAutocomplete } from '../components/DrugAutocomplete'
import { DosageSelect } from '../components/DosageSelect'
import { DurationSelect } from '../components/DurationSelect'
import { endOfLocalDay, startOfLocalDay } from '../lib/clinicDay'
import { feeForVisitKind, type VisitKind } from '../lib/visitFees'
import { appointmentStatusBadgeClass } from '../lib/appointmentStatus'

type DrugRow = { drug_name: string; dosage: string; duration: string; notes: string }
type RequestTemplate = { id: string; type: 'lab' | 'radiology'; name: string; items: string[] }
type InstructionTemplate = { id: string; name: string; body: string }
type InstructionPick = InstructionTemplate & { source: 'builtin' | 'custom' }
type RecentVisit = { id: string; visit_date: string; diagnosis: string | null; chief_complaint: string | null }

const emptyDrug = (): DrugRow => ({ drug_name: '', dosage: '', duration: '', notes: '' })

const emptyVisit = () => ({
  chief_complaint: '',
  history_of_present_illness: '',
  clinical_exam: '',
  diagnosis: '',
  treatment_plan: '',
  notes: '',
  follow_up_date: '',
})

export function ConsultationPage() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const { tenant, user } = useAuth()
  const { focusMode, setFocusMode, toggleFocusMode } = useFocusMode()
  const formRef = useRef<HTMLFormElement>(null)
  const patientIdParam = params.get('patientId')
  const visitIdParam = params.get('visitId')
  const appointmentId = params.get('appointmentId')

  const [patient, setPatient] = useState<Patient | null>(null)
  const [visitId, setVisitId] = useState<string | null>(visitIdParam)
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(appointmentId)
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid' | 'waived' | null>(null)
  const [visitKind, setVisitKind] = useState<VisitKind | null>(null)
  const [feeAmount, setFeeAmount] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(
    null,
  )
  const [queue, setQueue] = useState<Appointment[]>([])
  const [patientSearch, setPatientSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Patient[]>([])
  const [visit, setVisit] = useState(emptyVisit)
  const [drugs, setDrugs] = useState<DrugRow[]>([emptyDrug()])
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([])
  const [favorites, setFavorites] = useState<{ drug_name: string; dosage: string | null; duration: string | null }[]>(
    [],
  )
  const [labItems, setLabItems] = useState('')
  const [radItems, setRadItems] = useState('')
  const [surgeryRequest, setSurgeryRequest] = useState('')
  const [requestTemplates, setRequestTemplates] = useState<RequestTemplate[]>([])
  const [instructionTemplates, setInstructionTemplates] = useState<InstructionTemplate[]>([])
  const [patientInstructions, setPatientInstructions] = useState('')
  const [selectedInstructionIds, setSelectedInstructionIds] = useState<string[]>([])
  const [history, setHistory] = useState<MedicalHistory | null>(null)
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)
  const [justSaved, setJustSaved] = useState(false)
  const [queuePulse, setQueuePulse] = useState(false)
  const [specialtyNotes, setSpecialtyNotes] = useState<Record<string, string>>({})
  const specialtyPack = getSpecialtyPack(tenant?.specialty)

  const allInstructionPicks = useMemo((): InstructionPick[] => {
    const builtins: InstructionPick[] = getBuiltinInstructionTemplates(tenant?.specialty).map(
      (t: BuiltinInstructionTemplate) => ({
        id: t.id,
        name: t.name,
        body: t.body,
        source: 'builtin' as const,
      }),
    )
    const custom: InstructionPick[] = instructionTemplates.map((t) => ({
      ...t,
      source: 'custom' as const,
    }))
    // Prefer custom if same name as builtin (avoid duplicates after import)
    const builtinNames = new Set(builtins.map((b) => b.name.trim()))
    const customUnique = custom.filter((c) => !builtinNames.has(c.name.trim()))
    return [...builtins, ...customUnique]
  }, [tenant?.specialty, instructionTemplates])

  const builtinInstructionPicks = useMemo(
    () => allInstructionPicks.filter((t) => t.source === 'builtin'),
    [allInstructionPicks],
  )
  const customInstructionPicks = useMemo(
    () => allInstructionPicks.filter((t) => t.source === 'custom'),
    [allInstructionPicks],
  )

  async function refreshQueue() {
    if (!tenant) return [] as Appointment[]
    const start = startOfLocalDay()
    const end = endOfLocalDay()
    const { data: todayAppts } = await supabase
      .from('appointments')
      .select('*, patients(full_name, phone, file_number)')
      .eq('tenant_id', tenant.id)
      .gte('scheduled_at', start.toISOString())
      .lte('scheduled_at', end.toISOString())
      .in('status', ['waiting', 'with_doctor'])
      .order('scheduled_at', { ascending: true })
    const rows = (todayAppts as Appointment[]) ?? []
    setQueue(rows)
    return rows
  }

  useAppointmentsLive(tenant?.id, () => {
    void refreshQueue().then(() => {
      setQueuePulse(true)
      setToast({ message: t('waiting.liveUpdated'), tone: 'info' })
      window.setTimeout(() => setQueuePulse(false), 1500)
    })
  })

  async function loadPatientContext(patientId: string, excludeVisitId?: string | null) {
    const [{ data: hist }, { data: visits }] = await Promise.all([
      supabase.from('medical_history').select('*').eq('patient_id', patientId).maybeSingle(),
      supabase
        .from('visits')
        .select('id, visit_date, diagnosis, chief_complaint')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false })
        .limit(4),
    ])
    setHistory((hist as MedicalHistory) ?? null)
    const list = ((visits as RecentVisit[]) ?? []).filter((v) => v.id !== excludeVisitId).slice(0, 3)
    setRecentVisits(list)
  }

  useEffect(() => {
    async function init() {
      if (!tenant) return
      setError(null)
      setBooting(true)

      await refreshQueue()

      if (visitIdParam) {
        const { data: v } = await supabase.from('visits').select('*').eq('id', visitIdParam).maybeSingle()
        if (v) {
          const row = v as Visit
          setVisitId(row.id)
          setVisit({
            chief_complaint: row.chief_complaint ?? '',
            history_of_present_illness: row.history_of_present_illness ?? '',
            clinical_exam: row.clinical_exam ?? '',
            diagnosis: row.diagnosis ?? '',
            treatment_plan: row.treatment_plan ?? '',
            notes: row.notes ?? '',
            follow_up_date: row.follow_up_date ?? '',
          })
          const { data: p } = await supabase.from('patients').select('*').eq('id', row.patient_id).maybeSingle()
          setPatient((p as Patient) ?? null)
          if (p) await loadPatientContext(row.patient_id, row.id)
          // Keep URL in sync so refresh keeps the visit open
          if (!patientIdParam) {
            const next = new URLSearchParams()
            next.set('patientId', row.patient_id)
            next.set('visitId', row.id)
            setParams(next, { replace: true })
          }

          const { data: rx } = await supabase
            .from('prescriptions')
            .select('id')
            .eq('visit_id', row.id)
            .maybeSingle()
          if (rx) {
            const { data: items } = await supabase
              .from('prescription_items')
              .select('*')
              .eq('prescription_id', rx.id)
            if (items?.length) {
              setDrugs(
                (items as PrescriptionItem[]).map((i) => ({
                  drug_name: i.drug_name,
                  dosage: i.dosage ?? '',
                  duration: i.duration ?? '',
                  notes: i.notes ?? '',
                })),
              )
            }
          }

          const { data: linkedAppt } = await supabase
            .from('appointments')
            .select('id, payment_status, visit_kind, fee_amount')
            .eq('visit_id', row.id)
            .maybeSingle()
          if (linkedAppt) {
            setActiveAppointmentId(linkedAppt.id)
            applyAppointmentMeta(linkedAppt)
          }
        }
      } else if (patientIdParam) {
        const { data: p } = await supabase.from('patients').select('*').eq('id', patientIdParam).maybeSingle()
        setPatient((p as Patient) ?? null)
        if (p) await loadPatientContext(patientIdParam)

        const start = startOfLocalDay()
        const end = endOfLocalDay()

        let apptId = appointmentId
        if (!apptId) {
          const { data: appt } = await supabase
            .from('appointments')
            .select('id, payment_status, status, visit_kind, fee_amount')
            .eq('tenant_id', tenant.id)
            .eq('patient_id', patientIdParam)
            .gte('scheduled_at', start.toISOString())
            .lte('scheduled_at', end.toISOString())
            .in('status', ['waiting', 'with_doctor', 'done'])
            .order('scheduled_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (appt) {
            apptId = appt.id
            applyAppointmentMeta(appt)
          }
        } else {
          let { data: appt } = await supabase
            .from('appointments')
            .select('payment_status, visit_kind, fee_amount')
            .eq('id', appointmentId)
            .maybeSingle()
          if (!appt) {
            const plain = await supabase
              .from('appointments')
              .select('payment_status')
              .eq('id', appointmentId)
              .maybeSingle()
            appt = plain.data
              ? { payment_status: plain.data.payment_status, visit_kind: null, fee_amount: null }
              : null
          }
          if (appt) applyAppointmentMeta(appt)
        }
        if (apptId) setActiveAppointmentId(apptId)
      } else {
        setPatient(null)
        setHistory(null)
        setRecentVisits([])
      }

      const [{ data: tpls }, { data: favs }, { data: reqTpls }, instResult] = await Promise.all([
        supabase.from('prescription_templates').select('*').eq('tenant_id', tenant.id),
        user
          ? supabase.from('doctor_favorite_drugs').select('*').eq('doctor_id', user.id)
          : Promise.resolve({ data: [] }),
        supabase.from('request_templates').select('*').eq('tenant_id', tenant.id),
        supabase.from('instruction_templates').select('id, name, body').eq('tenant_id', tenant.id).order('name'),
      ])
      setTemplates((tpls as PrescriptionTemplate[]) ?? [])
      setFavorites(favs ?? [])
      setRequestTemplates((reqTpls as RequestTemplate[]) ?? [])
      if (!instResult.error) {
        setInstructionTemplates((instResult.data as InstructionTemplate[]) ?? [])
      } else {
        setInstructionTemplates([])
      }
      setBooting(false)
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, patientIdParam, visitIdParam, appointmentId, user])

  async function searchPatients(term: string) {
    setPatientSearch(term)
    if (!tenant || term.trim().length < 2) {
      setSearchResults([])
      return
    }
    const { data } = await supabase
      .from('patients')
      .select('*')
      .eq('tenant_id', tenant.id)
      .or(`full_name.ilike.%${term.trim()}%,phone.ilike.%${term.trim()}%`)
      .limit(8)
    setSearchResults((data as Patient[]) ?? [])
  }

  function applyAppointmentMeta(appt: {
    payment_status?: string | null
    visit_kind?: string | null
    fee_amount?: number | null
  } | null) {
    if (!appt) {
      setPaymentStatus(null)
      setVisitKind(null)
      setFeeAmount(null)
      return
    }
    setPaymentStatus((appt.payment_status as 'unpaid' | 'paid' | 'waived') ?? 'unpaid')
    const kind = appt.visit_kind === 'follow_up' ? 'follow_up' : appt.visit_kind === 'new_visit' ? 'new_visit' : null
    setVisitKind(kind)
    if (appt.fee_amount != null && Number(appt.fee_amount) > 0) {
      setFeeAmount(Number(appt.fee_amount))
    } else if (kind) {
      setFeeAmount(feeForVisitKind(tenant, kind))
    } else {
      setFeeAmount(feeForVisitKind(tenant, 'new_visit'))
    }
  }

  async function markWithDoctor(apptId: string) {
    await supabase.from('appointments').update({ status: 'with_doctor' }).eq('id', apptId)
    setQueue((prev) => prev.map((a) => (a.id === apptId ? { ...a, status: 'with_doctor' } : a)))
  }

  function resetVisitForm() {
    setVisitId(null)
    setVisit(emptyVisit())
    setDrugs([emptyDrug()])
    setLabItems('')
    setRadItems('')
    setSurgeryRequest('')
    setPatientInstructions('')
    setSelectedInstructionIds([])
    setJustSaved(false)
    setMessage(null)
    setError(null)
  }

  async function selectPatient(p: Patient, apptId?: string | null, opts?: { enterFocus?: boolean }) {
    resetVisitForm()
    setPatient(p)
    setActiveAppointmentId(apptId ?? null)
    setPaymentStatus(null)
    setVisitKind(null)
    setFeeAmount(null)
    setHistory(null)
    setRecentVisits([])
    const next = new URLSearchParams()
    next.set('patientId', p.id)
    if (apptId) next.set('appointmentId', apptId)
    setParams(next, { replace: true })
    if (opts?.enterFocus !== false) setFocusMode(true)
    if (apptId) {
      void markWithDoctor(apptId)
      void supabase
        .from('appointments')
        .select('payment_status, visit_kind, fee_amount')
        .eq('id', apptId)
        .maybeSingle()
        .then(({ data }) => applyAppointmentMeta(data))
    }
    void loadPatientContext(p.id)
  }

  const clinicName = tenant?.name ?? 'ClinicFlow'

  async function finishAppointment(currentVisitId: string) {
    if (!tenant || !patient) return

    async function markDone(appointmentId: string) {
      // Try with payment columns; fall back if migration 006 not applied yet
      const full = await supabase
        .from('appointments')
        .update({
          status: 'done',
          payment_status: 'unpaid',
          visit_id: currentVisitId,
        })
        .eq('id', appointmentId)

      if (full.error) {
        await supabase.from('appointments').update({ status: 'done' }).eq('id', appointmentId)
      }
      setActiveAppointmentId(appointmentId)
      setPaymentStatus('unpaid')
    }

    if (activeAppointmentId) {
      await markDone(activeAppointmentId)
      return
    }

    const start = startOfLocalDay()
    const end = endOfLocalDay()

    const { data: appt } = await supabase
      .from('appointments')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patient.id)
      .gte('scheduled_at', start.toISOString())
      .lte('scheduled_at', end.toISOString())
      .in('status', ['waiting', 'with_doctor', 'done'])
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (appt?.id) {
      await markDone(appt.id)
      return
    }

    // No booking yet — create today's appointment so dashboard KPIs stay in sync
    const { data: created } = await supabase
      .from('appointments')
      .insert({
        tenant_id: tenant.id,
        patient_id: patient.id,
        doctor_id: user?.id ?? null,
        scheduled_at: new Date().toISOString(),
        duration_minutes: 30,
        status: 'done',
      })
      .select('id')
      .single()

    if (created?.id) {
      await markDone(created.id)
    }
  }

  async function saveAll(e: FormEvent) {
    e.preventDefault()
    if (!tenant || !patient) return
    setBusy(true)
    setError(null)
    setMessage(null)

    const specialtyBlock = specialtyPack.extraVisitHints
      .map((h) => {
        const val = specialtyNotes[h.key]?.trim()
        if (!val) return null
        const label = i18n.language === 'en' ? h.labelEn : h.labelAr
        return `${label}: ${val}`
      })
      .filter(Boolean)
      .join('\n')
    const notesMerged = [visit.notes, specialtyBlock].filter(Boolean).join('\n').trim()
    const visitPayload = { ...visit, notes: notesMerged }

    let currentVisitId = visitId
    if (!currentVisitId) {
      const { data, error: vErr } = await supabase
        .from('visits')
        .insert({
          tenant_id: tenant.id,
          patient_id: patient.id,
          doctor_id: user?.id ?? null,
          visit_date: new Date().toISOString(),
          ...visitPayload,
          follow_up_date: visit.follow_up_date || null,
          status: 'completed',
        })
        .select('id')
        .single()
      if (vErr || !data) {
        setError(vErr?.message ?? t('common.error'))
        setBusy(false)
        return
      }
      currentVisitId = data.id
      setVisitId(currentVisitId)
    } else {
      const { error: uErr } = await supabase
        .from('visits')
        .update({
          ...visitPayload,
          follow_up_date: visit.follow_up_date || null,
          status: 'completed',
        })
        .eq('id', currentVisitId)
      if (uErr) {
        setError(uErr.message)
        setBusy(false)
        return
      }
    }

    const validDrugs = drugs.filter((d) => d.drug_name.trim())
    if (validDrugs.length) {
      const { data: existing } = await supabase
        .from('prescriptions')
        .select('id')
        .eq('visit_id', currentVisitId)
        .maybeSingle()

      let prescriptionId = existing?.id as string | undefined
      if (!prescriptionId) {
        const { data: rx, error: rxErr } = await supabase
          .from('prescriptions')
          .insert({ tenant_id: tenant.id, visit_id: currentVisitId })
          .select('id')
          .single()
        if (rxErr || !rx) {
          setError(rxErr?.message ?? t('common.error'))
          setBusy(false)
          return
        }
        prescriptionId = rx.id
      } else {
        await supabase.from('prescription_items').delete().eq('prescription_id', prescriptionId)
      }

      await supabase.from('prescription_items').insert(
        validDrugs.map((d) => ({
          prescription_id: prescriptionId!,
          drug_name: d.drug_name,
          dosage: d.dosage || null,
          duration: d.duration || null,
          notes: d.notes || null,
        })),
      )
    }

    if (labItems.trim()) {
      await supabase.from('lab_requests').insert({
        tenant_id: tenant.id,
        visit_id: currentVisitId,
        items: labItems.split('\n').map((x) => x.trim()).filter(Boolean),
        status: 'pending',
      })
    }
    if (radItems.trim()) {
      await supabase.from('radiology_requests').insert({
        tenant_id: tenant.id,
        visit_id: currentVisitId,
        items: radItems.split('\n').map((x) => x.trim()).filter(Boolean),
        status: 'pending',
      })
    }
    if (surgeryRequest.trim()) {
      await supabase
        .from('visits')
        .update({ notes: `${visit.notes}\n[Surgery] ${surgeryRequest}`.trim() })
        .eq('id', currentVisitId)
    }

    if (!currentVisitId) {
      setError(t('common.error'))
      setBusy(false)
      return
    }

    await finishAppointment(currentVisitId)

    setMessage(t('consultation.saved'))
    setJustSaved(true)
    setPaymentStatus('unpaid')
    const fee =
      feeAmount ??
      (visitKind ? feeForVisitKind(tenant, visitKind) : feeForVisitKind(tenant, 'new_visit'))
    setFeeAmount(fee)
    setToast({
      message: t('consultation.savedToast', {
        amount: fee.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      }),
      tone: 'success',
    })
    setBusy(false)
    void refreshQueue()

    const printable = drugs.filter((d) => d.drug_name.trim())
    if (printable.length && patient) {
      // Keep print one-click ready; user confirms via success panel
    }
  }

  function printBrand() {
    return {
      clinicName,
      logoUrl: tenant?.logo_url,
      clinicPhone: tenant?.phone,
      clinicAddress: tenant?.address,
      doctorName: user?.full_name ?? '',
      format: (tenant?.print_format === 'thermal' ? 'thermal' : 'a4') as 'thermal' | 'a4',
    }
  }

  function printRxNow() {
    if (!patient) return
    printPrescription({
      ...printBrand(),
      patientName: patient.full_name,
      fileNumber: patient.file_number,
      doctorName: user?.full_name ?? '',
      diagnosis: visit.diagnosis,
      drugs: drugs.filter((d) => d.drug_name.trim()),
      stampUrl: tenant?.stamp_url,
      signatureUrl: tenant?.doctor_signature_url,
    })
  }

  function printDischargeNow() {
    if (!patient) return
    const text =
      patientInstructions.trim() ||
      visit.treatment_plan.trim() ||
      visit.notes.trim() ||
      undefined
    printDischargeSlip({
      ...printBrand(),
      patientName: patient.full_name,
      fileNumber: patient.file_number,
      doctorName: user?.full_name ?? '',
      diagnosis: visit.diagnosis,
      drugs: drugs.filter((d) => d.drug_name.trim()),
      followUpDate: visit.follow_up_date || undefined,
      instructions: text,
    })
  }

  function toggleInstructionTemplate(tpl: InstructionPick | InstructionTemplate) {
    setSelectedInstructionIds((prev) => {
      const on = prev.includes(tpl.id)
      const next = on ? prev.filter((id) => id !== tpl.id) : [...prev, tpl.id]
      const bodies = allInstructionPicks
        .filter((t) => next.includes(t.id))
        .map((t) => t.body.trim())
        .filter(Boolean)
      setPatientInstructions(bodies.join('\n\n———\n\n'))
      return next
    })
  }

  function clearPatientInstructions() {
    setSelectedInstructionIds([])
    setPatientInstructions('')
  }

  function clearToPicker() {
    setJustSaved(false)
    setMessage(null)
    setPatient(null)
    setVisitId(null)
    setActiveAppointmentId(null)
    setPaymentStatus(null)
    setHistory(null)
    setRecentVisits([])
    setVisit(emptyVisit())
    setDrugs([emptyDrug()])
    setLabItems('')
    setRadItems('')
    setSurgeryRequest('')
    setPatientInstructions('')
    setSelectedInstructionIds([])
    setSpecialtyNotes({})
    setParams({}, { replace: true })
  }

  async function goToNextPatient() {
    const rows = await refreshQueue()
    const next =
      rows.find((a) => a.status === 'waiting' && a.patient_id !== patient?.id) ??
      rows.find((a) => a.status === 'with_doctor' && a.patient_id !== patient?.id && a.id !== activeAppointmentId)

    if (!next) {
      clearToPicker()
      return
    }

    const { data: p } = await supabase.from('patients').select('*').eq('id', next.patient_id).maybeSingle()
    if (p) await selectPatient(p as Patient, next.id)
    else clearToPicker()
  }

  function applyTemplate(tpl: PrescriptionTemplate) {
    const items = Array.isArray(tpl.items) ? tpl.items : []
    setDrugs(
      items.length
        ? items.map((i) => ({
            drug_name: i.drug_name,
            dosage: i.dosage ?? '',
            duration: i.duration ?? '',
            notes: i.notes ?? '',
          }))
        : [emptyDrug()],
    )
  }

  const canPrint = useMemo(() => drugs.some((d) => d.drug_name.trim()), [drugs])
  const waitingAhead = useMemo(
    () => queue.filter((a) => a.status === 'waiting' && a.patient_id !== patient?.id).length,
    [queue, patient?.id],
  )

  const clinicalAlerts = useMemo(() => {
    const alerts: { tone: 'danger' | 'warning' | 'info'; text: string }[] = []
    if (history?.allergies?.trim()) {
      alerts.push({ tone: 'danger', text: `${t('patients.allergies')}: ${history.allergies.trim()}` })
    }
    if (history?.chronic_diseases?.trim()) {
      alerts.push({
        tone: 'warning',
        text: `${t('patients.chronic')}: ${history.chronic_diseases.trim()}`,
      })
    }
    if (history?.pregnancy_status?.trim()) {
      alerts.push({
        tone: 'info',
        text: `${t('patients.pregnancy')}: ${history.pregnancy_status.trim()}`,
      })
    }
    const drugConflicts = detectDrugAllergyConflicts(
      history?.allergies,
      drugs.map((d) => d.drug_name),
      i18n.language === 'en' ? 'en' : 'ar',
    )
    for (const msg of drugConflicts) {
      alerts.push({ tone: 'danger', text: `${t('consultation.allergyDrugConflict')}: ${msg}` })
    }
    return alerts
  }, [history, t, drugs, i18n.language])

  const triggerSave = useCallback(() => {
    if (busy || justSaved || !patient) return
    formRef.current?.requestSubmit()
  }, [busy, justSaved, patient])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === 's') {
        e.preventDefault()
        triggerSave()
      } else if (key === 'p' && patient && canPrint) {
        e.preventDefault()
        printRxNow()
      } else if (key === 'enter' && justSaved) {
        e.preventDefault()
        void goToNextPatient()
      } else if (key === 'f' && patient) {
        e.preventDefault()
        toggleFocusMode()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerSave, patient, canPrint, justSaved, toggleFocusMode, visit, drugs, clinicName, tenant, user])

  if (booting) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-md flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon name="medical_services" className="animate-pulse text-3xl" />
          </div>
          <p className="text-on-surface-variant">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="cf-consult space-y-lg">
        <header className="cf-consult-hero">
          <div className="min-w-0">
            <p className="cf-consult-kicker">{t('nav.consultation')}</p>
            <h1 className="font-headline-md text-headline-md font-bold text-on-surface">{t('consultation.title')}</h1>
            <p className="mt-xs max-w-xl text-body-md text-on-surface-variant">{t('consultation.pickPatient')}</p>
          </div>
          <button
            type="button"
            className={`cf-btn ${focusMode ? 'cf-btn-primary' : 'cf-btn-secondary'}`}
            onClick={toggleFocusMode}
            title={t('consultation.focusHint')}
          >
            <Icon name={focusMode ? 'fullscreen_exit' : 'fullscreen'} />
            {focusMode ? t('consultation.exitFocus') : t('consultation.focusMode')}
          </button>
        </header>

        <div className="grid gap-lg lg:grid-cols-[1.4fr_1fr]">
          <section className="cf-consult-panel cf-panel-enter">
            <div className="cf-consult-panel-head">
              <div className="flex items-center gap-sm">
                <span className="cf-consult-step">1</span>
                <div>
                  <h2 className="font-semibold text-on-surface">{t('consultation.queueTitle')}</h2>
                  <p className="text-xs text-outline">{queue.length} {t('consultation.inQueue')}</p>
                </div>
              </div>
              {queuePulse && <span className="cf-badge cf-badge-success">{t('waiting.liveUpdated')}</span>}
            </div>

            {queue.length === 0 ? (
              <div className="cf-consult-empty">
                <Icon name="hourglass_empty" className="text-4xl text-outline" />
                <p>{t('consultation.noQueue')}</p>
              </div>
            ) : (
              <ol className="space-y-sm">
                {queue.map((a, idx) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        void (async () => {
                          const { data: p } = await supabase
                            .from('patients')
                            .select('*')
                            .eq('id', a.patient_id)
                            .maybeSingle()
                          if (p) await selectPatient(p as Patient, a.id)
                        })()
                      }}
                      className="cf-consult-queue-row group"
                    >
                      <span
                        className={`cf-consult-queue-num ${
                          a.status === 'waiting'
                            ? 'bg-orange-100 text-orange-800'
                            : a.status === 'with_doctor'
                              ? 'bg-primary-fixed text-primary'
                              : ''
                        }`}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1 text-start">
                        <div className="truncate font-semibold text-on-surface group-hover:text-primary">
                          {a.patients?.full_name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-md gap-y-xs text-xs text-on-surface-variant">
                          <span>#{a.patients?.file_number}</span>
                          <span className={appointmentStatusBadgeClass(a.status)}>
                            {t(`appointments.status.${a.status}`)}
                          </span>
                        </div>
                      </div>
                      <span className="cf-btn cf-btn-primary shrink-0 py-sm text-xs opacity-90 group-hover:opacity-100">
                        {t('consultation.start')}
                        <Icon name="arrow_back" className="text-base" />
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="cf-consult-panel cf-panel-enter">
            <div className="cf-consult-panel-head">
              <div className="flex items-center gap-sm">
                <span className="cf-consult-step">2</span>
                <h2 className="font-semibold text-on-surface">{t('consultation.allPatients')}</h2>
              </div>
            </div>
            <div className="relative mb-md">
              <Icon
                name="search"
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-outline"
              />
              <input
                className="cf-input ps-10"
                placeholder={t('patients.search')}
                value={patientSearch}
                onChange={(e) => void searchPatients(e.target.value)}
              />
            </div>
            <div className="max-h-72 space-y-xs overflow-y-auto">
              {searchResults.length === 0 && patientSearch.trim().length >= 2 ? (
                <p className="py-md text-center text-sm text-on-surface-variant">{t('patients.empty')}</p>
              ) : (
                searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void selectPatient(p)}
                    className="flex w-full items-center justify-between rounded-lg px-md py-sm text-start transition hover:bg-surface-container-low"
                  >
                    <span className="font-medium">
                      {p.full_name}{' '}
                      <span className="text-xs font-normal text-on-surface-variant">#{p.file_number}</span>
                    </span>
                    <Icon name="chevron_left" className="text-outline" />
                  </button>
                ))
              )}
            </div>
            <Link
              to="/patients"
              className="mt-md inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {t('nav.patients')}
              <Icon name="arrow_back" className="text-base" />
            </Link>
          </section>
        </div>
      </div>
    )
  }

  const patientInitial = patient.full_name.trim().charAt(0) || '?'
  const displayFee =
    feeAmount ??
    (visitKind ? feeForVisitKind(tenant, visitKind) : Number(tenant?.consultation_fee ?? 0))

  return (
    <div className={`cf-consult cf-page-enter space-y-md ${focusMode ? 'cf-consult--focus' : ''}`}>
      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone}
        onDismiss={() => setToast(null)}
      />

      {/* Clinical patient banner */}
      <header className={`cf-consult-banner cf-banner-live ${queuePulse ? 'is-live' : ''}`}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-md">
          <div className="cf-consult-avatar" aria-hidden>
            {patientInitial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-sm">
              <h1 className="truncate text-xl font-bold text-on-surface sm:text-2xl">{patient.full_name}</h1>
              <span className="cf-badge cf-badge-muted">#{patient.file_number}</span>
              {visitKind && (
                <span
                  className={
                    visitKind === 'follow_up' ? 'cf-badge cf-badge-success' : 'cf-badge cf-badge-info'
                  }
                >
                  {visitKind === 'follow_up'
                    ? t('secretary.visitFollowUp')
                    : t('secretary.visitNew')}
                </span>
              )}
              {displayFee > 0 && (
                <span className="cf-badge cf-badge-muted">
                  {displayFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                  {t('secretary.currency')}
                </span>
              )}
              {paymentStatus && (
                <span
                  className={
                    paymentStatus === 'paid'
                      ? 'cf-badge cf-badge-success'
                      : paymentStatus === 'waived'
                        ? 'cf-badge cf-badge-muted'
                        : 'cf-badge cf-badge-warning'
                  }
                >
                  {t(
                    `consultation.payment${paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'waived' ? 'Waived' : 'Unpaid'}`,
                  )}
                </span>
              )}
              {waitingAhead > 0 && (
                <span className={`cf-badge cf-badge-info ${queuePulse ? 'ring-2 ring-secondary' : ''}`}>
                  {t('consultation.waitingAhead', { count: waitingAhead })}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-on-surface-variant">
              {t('consultation.title')}
              {tenant?.specialty ? ` · ${t(`specialty.${specialtyPack.id}`)}` : ''}
              {patient.phone ? ` · ${patient.phone}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-sm">
          <Link to={`/patients/${patient.id}`} className="cf-btn cf-btn-ghost py-sm text-xs">
            <Icon name="folder_open" className="text-base" />
            {t('patients.openFile')}
          </Link>
          <button
            type="button"
            className={`cf-btn py-sm text-xs ${focusMode ? 'cf-btn-primary' : 'cf-btn-ghost'}`}
            onClick={toggleFocusMode}
            title={t('consultation.focusHint')}
          >
            <Icon name={focusMode ? 'fullscreen_exit' : 'fullscreen'} className="text-base" />
            {focusMode ? t('consultation.exitFocus') : t('consultation.focusMode')}
          </button>
          <button
            type="button"
            disabled={!canPrint}
            onClick={printRxNow}
            className="cf-btn cf-btn-secondary py-sm text-xs"
          >
            <Icon name="print" className="text-base" />
            {t('consultation.printRx')}
          </button>
        </div>
      </header>

      {justSaved && (
        <div className="cf-consult-success cf-success-pop">
          <div className="flex items-start gap-md">
            <div className="cf-check-burst flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-on-secondary">
              <Icon name="check" filled />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-on-surface">{t('consultation.saved')}</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                {t('consultation.afterSaveCollect', {
                  amount: (displayFee || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }),
                })}
              </p>
              <div className="mt-md flex flex-wrap gap-sm">
                <button
                  type="button"
                  className="cf-btn cf-btn-primary"
                  onClick={() => {
                    setToast({ message: t('consultation.nextPatient'), tone: 'info' })
                    void goToNextPatient()
                  }}
                >
                  <Icon name="skip_next" />
                  {t('consultation.nextPatient')}
                </button>
                {canPrint && (
                  <button type="button" className="cf-btn cf-btn-secondary" onClick={printRxNow}>
                    <Icon name="print" />
                    {t('consultation.printRx')}
                  </button>
                )}
                <button type="button" className="cf-btn cf-btn-ghost" onClick={printDischargeNow}>
                  <Icon name="description" />
                  {t('consultation.printDischarge')}
                </button>
                <Link to="/desk" className="cf-btn cf-btn-ghost">
                  {t('dashboard.openDesk')}
                </Link>
                <Link to="/waiting" className="cf-btn cf-btn-ghost">
                  {t('appointments.waitingRoom')}
                </Link>
              </div>
              <p className="mt-sm text-xs text-outline">{t('consultation.shortcutNext')}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-error/30 bg-error-container px-md py-sm text-sm text-on-error-container">
          {error}
        </p>
      )}
      {message && !justSaved && <p className="text-sm text-primary">{message}</p>}

      <div className="grid items-start gap-md xl:grid-cols-[minmax(0,1fr)_280px]">
        <form ref={formRef} onSubmit={saveAll} className="space-y-md">
          {/* Visit notes */}
          <section className="cf-consult-panel cf-panel-enter">
            <div className="cf-consult-panel-head">
              <div className="flex items-center gap-sm">
                <span className="cf-consult-step">1</span>
                <h2 className="font-semibold">{t('consultation.clinicalNotes')}</h2>
              </div>
            </div>
            <div className="grid gap-md sm:grid-cols-2">
              {(
                [
                  ['chief_complaint', t('visits.chiefComplaint'), 2],
                  ['history_of_present_illness', t('visits.hpi'), 3],
                  ['clinical_exam', t('visits.exam'), 3],
                ] as const
              ).map(([key, label, rows]) => (
                <label key={key} className="block sm:col-span-2">
                  <span className="cf-label">{label}</span>
                  <textarea
                    className="cf-input cf-consult-textarea"
                    rows={rows}
                    value={visit[key]}
                    onChange={(e) => setVisit((v) => ({ ...v, [key]: e.target.value }))}
                  />
                </label>
              ))}

              <label className="block sm:col-span-2">
                <span className="cf-label">{t('visits.diagnosis')}</span>
                <textarea
                  className="cf-input cf-consult-textarea cf-consult-dx"
                  rows={2}
                  value={visit.diagnosis}
                  onChange={(e) => setVisit((v) => ({ ...v, diagnosis: e.target.value }))}
                  placeholder={t('consultation.diagnosisHint')}
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="cf-label">{t('visits.plan')}</span>
                <textarea
                  className="cf-input cf-consult-textarea"
                  rows={2}
                  value={visit.treatment_plan}
                  onChange={(e) => setVisit((v) => ({ ...v, treatment_plan: e.target.value }))}
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="cf-label">{t('visits.notes')}</span>
                <textarea
                  className="cf-input cf-consult-textarea"
                  rows={2}
                  value={visit.notes}
                  onChange={(e) => setVisit((v) => ({ ...v, notes: e.target.value }))}
                />
              </label>

              <label className="block">
                <span className="cf-label">{t('visits.followUp')}</span>
                <input
                  type="date"
                  className="cf-input"
                  value={visit.follow_up_date}
                  onChange={(e) => setVisit((v) => ({ ...v, follow_up_date: e.target.value }))}
                />
              </label>

              {specialtyPack.extraVisitHints.length > 0 && (
                <div className="sm:col-span-2 grid gap-md rounded-xl border border-primary/20 bg-primary-fixed/25 p-md sm:grid-cols-2">
                  <h3 className="sm:col-span-2 text-sm font-semibold text-primary">
                    {t(`specialty.${specialtyPack.id}`)} — {t('consultation.specialtyFields')}
                  </h3>
                  {specialtyPack.extraVisitHints.map((h) => (
                    <label key={h.key} className="block">
                      <span className="cf-label">{i18n.language === 'en' ? h.labelEn : h.labelAr}</span>
                      <input
                        className="cf-input"
                        value={specialtyNotes[h.key] ?? ''}
                        onChange={(e) =>
                          setSpecialtyNotes((prev) => ({ ...prev, [h.key]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Prescription */}
          <section className="cf-consult-panel cf-panel-enter">
            <div className="cf-consult-panel-head">
              <div className="flex items-center gap-sm">
                <span className="cf-consult-step">2</span>
                <h2 className="font-semibold">{t('consultation.prescription')}</h2>
              </div>
            </div>

            {(templates.length > 0 || favorites.length > 0) && (
              <div className="mb-md flex flex-wrap gap-xs border-b border-outline-variant/60 pb-md">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="cf-btn cf-btn-ghost px-2 py-1 text-xs"
                  >
                    <Icon name="description" className="text-sm" />
                    {tpl.name}
                  </button>
                ))}
                {favorites.map((f) => (
                  <button
                    key={f.drug_name}
                    type="button"
                    onClick={() =>
                      setDrugs((d) => [
                        ...d,
                        {
                          drug_name: f.drug_name,
                          dosage: f.dosage ?? '',
                          duration: f.duration ?? '',
                          notes: '',
                        },
                      ])
                    }
                    className="rounded-lg bg-primary-fixed/50 px-2 py-1 text-xs font-medium text-on-primary-fixed-variant transition hover:bg-primary-fixed"
                  >
                    + {f.drug_name}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-sm">
              <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-outline sm:grid">
                <span>{t('consultation.drug')}</span>
                <span>{t('consultation.dosage')}</span>
                <span>{t('consultation.duration')}</span>
                <span>{t('visits.notes')}</span>
                <span />
              </div>
              {drugs.map((d, idx) => (
                <div key={idx} className="cf-consult-drug-row">
                  <DrugAutocomplete
                    placeholder={t('consultation.drug')}
                    value={d.drug_name}
                    onChange={(drug_name) =>
                      setDrugs((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, drug_name } : r)),
                      )
                    }
                  />
                  <DosageSelect
                    value={d.dosage}
                    onChange={(dosage) =>
                      setDrugs((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, dosage } : r)),
                      )
                    }
                  />
                  <DurationSelect
                    value={d.duration}
                    onChange={(duration) =>
                      setDrugs((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, duration } : r)),
                      )
                    }
                  />
                  <input
                    className="cf-input"
                    placeholder={t('visits.notes')}
                    value={d.notes}
                    onChange={(e) =>
                      setDrugs((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, notes: e.target.value } : r)),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="cf-btn cf-btn-ghost px-2 py-2 text-error"
                    title={t('common.delete')}
                    disabled={drugs.length <= 1}
                    onClick={() => setDrugs((rows) => rows.filter((_, i) => i !== idx))}
                  >
                    <Icon name="close" className="text-base" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="cf-btn cf-btn-ghost px-2 py-1 text-sm"
                onClick={() => setDrugs((d) => [...d, emptyDrug()])}
              >
                <Icon name="add" />
                {t('consultation.addDrug')}
              </button>
            </div>
          </section>

          {/* Patient instructions / discharge */}
          <section className="cf-consult-panel cf-panel-enter">
            <div className="cf-consult-panel-head">
              <div className="flex items-center gap-sm">
                <span className="cf-consult-step">4</span>
                <div>
                  <h2 className="font-semibold">{t('consultation.patientInstructions')}</h2>
                  <p className="text-xs text-outline">{t('consultation.patientInstructionsHint')}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-sm">
                <Link to="/templates" className="cf-btn cf-btn-ghost py-sm text-xs">
                  <Icon name="edit_note" className="text-base" />
                  {t('consultation.manageInstructions')}
                </Link>
                <button
                  type="button"
                  className="cf-btn cf-btn-secondary py-sm text-xs"
                  onClick={printDischargeNow}
                  disabled={!patientInstructions.trim() && !visit.diagnosis.trim() && !canPrint}
                >
                  <Icon name="print" className="text-base" />
                  {t('consultation.printDischarge')}
                </button>
              </div>
            </div>

            {allInstructionPicks.length > 0 ? (
              <div className="mb-md space-y-md">
                <div>
                  <p className="cf-label mb-sm">
                    {t('consultation.specialtyInstructions', {
                      specialty: t(`specialty.${specialtyPack.id}`),
                    })}
                  </p>
                  <div className="flex flex-wrap gap-sm">
                    {builtinInstructionPicks.map((tpl) => {
                      const on = selectedInstructionIds.includes(tpl.id)
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => toggleInstructionTemplate(tpl)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                            on
                              ? 'border-primary bg-primary text-on-primary'
                              : 'border-outline-variant bg-surface text-on-surface hover:border-primary'
                          }`}
                        >
                          {on ? '✓ ' : '+ '}
                          {tpl.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {customInstructionPicks.length > 0 ? (
                  <div>
                    <p className="cf-label mb-sm">{t('consultation.customInstructions')}</p>
                    <div className="flex flex-wrap gap-sm">
                      {customInstructionPicks.map((tpl) => {
                        const on = selectedInstructionIds.includes(tpl.id)
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => toggleInstructionTemplate(tpl)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                              on
                                ? 'border-primary bg-primary text-on-primary'
                                : 'border-outline-variant bg-surface text-on-surface hover:border-primary'
                            }`}
                          >
                            {on ? '✓ ' : '+ '}
                            {tpl.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mb-md rounded-lg border border-dashed border-outline-variant px-md py-sm text-xs text-on-surface-variant">
                {t('consultation.noInstructionTemplates')}{' '}
                <Link to="/templates" className="font-medium text-primary underline">
                  {t('consultation.manageInstructions')}
                </Link>
              </p>
            )}

            <label className="block">
              <span className="cf-label">{t('consultation.instructionsText')}</span>
              <textarea
                className="cf-input cf-consult-textarea"
                rows={5}
                value={patientInstructions}
                onChange={(e) => {
                  setPatientInstructions(e.target.value)
                  // Manual edit clears rigid selection tracking so user can mix freely
                  if (selectedInstructionIds.length) setSelectedInstructionIds([])
                }}
                placeholder={t('consultation.instructionsPlaceholder')}
              />
            </label>
            <div className="mt-sm flex flex-wrap gap-sm">
              <button
                type="button"
                className="cf-btn cf-btn-ghost py-sm text-xs"
                disabled={!patientInstructions}
                onClick={clearPatientInstructions}
              >
                {t('consultation.clearInstructions')}
              </button>
            </div>
          </section>

          {/* Requests */}
          <section className="cf-consult-panel cf-panel-enter">
            <div className="cf-consult-panel-head">
              <div className="flex items-center gap-sm">
                <span className="cf-consult-step">5</span>
                <h2 className="font-semibold">{t('consultation.requests')}</h2>
              </div>
            </div>
            <div className="grid gap-md lg:grid-cols-3">
              <div className="cf-consult-request-card">
                <div className="mb-sm flex items-center gap-sm font-medium text-on-surface">
                  <Icon name="science" className="text-primary" />
                  {t('consultation.labs')}
                </div>
                <div className="mb-sm flex flex-wrap gap-1">
                  {specialtyPack.suggestedLabs.length > 0 && (
                    <button
                      type="button"
                      className="cf-btn cf-btn-ghost px-2 py-0.5 text-xs"
                      onClick={() => setLabItems(specialtyPack.suggestedLabs.join('\n'))}
                    >
                      {t('consultation.specialtyLabs')}
                    </button>
                  )}
                  {requestTemplates
                    .filter((tpl) => tpl.type === 'lab')
                    .map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        className="cf-btn cf-btn-ghost px-2 py-0.5 text-xs"
                        onClick={() =>
                          setLabItems((Array.isArray(tpl.items) ? tpl.items : []).join('\n'))
                        }
                      >
                        {tpl.name}
                      </button>
                    ))}
                </div>
                <ExamCatalogPicker
                  compact
                  tenantSpecialty={tenant?.specialty}
                  target="lab"
                  onPick={(line) =>
                    setLabItems((prev) => (prev.trim() ? `${prev.trim()}\n${line}` : line))
                  }
                />
                <textarea
                  className="cf-input cf-consult-textarea"
                  rows={4}
                  value={labItems}
                  onChange={(e) => setLabItems(e.target.value)}
                  placeholder={t('consultation.onePerLine')}
                />
                <button
                  type="button"
                  className="cf-btn cf-btn-ghost mt-sm w-full py-sm text-xs"
                  disabled={!labItems.trim()}
                  onClick={() =>
                    printRequestList({
                      ...printBrand(),
                      kind: 'lab',
                      title: t('consultation.labs'),
                      patientName: patient.full_name,
                      fileNumber: patient.file_number,
                      diagnosis: visit.diagnosis,
                      items: labItems.split('\n').map((x) => x.trim()).filter(Boolean),
                    })
                  }
                >
                  <Icon name="print" className="text-base" />
                  {t('billing.print')}
                </button>
              </div>

              <div className="cf-consult-request-card">
                <div className="mb-sm flex items-center gap-sm font-medium text-on-surface">
                  <Icon name="biotech" className="text-primary" />
                  {t('consultation.radiology')}
                </div>
                <div className="mb-sm flex flex-wrap gap-1">
                  {requestTemplates
                    .filter((tpl) => tpl.type === 'radiology')
                    .map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        className="cf-btn cf-btn-ghost px-2 py-0.5 text-xs"
                        onClick={() =>
                          setRadItems((Array.isArray(tpl.items) ? tpl.items : []).join('\n'))
                        }
                      >
                        {tpl.name}
                      </button>
                    ))}
                </div>
                <ExamCatalogPicker
                  compact
                  tenantSpecialty={tenant?.specialty}
                  target="radiology"
                  onPick={(line) =>
                    setRadItems((prev) => (prev.trim() ? `${prev.trim()}\n${line}` : line))
                  }
                />
                <textarea
                  className="cf-input cf-consult-textarea"
                  rows={4}
                  value={radItems}
                  onChange={(e) => setRadItems(e.target.value)}
                  placeholder={t('consultation.onePerLine')}
                />
                <button
                  type="button"
                  className="cf-btn cf-btn-ghost mt-sm w-full py-sm text-xs"
                  disabled={!radItems.trim()}
                  onClick={() =>
                    printRequestList({
                      ...printBrand(),
                      kind: 'radiology',
                      title: t('consultation.radiology'),
                      patientName: patient.full_name,
                      fileNumber: patient.file_number,
                      diagnosis: visit.diagnosis,
                      items: radItems.split('\n').map((x) => x.trim()).filter(Boolean),
                    })
                  }
                >
                  <Icon name="print" className="text-base" />
                  {t('billing.print')}
                </button>
              </div>

              <div className="cf-consult-request-card">
                <div className="mb-sm flex items-center gap-sm font-medium text-on-surface">
                  <Icon name="healing" className="text-primary" />
                  {t('consultation.surgery')}
                </div>
                <textarea
                  className="cf-input cf-consult-textarea"
                  rows={4}
                  value={surgeryRequest}
                  onChange={(e) => setSurgeryRequest(e.target.value)}
                />
              </div>
            </div>
          </section>

          <div
            className={`flex flex-wrap items-center justify-between gap-md rounded-xl border border-outline-variant bg-surface-container-lowest px-md py-md ${
              focusMode ? 'invisible h-0 overflow-hidden border-0 p-0' : ''
            }`}
          >
            <p className="text-xs text-outline">{t('consultation.shortcuts')}</p>
            <button
              type="submit"
              disabled={busy || justSaved}
              className={`cf-btn cf-btn-primary px-8 py-2.5 ${busy ? 'is-busy' : ''}`}
            >
              <Icon name="save" />
              {busy ? t('common.loading') : t('consultation.save')}
            </button>
          </div>
        </form>

        {/* Context rail */}
        <aside className="space-y-md xl:sticky xl:top-20">
          {clinicalAlerts.length > 0 && (
            <section className="cf-consult-rail cf-consult-rail--alerts">
              <h3 className="mb-sm flex items-center gap-sm text-sm font-bold">
                <Icon name="warning" className="text-error" />
                {t('consultation.alerts')}
              </h3>
              <ul className="space-y-sm">
                {clinicalAlerts.map((a) => (
                  <li
                    key={a.text}
                    className={`rounded-lg px-sm py-sm text-xs leading-relaxed ${
                      a.tone === 'danger'
                        ? 'bg-error-container text-on-error-container'
                        : a.tone === 'warning'
                          ? 'bg-surface-container-high text-on-surface'
                          : 'bg-primary-fixed/50 text-on-primary-fixed'
                    }`}
                  >
                    {a.text}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="cf-consult-rail">
            <h3 className="mb-sm flex items-center gap-sm text-sm font-semibold text-on-surface">
              <Icon name="history" className="text-primary" />
              {t('consultation.recentVisits')}
            </h3>
            {recentVisits.length === 0 ? (
              <p className="text-xs text-outline">{t('consultation.noRecent')}</p>
            ) : (
              <ul className="space-y-sm">
                {recentVisits.map((v) => (
                  <li key={v.id} className="border-s-2 border-primary/40 ps-sm text-sm">
                    <div className="text-[11px] font-medium text-outline">
                      {new Date(v.visit_date).toLocaleDateString()}
                    </div>
                    <div className="text-on-surface">
                      {v.diagnosis?.trim() || v.chief_complaint?.trim() || t('consultation.noDx')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cf-consult-rail">
            <h3 className="mb-sm text-sm font-semibold">{t('consultation.quickActions')}</h3>
            <div className="flex flex-col gap-sm">
              <button
                type="button"
                disabled={!canPrint}
                className="cf-btn cf-btn-secondary w-full justify-start text-xs"
                onClick={printRxNow}
              >
                <Icon name="print" className="text-base" />
                {t('consultation.printRx')}
              </button>
              <button
                type="button"
                className="cf-btn cf-btn-ghost w-full justify-start text-xs"
                onClick={printDischargeNow}
              >
                <Icon name="description" className="text-base" />
                {t('consultation.printDischarge')}
              </button>
              <Link to="/waiting" className="cf-btn cf-btn-ghost w-full justify-start text-xs">
                <Icon name="hourglass_top" className="text-base" />
                {t('appointments.waitingRoom')}
              </Link>
            </div>
          </section>
        </aside>
      </div>

      <div className="cf-action-bar fixed inset-x-0 bottom-0 z-50 border-t border-outline-variant bg-surface-container-lowest/95 px-lg py-md shadow-[0_-8px_24px_rgba(11,28,48,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-md">
          <div className="flex min-w-0 items-center gap-sm">
            <div className="cf-consult-avatar cf-consult-avatar--sm">{patientInitial}</div>
            <div className="min-w-0">
              <p className="truncate font-label-md text-label-md font-bold text-on-surface">
                {patient.full_name}
              </p>
              <p className="text-xs text-outline">
                #{patient.file_number}
                {visitKind
                  ? ` · ${visitKind === 'follow_up' ? t('secretary.visitFollowUp') : t('secretary.visitNew')}`
                  : ''}
                {displayFee > 0
                  ? ` · ${displayFee.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${t('secretary.currency')}`
                  : ''}
                {waitingAhead > 0 ? ` · ${t('consultation.waitingAhead', { count: waitingAhead })}` : ''}
                {' · '}
                {t('consultation.shortcuts')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-sm">
            {justSaved ? (
              <button
                type="button"
                className="cf-btn cf-btn-primary"
                onClick={() => {
                  setToast({ message: t('consultation.nextPatient'), tone: 'info' })
                  void goToNextPatient()
                }}
              >
                <Icon name="skip_next" />
                {t('consultation.nextPatient')}
              </button>
            ) : (
                <button
                  type="button"
                  disabled={busy}
                  className={`cf-btn cf-btn-primary ${busy ? 'is-busy' : ''}`}
                  onClick={triggerSave}
                >
                  <Icon name="save" />
                  {busy ? t('common.loading') : t('consultation.save')}
                </button>
            )}
            <button type="button" disabled={!canPrint} className="cf-btn cf-btn-secondary" onClick={printRxNow}>
              <Icon name="print" />
              {t('consultation.printRx')}
            </button>
            <button type="button" className="cf-btn cf-btn-ghost" onClick={toggleFocusMode}>
              <Icon name={focusMode ? 'fullscreen_exit' : 'fullscreen'} />
              {focusMode ? t('consultation.exitFocus') : t('consultation.focusMode')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
