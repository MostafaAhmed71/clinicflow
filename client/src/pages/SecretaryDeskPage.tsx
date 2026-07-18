import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ar, enUS } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useAppointmentsLive } from '../hooks/useAppointmentsLive'
import { Icon } from '../components/Icon'
import { Toast } from '../components/Toast'
import { WhatsAppButton } from '../components/WhatsAppButton'
import { endOfLocalDay, isSameLocalDay, localInputToIso, startOfLocalDay } from '../lib/clinicDay'
import { appointmentReminderMessage } from '../lib/whatsapp'
import { appointmentFee, feeForVisitKind, type VisitKind } from '../lib/visitFees'
import { appointmentStatusBadgeClass } from '../lib/appointmentStatus'
import type { Appointment } from '../types/clinic'
import type { Patient } from '../types/database'

type Doctor = { id: string; full_name: string }

function formatMoney(amount: number, currency: string) {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`
}

export function SecretaryDeskPage() {
  const { t, i18n } = useTranslation()
  const { tenant } = useAuth()
  const locale = i18n.language === 'ar' ? ar : enUS
  const searchRef = useRef<HTMLInputElement>(null)
  const currency = t('secretary.currency')

  const [patientQuery, setPatientQuery] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [doctorId, setDoctorId] = useState('')
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [showQuickPatient, setShowQuickPatient] = useState(false)
  const [showLater, setShowLater] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [flashWaiting, setFlashWaiting] = useState(false)
  const [laterAt, setLaterAt] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
  const [laterKind, setLaterKind] = useState<VisitKind>('new_visit')

  const newFee = feeForVisitKind(tenant, 'new_visit')
  const followFee = feeForVisitKind(tenant, 'follow_up')

  const todayLabel = useMemo(
    () => format(new Date(), 'EEEE d MMMM yyyy', { locale }),
    [locale],
  )

  const resetAfterBook = useCallback(() => {
    setSelectedPatient(null)
    setPatientQuery('')
    setPatients([])
    setShowLater(false)
    setShowQuickPatient(false)
    setLaterAt(format(new Date(), "yyyy-MM-dd'T'HH:mm"))
    setLaterKind('new_visit')
    window.setTimeout(() => searchRef.current?.focus(), 40)
  }, [])

  const loadToday = useCallback(async () => {
    if (!tenant) return
    const from = startOfLocalDay()
    from.setDate(from.getDate() - 1)
    const to = endOfLocalDay()

    const [{ data: appts, error: aErr }, { data: docs }] = await Promise.all([
      supabase
        .from('appointments')
        .select('*, patients(full_name, phone, file_number)')
        .eq('tenant_id', tenant.id)
        .gte('scheduled_at', from.toISOString())
        .lte('scheduled_at', to.toISOString())
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('users')
        .select('id, full_name')
        .eq('tenant_id', tenant.id)
        .in('role', ['doctor', 'clinic_manager'])
        .order('full_name'),
    ])

    if (aErr) setError(aErr.message)
    const today = startOfLocalDay()
    const rows = ((appts as Appointment[]) ?? []).filter(
      (a) => isSameLocalDay(a.scheduled_at, today) || isSameLocalDay(a.created_at, today),
    )
    const doctorList = (docs as Doctor[]) ?? []
    setTodayAppts(rows)
    setDoctors(doctorList)
    setDoctorId((prev) => {
      if (prev && doctorList.some((d) => d.id === prev)) return prev
      return doctorList[0]?.id ?? ''
    })
  }, [tenant])

  useEffect(() => {
    void loadToday()
    const timer = window.setInterval(() => void loadToday(), 30000)
    return () => window.clearInterval(timer)
  }, [loadToday])

  useAppointmentsLive(tenant?.id, () => {
    setFlashWaiting(true)
    void loadToday()
    window.setTimeout(() => setFlashWaiting(false), 1100)
  })

  useEffect(() => {
    async function searchPatients() {
      if (!tenant) return
      const q = patientQuery.trim()
      if (!q) {
        setPatients([])
        return
      }

      let query = supabase
        .from('patients')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('full_name')
        .limit(8)

      const asNumber = Number(q)
      if (!Number.isNaN(asNumber) && /^\d+$/.test(q)) {
        query = query.or(
          `full_name.ilike.%${q}%,phone.ilike.%${q}%,national_id.ilike.%${q}%,file_number.eq.${asNumber}`,
        )
      } else {
        query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,national_id.ilike.%${q}%`)
      }

      const { data, error: err } = await query
      if (err) setError(err.message)
      else setPatients((data as Patient[]) ?? [])
    }

    const handle = window.setTimeout(() => void searchPatients(), 200)
    return () => window.clearTimeout(handle)
  }, [patientQuery, tenant?.id])

  async function createQuickPatient(e: FormEvent) {
    e.preventDefault()
    if (!tenant || !quickName.trim()) return
    setBusy(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('patients')
      .insert({
        tenant_id: tenant.id,
        full_name: quickName.trim(),
        phone: quickPhone.trim() || null,
      })
      .select('*')
      .single()

    if (err) {
      setError(err.message)
      setToast({ message: err.message, tone: 'error' })
      setBusy(false)
      return
    }

    await supabase.from('medical_history').insert({
      patient_id: data.id,
      tenant_id: tenant.id,
    })

    setSelectedPatient(data as Patient)
    setPatientQuery('')
    setPatients([])
    setShowQuickPatient(false)
    setQuickName('')
    setQuickPhone('')
    setBusy(false)
    setToast({ message: t('secretary.patientCreated'), tone: 'success' })
  }

  async function insertBooking(opts: {
    kind: VisitKind
    scheduledIso: string
    payment_status?: 'paid' | 'unpaid'
  }) {
    if (!tenant || !selectedPatient) {
      setToast({ message: t('secretary.pickPatientFirst'), tone: 'error' })
      return false
    }

    const fee = feeForVisitKind(tenant, opts.kind)
    const payment_status = opts.payment_status ?? 'unpaid'
    const base = {
      tenant_id: tenant.id,
      patient_id: selectedPatient.id,
      doctor_id: doctorId || doctors[0]?.id || null,
      scheduled_at: opts.scheduledIso,
      duration_minutes: 30,
      status: 'waiting' as const,
      payment_status,
    }

    let { error: err } = await supabase.from('appointments').insert({
      ...base,
      visit_kind: opts.kind,
      fee_amount: fee,
    })

    if (err && /visit_kind|fee_amount/i.test(err.message)) {
      const retry = await supabase.from('appointments').insert(base)
      err = retry.error
    }

    if (err) {
      const msg = /payment_status/i.test(err.message)
        ? t('secretary.paymentColumnMissing')
        : err.message
      setError(msg)
      setToast({ message: msg, tone: 'error' })
      return false
    }

    if (payment_status === 'paid') {
      await supabase.from('invoices').insert({
        tenant_id: tenant.id,
        patient_id: selectedPatient.id,
        consultation_fee: fee,
        discounts: 0,
        services: [],
        total: fee,
        payment_method: 'cash',
        paid_at: new Date().toISOString(),
      })
    }

    return true
  }

  async function bookNow(kind: VisitKind) {
    if (!selectedPatient) {
      setToast({ message: t('secretary.pickPatientFirst'), tone: 'error' })
      return
    }
    setBusy(true)
    setError(null)
    const ok = await insertBooking({
      kind,
      scheduledIso: new Date().toISOString(),
    })
    if (ok) {
      const label =
        kind === 'follow_up' ? t('secretary.visitFollowUp') : t('secretary.visitNew')
      setToast({
        message: `${selectedPatient.full_name} — ${label} · ${formatMoney(feeForVisitKind(tenant, kind), currency)}`,
        tone: 'success',
      })
      setFlashWaiting(true)
      window.setTimeout(() => setFlashWaiting(false), 1100)
      resetAfterBook()
      await loadToday()
    }
    setBusy(false)
  }

  async function bookLater(e: FormEvent) {
    e.preventDefault()
    if (!selectedPatient) return
    setBusy(true)
    setError(null)
    const ok = await insertBooking({
      kind: laterKind,
      scheduledIso: localInputToIso(laterAt),
    })
    if (ok) {
      setToast({ message: t('secretary.booked'), tone: 'success' })
      resetAfterBook()
      await loadToday()
    }
    setBusy(false)
  }

  async function setPayment(a: Appointment, payment_status: 'paid' | 'unpaid') {
    if (!tenant) return
    if ((a.payment_status ?? 'unpaid') === payment_status) return
    setError(null)

    const { error: err } = await supabase
      .from('appointments')
      .update({ payment_status })
      .eq('id', a.id)

    if (err) {
      const msg = /payment_status/i.test(err.message)
        ? t('secretary.paymentColumnMissing')
        : err.message
      setError(msg)
      setToast({ message: msg, tone: 'error' })
      return
    }

    if (payment_status === 'paid') {
      const fee = appointmentFee(a, tenant)
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('patient_id', a.patient_id)
        .gte('created_at', dayStart.toISOString())
        .limit(1)
        .maybeSingle()

      if (!existing) {
        await supabase.from('invoices').insert({
          tenant_id: tenant.id,
          patient_id: a.patient_id,
          visit_id: a.visit_id ?? null,
          consultation_fee: fee,
          discounts: 0,
          services: [],
          total: fee,
          payment_method: 'cash',
          paid_at: new Date().toISOString(),
        })
      }
    }

    setToast({ message: t('secretary.paymentUpdated'), tone: 'success' })
    await loadToday()
  }

  async function updateStatus(id: string, status: Appointment['status']) {
    const { error: err } = await supabase.from('appointments').update({ status }).eq('id', id)
    if (err) {
      setToast({ message: err.message, tone: 'error' })
      return
    }
    await loadToday()
  }

  const waitingCount = todayAppts.filter((a) => a.status === 'waiting').length
  const unpaidDone = todayAppts.filter(
    (a) => a.status === 'done' && (a.payment_status ?? 'unpaid') !== 'paid',
  )
  const sortedAppts = useMemo(() => {
    const rank = (a: Appointment) => {
      if (a.status === 'done' && (a.payment_status ?? 'unpaid') !== 'paid') return 0
      if (a.status === 'waiting') return 1
      if (a.status === 'with_doctor') return 2
      if (a.status === 'done') return 3
      return 4
    }
    return [...todayAppts].sort((a, b) => rank(a) - rank(b))
  }, [todayAppts])

  const q = patientQuery.trim()
  const showResults = q.length > 0 && !selectedPatient
  const noMatch = showResults && patients.length === 0

  return (
    <div className="space-y-5">
      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone}
        onDismiss={() => setToast(null)}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="cf-page-title">{t('secretary.bookings')}</h1>
          <p className="cf-page-sub">{todayLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div
            className={`cf-card cf-stat border-0 bg-gradient-to-br from-primary-fixed to-white ${
              flashWaiting ? 'cf-stat-flash' : ''
            }`}
          >
            <span className="cf-stat-label text-primary">{t('secretary.waitingNow')}</span>
            <div className="cf-stat-value text-primary">{waitingCount}</div>
          </div>
          <div
            className={`cf-card cf-stat border-0 bg-gradient-to-br from-amber-50 to-white ${
              unpaidDone.length > 0 ? 'cf-live-pulse' : ''
            }`}
          >
            <span className="cf-stat-label text-amber-800">{t('consultation.paymentUnpaid')}</span>
            <div className="cf-stat-value text-amber-800">{unpaidDone.length}</div>
          </div>
        </div>
      </div>

      {unpaidDone.length > 0 && (
        <section className="cf-row-enter cf-panel-alert">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-amber-950">
            <Icon name="payments" filled />
            {t('secretary.collectPayment')} ({unpaidDone.length})
          </h2>
          <div className="space-y-2">
            {unpaidDone.map((a) => (
              <div
                key={a.id}
                className="cf-list-row flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <div>
                  <div className="font-medium">{a.patients?.full_name}</div>
                  <div className="text-xs text-on-surface-variant">
                    {a.visit_kind === 'follow_up'
                      ? t('secretary.visitFollowUp')
                      : t('secretary.visitNew')}{' '}
                    · {formatMoney(appointmentFee(a, tenant), currency)}
                  </div>
                </div>
                <button
                  type="button"
                  className="cf-btn cf-btn-success py-2 text-sm !text-white"
                  onClick={() => void setPayment(a, 'paid')}
                >
                  <Icon name="check" />
                  {formatMoney(appointmentFee(a, tenant), currency)}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="cf-card overflow-hidden">
          <div className="border-b border-outline-variant/60 bg-gradient-to-l from-primary-fixed/40 to-white px-5 py-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-on-surface">
              <Icon name="person_search" className="text-primary" />
              {t('secretary.quickBookTitle')}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">{t('secretary.quickBookHint')}</p>
          </div>

          <div className="space-y-4 p-5">
            {!selectedPatient ? (
              <>
                <div className="relative">
                  <Icon
                    name="search"
                    className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-xl text-on-surface-variant"
                  />
                  <input
                    ref={searchRef}
                    autoFocus
                    className="cf-input py-4 pe-4 ps-12 text-base"
                    placeholder={t('secretary.searchPlaceholder')}
                    value={patientQuery}
                    onChange={(e) => {
                      setPatientQuery(e.target.value)
                      setSelectedPatient(null)
                    }}
                  />
                </div>

                {showResults && (
                  <div className="overflow-hidden rounded-xl border border-outline-variant/70">
                    {noMatch ? (
                      <div className="space-y-3 px-4 py-5 text-center">
                        <p className="text-sm text-on-surface-variant">
                          {t('secretary.noPatientMatch')}
                        </p>
                        <button
                          type="button"
                          className="cf-btn cf-btn-primary"
                          onClick={() => {
                            setShowQuickPatient(true)
                            setQuickName(q)
                          }}
                        >
                          <Icon name="person_add" />
                          {t('secretary.quickAddPatient')}
                        </button>
                      </div>
                    ) : (
                      patients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPatient(p)
                            setPatientQuery('')
                            setPatients([])
                          }}
                          className="flex w-full items-center justify-between border-b border-outline-variant/60 px-4 py-3.5 text-start last:border-b-0 hover:bg-primary-fixed/40"
                        >
                          <span className="font-semibold text-on-surface">{p.full_name}</span>
                          <span className="text-xs text-on-surface-variant">
                            #{p.file_number}
                            {p.phone ? ` · ${p.phone}` : ''}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {!showResults && !showQuickPatient && (
                  <button
                    type="button"
                    className="cf-btn cf-btn-ghost w-full"
                    onClick={() => setShowQuickPatient(true)}
                  >
                    <Icon name="person_add" />
                    {t('secretary.quickAddPatient')}
                  </button>
                )}

                {showQuickPatient && (
                  <form
                    onSubmit={createQuickPatient}
                    className="cf-row-enter grid gap-2 rounded-xl border border-outline-variant/70 bg-surface-container-low/50 p-3 sm:grid-cols-2"
                  >
                    <input
                      required
                      autoFocus
                      className="cf-input"
                      placeholder={t('patients.fullName')}
                      value={quickName}
                      onChange={(e) => setQuickName(e.target.value)}
                    />
                    <input
                      className="cf-input"
                      placeholder={t('patients.phone')}
                      value={quickPhone}
                      onChange={(e) => setQuickPhone(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="cf-btn cf-btn-primary sm:col-span-2"
                    >
                      {t('patients.save')}
                    </button>
                  </form>
                )}
              </>
            ) : (
              <div className="cf-row-enter space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-fixed/50 px-4 py-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {t('secretary.selected')}
                    </div>
                    <div className="text-lg font-bold text-on-surface">
                      {selectedPatient.full_name}
                    </div>
                    <div className="text-sm text-on-surface-variant">
                      #{selectedPatient.file_number}
                      {selectedPatient.phone ? ` · ${selectedPatient.phone}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="cf-btn cf-btn-ghost text-sm"
                    onClick={() => {
                      setSelectedPatient(null)
                      setPatientQuery('')
                      window.setTimeout(() => searchRef.current?.focus(), 40)
                    }}
                  >
                    <Icon name="close" />
                    {t('secretary.changePatient')}
                  </button>
                </div>

                {doctors.length > 1 && (
                  <label className="block">
                    <span className="cf-label">{t('secretary.doctor')}</span>
                    <select
                      className="cf-input"
                      value={doctorId}
                      onChange={(e) => setDoctorId(e.target.value)}
                    >
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <p className="text-center text-sm font-medium text-on-surface-variant">
                  {t('secretary.tapToQueue')}
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void bookNow('new_visit')}
                    className="cf-book-action cf-book-action--new"
                  >
                    <Icon name="medical_services" className="text-3xl" />
                    <span className="text-xl font-bold">{t('secretary.visitNew')}</span>
                    <span className="text-sm opacity-90">{t('secretary.visitNewHint')}</span>
                    <span className="mt-1 text-2xl font-bold tabular-nums">
                      {formatMoney(newFee, currency)}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void bookNow('follow_up')}
                    className="cf-book-action cf-book-action--follow"
                  >
                    <Icon name="event_repeat" className="text-3xl" />
                    <span className="text-xl font-bold">{t('secretary.visitFollowUp')}</span>
                    <span className="text-sm opacity-90">{t('secretary.visitFollowUpHint')}</span>
                    <span className="mt-1 text-2xl font-bold tabular-nums">
                      {formatMoney(followFee, currency)}
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  className="cf-btn cf-btn-ghost w-full text-sm"
                  onClick={() => setShowLater((v) => !v)}
                >
                  <Icon name="schedule" />
                  {showLater ? t('secretary.hideMore') : t('secretary.showMore')}
                </button>

                {showLater && (
                  <form
                    onSubmit={bookLater}
                    className="cf-row-enter grid gap-3 rounded-xl border border-outline-variant/70 p-3 sm:grid-cols-2"
                  >
                    <label className="block sm:col-span-2">
                      <span className="cf-label">{t('secretary.visitKind')}</span>
                      <select
                        className="cf-input"
                        value={laterKind}
                        onChange={(e) => setLaterKind(e.target.value as VisitKind)}
                      >
                        <option value="new_visit">
                          {t('secretary.visitNew')} — {formatMoney(newFee, currency)}
                        </option>
                        <option value="follow_up">
                          {t('secretary.visitFollowUp')} — {formatMoney(followFee, currency)}
                        </option>
                      </select>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="cf-label">{t('appointments.when')}</span>
                      <input
                        type="datetime-local"
                        required
                        className="cf-input"
                        value={laterAt}
                        onChange={(e) => setLaterAt(e.target.value)}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={busy}
                      className="cf-btn cf-btn-secondary sm:col-span-2"
                    >
                      {t('secretary.confirmBooking')}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="cf-card cf-card-section">
          <h2 className="cf-card-header">
            <Icon name="today" />
            {t('secretary.todayList')}
          </h2>
          <div className="max-h-[32rem] space-y-2 overflow-auto pe-1">
            {sortedAppts.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{t('appointments.empty')}</p>
            ) : (
              sortedAppts.map((a) => {
                const unpaid =
                  a.status === 'done' &&
                  (a.payment_status ?? 'unpaid') !== 'paid' &&
                  a.payment_status !== 'waived'
                const tone = unpaid
                  ? 'border-error/35 bg-error-container/25'
                  : a.status === 'waiting'
                    ? 'border-orange-400/40 bg-orange-50/80'
                    : a.status === 'with_doctor'
                      ? 'border-primary/35 bg-primary-fixed/30'
                      : a.status === 'done'
                        ? 'border-secondary/30 bg-secondary-container/20'
                        : 'border-outline-variant/70'
                return (
                  <div key={a.id} className={`cf-list-row text-sm ${tone}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold">{a.patients?.full_name}</div>
                        <div className="text-xs text-on-surface-variant">
                          {format(new Date(a.scheduled_at), 'HH:mm', { locale })} ·{' '}
                          {a.visit_kind === 'follow_up'
                            ? t('secretary.visitFollowUp')
                            : t('secretary.visitNew')}{' '}
                          · {formatMoney(appointmentFee(a, tenant), currency)}
                        </div>
                        <div className="mt-1">
                          <span className={appointmentStatusBadgeClass(a.status)}>
                            {t(`appointments.status.${a.status}`)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {unpaid ? (
                          <button
                            type="button"
                            className="cf-btn cf-btn-success py-1.5 text-xs !text-white"
                            onClick={() => void setPayment(a, 'paid')}
                          >
                            {formatMoney(appointmentFee(a, tenant), currency)}
                          </button>
                        ) : null}
                        {a.status === 'waiting' ? (
                          <button
                            type="button"
                            className="cf-btn cf-btn-ghost py-1 text-xs"
                            onClick={() => void updateStatus(a.id, 'with_doctor')}
                          >
                            {t('waiting.toDoctor')}
                          </button>
                        ) : null}
                        <WhatsAppButton
                          compact
                          phone={a.patients?.phone}
                          message={appointmentReminderMessage({
                            clinicName: tenant?.name ?? 'ClinicFlow',
                            patientName: a.patients?.full_name ?? '',
                            whenLabel: format(new Date(a.scheduled_at), 'EEEE d/M HH:mm', {
                              locale,
                            }),
                            clinicPhone: tenant?.phone,
                            lang: i18n.language === 'en' ? 'en' : 'ar',
                          })}
                        />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
