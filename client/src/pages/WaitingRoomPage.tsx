import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useAppointmentsLive } from '../hooks/useAppointmentsLive'
import { Icon } from '../components/Icon'
import { Toast } from '../components/Toast'
import { WhatsAppButton } from '../components/WhatsAppButton'
import { endOfLocalDay, isSameLocalDay, startOfLocalDay } from '../lib/clinicDay'
import { appointmentReminderMessage } from '../lib/whatsapp'
import { appointmentFee } from '../lib/visitFees'
import { appointmentStatusBadgeClass } from '../lib/appointmentStatus'
import type { Appointment } from '../types/clinic'

type Filter = 'all' | Appointment['status'] | 'unpaid'

const FILTERS: Filter[] = ['all', 'waiting', 'with_doctor', 'done', 'unpaid', 'no_show', 'cancelled']

function isUnpaidDone(a: Appointment) {
  return (
    a.status === 'done' &&
    (a.payment_status ?? 'unpaid') !== 'paid' &&
    a.payment_status !== 'waived'
  )
}

function statusRailClass(a: Appointment) {
  if (isUnpaidDone(a)) return 'cf-wait-rail-unpaid'
  if (a.status === 'waiting') return 'cf-wait-rail-waiting'
  if (a.status === 'with_doctor') return 'cf-wait-rail-doctor'
  if (a.status === 'done') return 'cf-wait-rail-done'
  return 'cf-wait-rail-muted'
}

function queueNumberClass(a: Appointment) {
  if (isUnpaidDone(a)) return 'bg-error-container text-on-error-container'
  if (a.status === 'waiting') return 'bg-orange-100 text-orange-800'
  if (a.status === 'with_doctor') return 'bg-primary-fixed text-primary'
  if (a.status === 'done') return 'bg-secondary-container text-on-secondary-container'
  return 'bg-surface-container text-on-surface-variant'
}

function rankAppointment(a: Appointment) {
  if (isUnpaidDone(a)) return 0
  if (a.status === 'waiting') return 1
  if (a.status === 'with_doctor') return 2
  if (a.status === 'done') return 3
  return 4
}

function waitMinutes(scheduledAt: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(scheduledAt).getTime()) / 60000))
  return mins
}

function sortQueue(list: Appointment[]) {
  return [...list].sort((a, b) => {
    const diff = rankAppointment(a) - rankAppointment(b)
    if (diff !== 0) return diff
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  })
}

export function WaitingRoomPage() {
  const { t, i18n } = useTranslation()
  const { tenant, user } = useAuth()
  const [items, setItems] = useState<Appointment[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [error, setError] = useState<string | null>(null)
  const [liveFlash, setLiveFlash] = useState(false)
  const [liveLabel, setLiveLabel] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [enterIds, setEnterIds] = useState<Set<string>>(new Set())
  const [openMoreId, setOpenMoreId] = useState<string | null>(null)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const isSecretary = user?.role === 'secretary'

  const load = useCallback(async (opts?: { animateNew?: boolean }) => {
    if (!tenant) return
    const from = startOfLocalDay()
    from.setDate(from.getDate() - 1)
    const to = endOfLocalDay()

    const { data, error: err } = await supabase
      .from('appointments')
      .select('*, patients(full_name, phone, file_number)')
      .eq('tenant_id', tenant.id)
      .gte('scheduled_at', from.toISOString())
      .lte('scheduled_at', to.toISOString())
      .order('scheduled_at', { ascending: true })

    if (err) setError(err.message)
    const today = startOfLocalDay()
    const rows = ((data as Appointment[]) ?? []).filter(
      (a) => isSameLocalDay(a.scheduled_at, today) || isSameLocalDay(a.created_at, today),
    )

    if (opts?.animateNew && knownIdsRef.current.size > 0) {
      const fresh = rows.filter((a) => !knownIdsRef.current.has(a.id)).map((a) => a.id)
      if (fresh.length) {
        setEnterIds(new Set(fresh))
        window.setTimeout(() => setEnterIds(new Set()), 400)
      }
    }
    knownIdsRef.current = new Set(rows.map((a) => a.id))
    setItems(rows)
  }, [tenant])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30000)
    return () => window.clearInterval(timer)
  }, [load])

  useAppointmentsLive(tenant?.id, () => {
    setLiveFlash(true)
    setLiveLabel(true)
    setToast(t('waiting.liveUpdated'))
    void load({ animateNew: true })
    window.setTimeout(() => setLiveFlash(false), 1200)
  })

  async function move(id: string, status: Appointment['status']) {
    const { error: err } = await supabase.from('appointments').update({ status }).eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    setToast(
      status === 'with_doctor'
        ? t('waiting.toDoctor')
        : status === 'done'
          ? t('waiting.complete')
          : t('secretary.statusUpdated'),
    )
    setOpenMoreId(null)
    await load()
  }

  async function markPaid(a: Appointment) {
    if (!tenant) return
    const { error: err } = await supabase
      .from('appointments')
      .update({ payment_status: 'paid' })
      .eq('id', a.id)
    if (err) {
      setError(err.message)
      return
    }
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
    setToast(t('secretary.paymentUpdated'))
    setOpenMoreId(null)
    await load()
  }

  const counts = useMemo(() => {
    const base = {
      all: items.length,
      waiting: 0,
      with_doctor: 0,
      done: 0,
      unpaid: 0,
      no_show: 0,
      cancelled: 0,
    }
    for (const a of items) {
      base[a.status] += 1
      if (isUnpaidDone(a)) base.unpaid += 1
    }
    return base
  }, [items])

  const visible = useMemo(() => {
    let list: Appointment[]
    if (filter === 'all') list = items
    else if (filter === 'unpaid') list = items.filter(isUnpaidDone)
    else list = items.filter((a) => a.status === filter)
    return sortQueue(list)
  }, [items, filter])

  const nextPatient = useMemo(
    () => items.find((a) => a.status === 'waiting') ?? items.find((a) => a.status === 'with_doctor') ?? null,
    [items],
  )

  const grouped = useMemo(() => {
    if (filter !== 'all') return null
    return {
      waiting: sortQueue(items.filter((a) => a.status === 'waiting')),
      with_doctor: sortQueue(items.filter((a) => a.status === 'with_doctor')),
      unpaid: sortQueue(items.filter(isUnpaidDone)),
      done: sortQueue(items.filter((a) => a.status === 'done' && !isUnpaidDone(a))),
      other: sortQueue(items.filter((a) => a.status === 'no_show' || a.status === 'cancelled')),
    }
  }, [items, filter])

  function renderPrimaryActions(a: Appointment) {
    if (!isSecretary && (a.status === 'waiting' || a.status === 'with_doctor')) {
      return (
        <Link
          to={`/consultation?patientId=${a.patient_id}&appointmentId=${a.id}`}
          className="cf-btn cf-btn-primary py-sm text-sm !text-white"
          onClick={() => {
            if (a.status === 'waiting') void move(a.id, 'with_doctor')
          }}
        >
          <Icon name="stethoscope" />
          {t('consultation.start')}
        </Link>
      )
    }
    if (isSecretary && a.status === 'waiting') {
      return (
        <button
          type="button"
          onClick={() => void move(a.id, 'with_doctor')}
          className="cf-btn cf-btn-primary py-sm text-sm !text-white"
        >
          <Icon name="play_arrow" />
          {t('waiting.toDoctor')}
        </button>
      )
    }
    if (isSecretary && a.status === 'with_doctor') {
      return (
        <button
          type="button"
          onClick={() => void move(a.id, 'done')}
          className="cf-btn cf-btn-success py-sm text-sm !text-white"
        >
          <Icon name="check_circle" />
          {t('waiting.complete')}
        </button>
      )
    }
    if (!isSecretary && a.status === 'with_doctor') {
      return (
        <button
          type="button"
          onClick={() => void move(a.id, 'done')}
          className="cf-btn cf-btn-success py-sm text-sm !text-white"
        >
          <Icon name="check_circle" />
          {t('waiting.complete')}
        </button>
      )
    }
    if (isUnpaidDone(a)) {
      return (
        <button
          type="button"
          onClick={() => void markPaid(a)}
          className="cf-btn cf-btn-success py-sm text-sm !text-white"
        >
          <Icon name="payments" />
          {t('waiting.markPaid')} · {appointmentFee(a, tenant).toLocaleString()} {t('secretary.currency')}
        </button>
      )
    }
    return null
  }

  function renderCard(a: Appointment, idx: number, showIndex = true) {
    const mins = waitMinutes(a.scheduled_at)
    const moreOpen = openMoreId === a.id

    return (
      <article
        key={a.id}
        className={`cf-wait-card cf-interactive ${statusRailClass(a)} ${
          enterIds.has(a.id) ? 'cf-row-enter' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {showIndex ? (
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold shadow-sm ${queueNumberClass(a)}`}
          >
            {String(idx + 1).padStart(2, '0')}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-sm">
            <h3 className="truncate text-base font-bold text-on-surface">{a.patients?.full_name}</h3>
            <span className={appointmentStatusBadgeClass(a.status)}>
              {t(`appointments.status.${a.status}`)}
            </span>
            {a.status === 'done' && (
              <span
                className={
                  a.payment_status === 'paid'
                    ? 'cf-badge cf-badge-success'
                    : a.payment_status === 'waived'
                      ? 'cf-badge cf-badge-muted'
                      : 'cf-badge cf-badge-danger'
                }
              >
                {a.payment_status === 'paid'
                  ? t('consultation.paymentPaid')
                  : a.payment_status === 'waived'
                    ? t('consultation.paymentWaived')
                    : t('consultation.paymentUnpaid')}
              </span>
            )}
          </div>

          <div className="mt-xs flex flex-wrap items-center gap-x-md gap-y-xs text-sm text-on-surface-variant">
            <span className="font-medium">#{a.patients?.file_number}</span>
            <span className="inline-flex items-center gap-xs">
              <Icon name="schedule" className="text-[15px]" />
              {format(new Date(a.scheduled_at), 'HH:mm')}
            </span>
            {(a.status === 'waiting' || a.status === 'with_doctor') && (
              <span
                className={`inline-flex items-center gap-xs rounded-full px-2 py-0.5 text-xs font-semibold ${
                  mins >= 30
                    ? 'bg-error-container text-on-error-container'
                    : mins >= 15
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                <Icon name="timer" className="text-[14px]" />
                {t('waiting.waited', { minutes: mins })}
              </span>
            )}
            <span className={a.visit_kind === 'follow_up' ? 'cf-badge cf-badge-success' : 'cf-badge cf-badge-info'}>
              {a.visit_kind === 'follow_up' ? t('secretary.visitFollowUp') : t('secretary.visitNew')}
            </span>
            <span className="cf-badge cf-badge-muted">
              {appointmentFee(a, tenant).toLocaleString()} {t('secretary.currency')}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-sm">
          {renderPrimaryActions(a)}

          <div className="relative">
            <button
              type="button"
              className="cf-btn cf-btn-ghost py-sm text-xs"
              aria-expanded={moreOpen}
              onClick={(e) => {
                e.stopPropagation()
                setOpenMoreId(moreOpen ? null : a.id)
              }}
            >
              <Icon name="more_horiz" />
              {t('waiting.moreActions')}
            </button>
            {moreOpen ? (
              <div className="cf-wait-menu absolute end-0 z-20 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest py-1 shadow-lg">
                <div className="px-2 py-1">
                  <WhatsAppButton
                    compact
                    phone={a.patients?.phone}
                    message={appointmentReminderMessage({
                      clinicName: tenant?.name ?? 'ClinicFlow',
                      patientName: a.patients?.full_name ?? '',
                      whenLabel: format(new Date(a.scheduled_at), 'HH:mm'),
                      clinicPhone: tenant?.phone,
                      lang: i18n.language === 'en' ? 'en' : 'ar',
                    })}
                  />
                </div>
                <Link
                  to={`/patients/${a.patient_id}`}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container"
                  onClick={() => setOpenMoreId(null)}
                >
                  <Icon name="folder_open" className="text-[16px]" />
                  {t('patients.openFile')}
                </Link>
                {a.status === 'waiting' && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container"
                    onClick={() => void move(a.id, 'no_show')}
                  >
                    <Icon name="person_off" className="text-[16px]" />
                    {t('appointments.status.no_show')}
                  </button>
                )}
                {a.status === 'with_doctor' && isSecretary && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container"
                    onClick={() => void move(a.id, 'waiting')}
                  >
                    <Icon name="undo" className="text-[16px]" />
                    {t('waiting.backToWaiting')}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </article>
    )
  }

  function renderSection(
    key: string,
    title: string,
    icon: string,
    list: Appointment[],
    tone: string,
  ) {
    if (list.length === 0) return null
    return (
      <section key={key} className="space-y-sm">
        <div className={`flex items-center gap-sm rounded-xl px-md py-sm ${tone}`}>
          <Icon name={icon} className="text-xl" />
          <h2 className="font-semibold text-on-surface">{title}</h2>
          <span className="ms-auto rounded-full bg-surface-container-lowest/80 px-2.5 py-0.5 text-xs font-bold">
            {list.length}
          </span>
        </div>
        <div className="space-y-sm">{list.map((a, idx) => renderCard(a, idx))}</div>
      </section>
    )
  }

  const kpiCards: Array<{
    key: Filter
    value: number
    icon: string
    label: string
    tone: string
    activeTone: string
  }> = [
    {
      key: 'waiting',
      value: counts.waiting,
      icon: 'group',
      label: t('appointments.status.waiting'),
      tone: 'border-orange-300/60 bg-orange-50/70',
      activeTone: 'ring-2 ring-orange-400/50 border-orange-400',
    },
    {
      key: 'with_doctor',
      value: counts.with_doctor,
      icon: 'stethoscope',
      label: t('appointments.status.with_doctor'),
      tone: 'border-primary/30 bg-primary-fixed/40',
      activeTone: 'ring-2 ring-primary/35 border-primary/50',
    },
    {
      key: 'done',
      value: counts.done,
      icon: 'check_circle',
      label: t('appointments.status.done'),
      tone: 'border-secondary/30 bg-secondary-container/35',
      activeTone: 'ring-2 ring-secondary/40 border-secondary/50',
    },
    {
      key: 'unpaid',
      value: counts.unpaid,
      icon: 'payments',
      label: t('waiting.unpaidDone'),
      tone: 'border-error/30 bg-error-container/40',
      activeTone: 'ring-2 ring-error/35 border-error/50',
    },
    {
      key: 'all',
      value: counts.all,
      icon: 'calendar_today',
      label: t('waiting.totalToday'),
      tone: 'border-outline-variant bg-surface-container-low/60',
      activeTone: 'ring-2 ring-primary/25 border-primary/40',
    },
  ]

  return (
    <div className="cf-page-enter space-y-lg" onClick={() => setOpenMoreId(null)}>
      <Toast message={toast} tone="info" onDismiss={() => setToast(null)} />

      <div className="flex flex-wrap items-start justify-between gap-md">
        <div>
          <div className="flex flex-wrap items-center gap-sm">
            <h1 className="font-headline-md text-headline-md font-bold text-on-surface">
              {t('appointments.waitingRoom')}
            </h1>
            <span
              className={`inline-flex items-center gap-xs rounded-full px-sm py-0.5 text-[11px] font-semibold transition ${
                liveFlash
                  ? 'cf-live-pulse bg-secondary text-on-secondary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${liveLabel ? 'bg-secondary animate-pulse' : 'bg-outline'}`}
              />
              {liveFlash ? t('waiting.liveUpdated') : t('waiting.live')}
            </span>
          </div>
          <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
            {t('waiting.subtitle')}
          </p>
        </div>
        {isSecretary ? (
          <Link to="/desk" className="cf-btn cf-btn-primary">
            <Icon name="event_available" />
            {t('secretary.newBooking')}
          </Link>
        ) : (
          <Link to="/consultation" className="cf-btn cf-btn-primary">
            <Icon name="stethoscope" />
            {t('consultation.start')}
          </Link>
        )}
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {nextPatient && (nextPatient.status === 'waiting' || nextPatient.status === 'with_doctor') ? (
        <div
          className={`cf-wait-next cf-panel-enter ${
            nextPatient.status === 'waiting' ? 'cf-wait-next-waiting' : 'cf-wait-next-doctor'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
              {nextPatient.status === 'waiting' ? t('waiting.nextUp') : t('waiting.inProgress')}
            </p>
            <p className="mt-1 truncate text-xl font-bold">{nextPatient.patients?.full_name}</p>
            <p className="mt-1 flex flex-wrap items-center gap-sm text-sm opacity-90">
              <span>#{nextPatient.patients?.file_number}</span>
              <span>·</span>
              <span>{format(new Date(nextPatient.scheduled_at), 'HH:mm')}</span>
              <span>·</span>
              <span className={appointmentStatusBadgeClass(nextPatient.status)}>
                {t(`appointments.status.${nextPatient.status}`)}
              </span>
              {nextPatient.status === 'waiting' && (
                <span className="text-xs font-semibold">
                  {t('waiting.waited', { minutes: waitMinutes(nextPatient.scheduled_at) })}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-sm">
            {!isSecretary ? (
              <Link
                to={`/consultation?patientId=${nextPatient.patient_id}&appointmentId=${nextPatient.id}`}
                className="cf-btn cf-btn-primary !text-white"
                onClick={() => {
                  if (nextPatient.status === 'waiting') void move(nextPatient.id, 'with_doctor')
                }}
              >
                <Icon name="stethoscope" />
                {t('consultation.start')}
              </Link>
            ) : nextPatient.status === 'waiting' ? (
              <button
                type="button"
                className="cf-btn cf-btn-primary !text-white"
                onClick={() => void move(nextPatient.id, 'with_doctor')}
              >
                <Icon name="play_arrow" />
                {t('waiting.toDoctor')}
              </button>
            ) : (
              <button
                type="button"
                className="cf-btn cf-btn-success !text-white"
                onClick={() => void move(nextPatient.id, 'done')}
              >
                <Icon name="check_circle" />
                {t('waiting.complete')}
              </button>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setFilter(card.key)}
            className={`cf-card flex items-center gap-md p-md text-start transition ${card.tone} ${
              filter === card.key ? card.activeTone : 'hover:brightness-[0.99]'
            } ${liveFlash && card.key === 'waiting' ? 'cf-stat-flash' : ''}`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-lowest/80">
              <Icon name={card.icon} className="text-3xl" />
            </div>
            <div>
              <p className="cf-stat-label">{card.label}</p>
              <h3 className="cf-stat-value text-[1.45rem]">{card.value}</h3>
            </div>
          </button>
        ))}
      </div>

      <div className="cf-card overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="cf-wait-tabs-wrap border-b border-outline-variant/60 bg-surface-container-low/40 px-md py-md">
          <div className="cf-wait-tabs" role="tablist" aria-label={t('appointments.waitingRoom')}>
            {FILTERS.map((f) => {
              const active = filter === f
              const label =
                f === 'all'
                  ? t('waiting.all')
                  : f === 'unpaid'
                    ? t('waiting.unpaidDone')
                    : t(`appointments.status.${f}`)
              const count = counts[f]
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f)}
                  className={`cf-wait-tab cf-wait-tab-${f}${active ? ' is-active' : ''}`}
                >
                  <span className="cf-wait-tab-dot" aria-hidden />
                  <span className="cf-wait-tab-label">{label}</span>
                  <span className="cf-wait-tab-count">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-lg p-md">
          {visible.length === 0 ? (
            <div className="py-xl text-center">
              <div className="mx-auto mb-md flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container">
                <Icon name="event_available" className="text-3xl text-on-surface-variant" />
              </div>
              <p className="font-semibold text-on-surface">{t('appointments.empty')}</p>
              <p className="mt-xs text-sm text-on-surface-variant">{t('waiting.emptyHint')}</p>
              {isSecretary ? (
                <Link to="/desk" className="cf-btn cf-btn-primary mt-md inline-flex !text-white">
                  <Icon name="event_available" />
                  {t('secretary.newBooking')}
                </Link>
              ) : null}
            </div>
          ) : filter === 'all' && grouped ? (
            <>
              {renderSection(
                'waiting',
                t('appointments.status.waiting'),
                'group',
                grouped.waiting,
                'bg-orange-50 text-orange-900',
              )}
              {renderSection(
                'with_doctor',
                t('appointments.status.with_doctor'),
                'stethoscope',
                grouped.with_doctor,
                'bg-primary-fixed/50 text-on-primary-fixed-variant',
              )}
              {renderSection(
                'unpaid',
                t('waiting.unpaidDone'),
                'payments',
                grouped.unpaid,
                'bg-error-container/60 text-on-error-container',
              )}
              {renderSection(
                'done',
                t('appointments.status.done'),
                'check_circle',
                grouped.done,
                'bg-secondary-container/50 text-on-secondary-container',
              )}
              {renderSection(
                'other',
                t('waiting.otherStatuses'),
                'block',
                grouped.other,
                'bg-surface-container text-on-surface-variant',
              )}
            </>
          ) : (
            <div className="space-y-sm">{visible.map((a, idx) => renderCard(a, idx))}</div>
          )}
        </div>
      </div>
    </div>
  )
}
