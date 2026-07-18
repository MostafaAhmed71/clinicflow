import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ar, enUS } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useAppointmentsLive } from '../hooks/useAppointmentsLive'
import { Icon } from '../components/Icon'
import { Toast } from '../components/Toast'
import { printDayClose } from '../lib/print'
import {
  endOfLocalDay,
  isSameLocalDay,
  localDateStr,
  startOfLocalDay,
} from '../lib/clinicDay'
import { appointmentStatusBadgeClass } from '../lib/appointmentStatus'
import type { Appointment } from '../types/clinic'

type Kpis = {
  patientsToday: number
  appointmentsToday: number
  waiting: number
  withDoctor: number
  doneToday: number
  followUps: number
  noShows: number
  revenueToday: number
  unpaidDone: number
}

type WeekBar = { label: string; count: number }

type VisitRow = {
  id: string
  patient_id: string
  visit_date: string
  status: string
  patients?: { full_name: string; file_number: number } | null
}

async function fetchAppointments(tenantId: string, fromIso: string, toIso: string) {
  const withPatients = await supabase
    .from('appointments')
    .select('*, patients(full_name, phone, file_number)')
    .eq('tenant_id', tenantId)
    .gte('scheduled_at', fromIso)
    .lte('scheduled_at', toIso)
    .order('scheduled_at', { ascending: true })

  if (!withPatients.error) {
    return { data: (withPatients.data as Appointment[]) ?? [], error: null as string | null }
  }

  // Fallback if embed/relationship fails (still show KPIs)
  const plain = await supabase
    .from('appointments')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('scheduled_at', fromIso)
    .lte('scheduled_at', toIso)
    .order('scheduled_at', { ascending: true })

  return {
    data: (plain.data as Appointment[]) ?? [],
    error: plain.error?.message ?? withPatients.error.message,
  }
}

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const { tenant, user } = useAuth()
  const locale = i18n.language === 'ar' ? ar : enUS
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [todayList, setTodayList] = useState<Appointment[]>([])
  const [recentList, setRecentList] = useState<Appointment[]>([])
  const [visitList, setVisitList] = useState<VisitRow[]>([])
  const [unpaid, setUnpaid] = useState<Appointment[]>([])
  const [weekBars, setWeekBars] = useState<WeekBar[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dayCloseOpen, setDayCloseOpen] = useState(false)
  const [queueFlash, setQueueFlash] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!tenant?.id) return
    setError(null)

    const start = startOfLocalDay()
    const end = endOfLocalDay()
    const todayDate = localDateStr(start)

    // Wide window, then filter by local calendar day (avoids UTC boundary misses)
    const rangeFrom = startOfLocalDay()
    rangeFrom.setDate(rangeFrom.getDate() - 30)
    const rangeTo = endOfLocalDay()
    rangeTo.setDate(rangeTo.getDate() + 1)

    const [
      apptResult,
      { data: visits, error: eVisits },
      { count: followUps, error: eFollow },
      { data: invoices, error: eInv },
    ] = await Promise.all([
      fetchAppointments(tenant.id, rangeFrom.toISOString(), rangeTo.toISOString()),
      supabase
        .from('visits')
        .select('id, patient_id, visit_date, status, patients(full_name, file_number)')
        .eq('tenant_id', tenant.id)
        .gte('visit_date', start.toISOString())
        .lte('visit_date', end.toISOString())
        .order('visit_date', { ascending: false }),
      supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('follow_up_date', todayDate),
      supabase
        .from('invoices')
        .select('total')
        .eq('tenant_id', tenant.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString()),
    ])

    if (apptResult.error && apptResult.data.length === 0) {
      setError(apptResult.error)
    } else if (eVisits || eFollow || eInv) {
      setError((eVisits || eFollow || eInv)?.message ?? null)
    }

    const all = apptResult.data
    const todayAppts = all.filter(
      (a) => isSameLocalDay(a.scheduled_at, start) || isSameLocalDay(a.created_at, start),
    )
    const active = todayAppts.filter((a) => a.status !== 'cancelled')
    const visitsToday = ((visits as unknown as VisitRow[]) ?? []).filter((v) =>
      isSameLocalDay(v.visit_date, start),
    )

    const patientIds = new Set<string>([
      ...active.map((a) => a.patient_id),
      ...visitsToday.map((v) => v.patient_id),
    ])

    const unpaidList = active.filter(
      (a) => a.status === 'done' && (a.payment_status ?? 'unpaid') !== 'paid',
    )
    const paidDone = active.filter(
      (a) => a.status === 'done' && a.payment_status === 'paid',
    )
    const completedVisits = visitsToday.filter((v) => v.status === 'completed')
    const invoiceTotal = (invoices ?? []).reduce((sum, row) => sum + Number(row.total ?? 0), 0)
    const fee = Number(tenant.consultation_fee ?? 0)
    const revenueToday =
      invoiceTotal > 0 ? invoiceTotal : paidDone.length * fee

    const doneFromAppts = active.filter((a) => a.status === 'done').length
    const doneToday = Math.max(doneFromAppts, completedVisits.length)

    setUnpaid(unpaidList)
    setTodayList(active)
    setVisitList(visitsToday)
    setRecentList(all.filter((a) => a.status !== 'cancelled').slice(-12).reverse())
    setKpis({
      patientsToday: patientIds.size,
      appointmentsToday: active.length > 0 ? active.length : visitsToday.length,
      waiting: active.filter((a) => a.status === 'waiting').length,
      withDoctor: active.filter((a) => a.status === 'with_doctor').length,
      doneToday,
      followUps: followUps ?? 0,
      noShows: active.filter((a) => a.status === 'no_show').length,
      revenueToday,
      unpaidDone: unpaidList.length,
    })

    const bars: WeekBar[] = []
    for (let i = 6; i >= 0; i--) {
      const day = startOfLocalDay()
      day.setDate(day.getDate() - i)
      const count = all.filter((row) => {
        if (row.status === 'cancelled') return false
        return isSameLocalDay(row.scheduled_at, day)
      }).length
      bars.push({
        label: format(day, 'EEE', { locale }),
        count,
      })
    }
    setWeekBars(bars)
  }, [tenant, locale])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 15000)
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  useAppointmentsLive(tenant?.id, () => {
    setQueueFlash(true)
    setToast(t('waiting.liveUpdated'))
    void load()
    window.setTimeout(() => setQueueFlash(false), 1200)
  })

  const maxWeek = Math.max(1, ...weekBars.map((b) => b.count))
  const showRecentFallback = kpis !== null && todayList.length === 0 && recentList.length > 0
  const tableRows = todayList.length > 0 ? todayList : showRecentFallback ? recentList : []
  const liveQueue = todayList
    .filter((a) => a.status === 'waiting' || a.status === 'with_doctor')
    .sort((a, b) => {
      if (a.status === 'with_doctor' && b.status !== 'with_doctor') return -1
      if (b.status === 'with_doctor' && a.status !== 'with_doctor') return 1
      return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    })
  const nextInQueue = liveQueue[0] ?? null

  return (
    <div className="cf-page-enter space-y-lg">
      <Toast message={toast} tone="info" onDismiss={() => setToast(null)} />
      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-md">
        <div>
          <h1 className="font-headline-md text-headline-md font-bold text-on-surface">
            {format(new Date(), 'EEEE d MMMM', { locale })}
          </h1>
          <p className="text-sm text-on-surface-variant">{tenant?.name}</p>
        </div>
        <div className="flex flex-wrap gap-sm">
          {nextInQueue ? (
            <Link
              to={`/consultation?patientId=${nextInQueue.patient_id}&appointmentId=${nextInQueue.id}`}
              className="cf-btn cf-btn-primary cf-cta-breathe"
            >
              <Icon name="stethoscope" />
              {t('dashboard.nextInQueue')}: {nextInQueue.patients?.full_name ?? '—'}
            </Link>
          ) : (
            <Link to="/consultation" className="cf-btn cf-btn-primary">
              <Icon name="stethoscope" />
              {t('consultation.start')}
            </Link>
          )}
          <Link to="/waiting" className="cf-btn cf-btn-secondary">
            <Icon name="hourglass_top" />
            {t('appointments.waitingRoom')}
          </Link>
          <button type="button" className="cf-btn cf-btn-ghost" onClick={() => setDayCloseOpen((v) => !v)}>
            <Icon name="lock_clock" />
            {t('dashboard.dayClose')}
          </button>
        </div>
      </div>

      <section className={`cf-card overflow-hidden ${queueFlash ? 'cf-live-pulse' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-md border-b border-outline-variant/60 bg-gradient-to-l from-primary-fixed/50 to-white px-md py-md">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-on-surface">
              <Icon name="groups" className="text-primary" />
              {t('dashboard.liveQueue')}
              {queueFlash ? (
                <span className="cf-badge cf-badge-success cf-row-enter">{t('waiting.liveUpdated')}</span>
              ) : null}
            </h2>
            <p className="text-sm text-on-surface-variant">{t('dashboard.liveQueueHint')}</p>
          </div>
          <div className={`flex flex-wrap gap-2 ${queueFlash ? 'cf-stat-flash' : ''}`}>
            <span className={appointmentStatusBadgeClass('waiting')}>
              {t('appointments.status.waiting')}: {kpis?.waiting ?? 0}
            </span>
            <span className={appointmentStatusBadgeClass('with_doctor')}>
              {t('appointments.status.with_doctor')}: {kpis?.withDoctor ?? 0}
            </span>
            {(kpis?.unpaidDone ?? 0) > 0 && (
              <span className="cf-badge cf-badge-warning">
                {t('consultation.paymentUnpaid')}: {kpis?.unpaidDone}
              </span>
            )}
          </div>
        </div>
        <div className="divide-y divide-outline-variant/60">
          {liveQueue.length === 0 ? (
            <p className="px-md py-lg text-sm text-on-surface-variant">{t('consultation.noQueue')}</p>
          ) : (
            liveQueue.slice(0, 5).map((a, idx) => (
              <div
                key={a.id}
                className="cf-queue-row cf-panel-enter flex flex-wrap items-center justify-between gap-md px-md py-md"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="min-w-0">
                  <div className="font-semibold text-on-surface">{a.patients?.full_name}</div>
                  <div className="text-xs text-on-surface-variant">
                    {format(new Date(a.scheduled_at), 'HH:mm')} · #
                    {a.patients?.file_number} ·{' '}
                    {a.visit_kind === 'follow_up'
                      ? t('secretary.visitFollowUp')
                      : t('secretary.visitNew')}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-sm">
                  <span className={appointmentStatusBadgeClass(a.status)}>
                    {t(`appointments.status.${a.status}`)}
                  </span>
                  <Link
                    to={`/consultation?patientId=${a.patient_id}&appointmentId=${a.id}`}
                    className="cf-btn cf-btn-primary py-sm text-xs !text-white"
                  >
                    <Icon name="stethoscope" className="text-base" />
                    {t('consultation.start')}
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {dayCloseOpen && kpis && (
        <section className="rounded-xl border border-primary/30 bg-primary-fixed/20 p-lg shadow-sm">
          <div className="mb-md flex flex-wrap items-start justify-between gap-md">
            <div>
              <h2 className="font-semibold text-on-surface">{t('dashboard.dayCloseTitle')}</h2>
              <p className="text-sm text-on-surface-variant">{t('dashboard.dayCloseHint')}</p>
            </div>
            <button
              type="button"
              className="cf-btn cf-btn-primary"
              onClick={() =>
                printDayClose({
                  clinicName: tenant?.name ?? 'ClinicFlow',
                  logoUrl: tenant?.logo_url,
                  clinicPhone: tenant?.phone,
                  dateLabel: format(new Date(), 'EEEE d MMMM yyyy', { locale }),
                  patientsToday: kpis.patientsToday,
                  appointmentsToday: kpis.appointmentsToday,
                  doneToday: kpis.doneToday,
                  waiting: kpis.waiting,
                  noShows: kpis.noShows,
                  followUps: kpis.followUps,
                  unpaidDone: kpis.unpaidDone,
                  revenueToday: kpis.revenueToday,
                  doctorName: user?.full_name,
                })
              }
            >
              <Icon name="print" />
              {t('dashboard.printDayClose')}
            </button>
          </div>
          <div className="grid gap-sm sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="rounded-lg bg-surface-container-lowest px-md py-sm">
              <div className="text-outline">{t('dashboard.patientsToday')}</div>
              <div className="text-xl font-bold">{kpis.patientsToday}</div>
            </div>
            <div className="rounded-lg bg-surface-container-lowest px-md py-sm">
              <div className="text-outline">{t('appointments.status.done')}</div>
              <div className="text-xl font-bold">{kpis.doneToday}</div>
            </div>
            <div className="rounded-lg bg-surface-container-lowest px-md py-sm">
              <div className="text-outline">{t('dashboard.revenueToday')}</div>
              <div className="text-xl font-bold">{kpis.revenueToday.toLocaleString()} ج.م</div>
            </div>
            <div className="rounded-lg bg-surface-container-lowest px-md py-sm">
              <div className="text-outline">{t('consultation.paymentUnpaid')}</div>
              <div className={`text-xl font-bold ${kpis.unpaidDone > 0 ? 'text-error' : ''}`}>
                {kpis.unpaidDone}
              </div>
            </div>
          </div>
        </section>
      )}

      {kpis && kpis.unpaidDone > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-md rounded-xl border border-amber-300 bg-amber-50 px-md py-md text-amber-950">
          <div className="flex items-start gap-sm">
            <Icon name="payments" className="text-amber-700" filled />
            <div>
              <div className="font-bold">{t('dashboard.unpaidAlert', { count: kpis.unpaidDone })}</div>
              <p className="text-sm text-amber-900/80">{t('dashboard.unpaidHint')}</p>
            </div>
          </div>
          <Link to="/desk" className="cf-btn cf-btn-primary py-sm text-sm !text-white">
            {t('dashboard.openDesk')}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-md md:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-md rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name="groups" className="text-3xl" />
          </div>
          <div>
            <p className="font-label-md text-label-md text-outline">{t('dashboard.patientsToday')}</p>
            <h3 className="text-2xl font-bold text-on-surface">{kpis?.patientsToday ?? '—'}</h3>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-sm">
          <div className="mb-sm flex items-center justify-between">
            <p className="font-label-md text-label-md text-outline">{t('dashboard.appointmentsToday')}</p>
            <Icon name="event" className="text-primary" />
          </div>
          <h3 className="text-2xl font-bold text-on-surface">
            {kpis ? `${kpis.appointmentsToday}` : '—'}
          </h3>
          <div className="mt-sm h-1.5 overflow-hidden rounded-full bg-surface-container">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, ((kpis?.appointmentsToday ?? 0) / 35) * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-md rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-container/40 text-secondary">
            <Icon name="payments" className="text-3xl" />
          </div>
          <div>
            <p className="font-label-md text-label-md text-outline">{t('dashboard.revenueToday')}</p>
            <h3 className="text-2xl font-bold text-on-surface">
              {kpis ? kpis.revenueToday.toLocaleString() : '—'}
            </h3>
            <p className="text-[10px] text-outline">ج.م</p>
          </div>
        </div>

        <div className="rounded-xl border border-r-4 border-outline-variant border-r-amber-500 bg-surface-container-lowest p-md shadow-sm">
          <p className="font-label-md text-label-md text-outline">{t('dashboard.waitingNow')}</p>
          <div className="mt-sm flex flex-wrap gap-md">
            <div>
              <div className="text-xl font-bold text-primary">{kpis?.withDoctor ?? '—'}</div>
              <div className="text-[10px] text-outline">{t('appointments.status.with_doctor')}</div>
            </div>
            <div className="hidden h-8 w-px bg-outline-variant sm:block" />
            <div>
              <div className="text-xl font-bold text-on-surface">{kpis?.waiting ?? '—'}</div>
              <div className="text-[10px] text-outline">{t('appointments.status.waiting')}</div>
            </div>
            <div className="hidden h-8 w-px bg-outline-variant sm:block" />
            <div>
              <div className="text-xl font-bold text-secondary">{kpis?.doneToday ?? '—'}</div>
              <div className="text-[10px] text-outline">{t('appointments.status.done')}</div>
            </div>
            <div className="hidden h-8 w-px bg-outline-variant sm:block" />
            <div>
              <div className="text-xl font-bold text-amber-700">{kpis?.unpaidDone ?? '—'}</div>
              <div className="text-[10px] text-outline">{t('consultation.paymentUnpaid')}</div>
            </div>
          </div>
        </div>
      </div>

      {unpaid.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          <div className="flex items-center justify-between border-b border-outline-variant bg-amber-50 px-md py-md">
            <h2 className="font-title-lg text-title-lg font-medium">{t('dashboard.unpaidList')}</h2>
            <span className="cf-badge cf-badge-warning">{unpaid.length}</span>
          </div>
          <ul className="divide-y divide-outline-variant">
            {unpaid.slice(0, 6).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-md py-md text-sm">
                <div>
                  <div className="font-medium">{a.patients?.full_name}</div>
                  <div className="text-xs text-on-surface-variant">
                    {format(new Date(a.scheduled_at), 'HH:mm')} · #{a.patients?.file_number}
                  </div>
                </div>
                <span className="cf-badge cf-badge-warning">{t('consultation.paymentUnpaid')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="cf-card group overflow-hidden">
        <summary className="cursor-pointer list-none px-md py-md font-semibold text-on-surface marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <Icon name="bar_chart" className="text-primary" />
            {t('dashboard.moreStats')}
            <Icon name="expand_more" className="text-on-surface-variant transition group-open:rotate-180" />
          </span>
        </summary>
        <div className="space-y-lg border-t border-outline-variant/60 p-md">
          <div className="grid gap-lg lg:grid-cols-3">
            <div className="space-y-lg lg:col-span-2">
              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-sm">
                <div className="mb-md flex items-center justify-between">
                  <h3 className="font-title-lg text-title-lg font-medium">{t('dashboard.apptStats')}</h3>
                  <span className="rounded-full bg-surface-container-low px-md py-xs font-label-md text-label-md text-on-surface-variant">
                    {t('appointments.week')}
                  </span>
                </div>
                <div className="flex h-40 items-end gap-2 px-2">
                  {weekBars.map((bar, idx) => (
                    <div key={`${bar.label}-${idx}`} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-on-surface">{bar.count}</span>
                      <div
                        className="w-full rounded-t-md bg-primary/80"
                        style={{ height: `${Math.max(8, (bar.count / maxWeek) * 100)}%` }}
                        title={`${bar.label}: ${bar.count}`}
                      />
                      <span className="text-[10px] text-outline">{bar.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-md sm:grid-cols-2">
                <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md">
                  <h3 className="mb-md font-medium">{t('dashboard.commonDx')}</h3>
                  <div className="flex flex-wrap gap-sm">
                    <span className="cf-badge cf-badge-success">
                      {t('appointments.status.done')}: {kpis?.doneToday ?? 0}
                    </span>
                    <span className="cf-badge cf-badge-info">
                      {t('dashboard.followUps')}: {kpis?.followUps ?? 0}
                    </span>
                    <span className="cf-badge cf-badge-warning">
                      {t('dashboard.noShows')}: {kpis?.noShows ?? 0}
                    </span>
                    {visitList.length > 0 && (
                      <span className="cf-badge cf-badge-muted">
                        {t('dashboard.fromVisits')}: {visitList.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-xl bg-primary p-md text-on-primary shadow-md">
                  <h3 className="mb-sm font-medium">{t('dashboard.annualReport')}</h3>
                  <p className="mb-md text-sm text-on-primary/80">{tenant?.name}</p>
                  <Link
                    to="/reports"
                    className="inline-flex items-center gap-sm rounded-lg bg-white/15 px-md py-sm text-sm font-bold text-white hover:bg-white/25"
                  >
                    <Icon name="download" />
                    {t('dashboard.downloadReport')}
                  </Link>
                </div>
              </div>
            </div>
            <div className="space-y-md">
              <Link to="/follow-ups" className="cf-btn cf-btn-secondary w-full justify-start">
                <Icon name="event_repeat" />
                {t('nav.followUps')}
                {kpis && kpis.followUps > 0 ? ` (${kpis.followUps})` : ''}
              </Link>
              <Link to="/desk" className="cf-btn cf-btn-ghost w-full justify-start">
                <Icon name="support_agent" />
                {t('settings.openDeskMode')}
              </Link>
            </div>
          </div>
        </div>
      </details>

      <details open className="cf-card group overflow-hidden">
        <summary className="cursor-pointer list-none px-md py-md font-semibold text-on-surface marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex w-full items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <Icon name="history" className="text-primary" />
              {t('dashboard.recentActivity')}
            </span>
            <Icon
              name="expand_more"
              className="text-on-surface-variant transition duration-200 group-open:rotate-180"
            />
          </span>
        </summary>
        <div className="border-t border-outline-variant/60 p-md">
          <ul className="custom-scrollbar max-h-80 space-y-md overflow-y-auto">
            {(todayList.length > 0 ? todayList : recentList).slice(0, 8).map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-md border-b border-outline-variant/50 pb-md last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-body-md text-body-md font-medium">{a.patients?.full_name ?? '—'}</p>
                  <p className="font-label-md text-label-md text-outline">
                    {format(new Date(a.scheduled_at), 'dd/MM HH:mm')}
                  </p>
                </div>
                <span className={appointmentStatusBadgeClass(a.status)}>
                  {t(`appointments.status.${a.status}`)}
                </span>
              </li>
            ))}
            {todayList.length === 0 &&
              recentList.length === 0 &&
              visitList.map((v) => (
                <li
                  key={v.id}
                  className="flex items-start justify-between gap-md border-b border-outline-variant/50 pb-md last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-body-md text-body-md font-medium">{v.patients?.full_name ?? '—'}</p>
                    <p className="font-label-md text-label-md text-outline">
                      {format(new Date(v.visit_date), 'HH:mm')} · {t('dashboard.fromVisits')}
                    </p>
                  </div>
                  <span className={appointmentStatusBadgeClass('done')}>
                    {t('appointments.status.done')}
                  </span>
                </li>
              ))}
            {!kpis && <li className="text-on-surface-variant">{t('common.loading')}</li>}
            {kpis && todayList.length === 0 && recentList.length === 0 && visitList.length === 0 && (
              <li className="space-y-2 text-on-surface-variant">
                <p>{t('dashboard.emptyToday')}</p>
                <p className="text-xs">{t('dashboard.emptyTodayHint')}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link to="/appointments" className="cf-btn cf-btn-primary py-1 text-xs !text-white">
                    {t('appointments.add')}
                  </Link>
                  <Link to="/consultation" className="cf-btn cf-btn-secondary py-1 text-xs">
                    {t('nav.consultation')}
                  </Link>
                </div>
              </li>
            )}
          </ul>
          <Link to="/waiting" className="mt-md inline-block font-label-md text-label-md text-primary hover:underline">
            {t('dashboard.viewAllActivity')}
          </Link>
        </div>
      </details>

      <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant px-md py-md">
          <h2 className="font-title-lg text-title-lg font-medium">
            {showRecentFallback ? t('dashboard.recentBookings') : t('dashboard.upcomingToday')}
          </h2>
          <Link to="/appointments" className="font-label-md text-label-md font-bold text-primary">
            {t('dashboard.viewSchedule')}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-surface-container-low text-start font-label-md text-label-md text-on-surface-variant">
                <th className="px-md py-sm font-semibold">{t('appointments.time')}</th>
                <th className="px-md py-sm font-semibold">{t('patients.fullName')}</th>
                <th className="px-md py-sm font-semibold">{t('appointments.statusLabel')}</th>
                <th className="px-md py-sm font-semibold">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {!kpis ? (
                <tr>
                  <td colSpan={4} className="px-md py-xl text-center text-on-surface-variant">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : tableRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-md py-xl text-center text-on-surface-variant">
                    <p>{t('dashboard.emptyToday')}</p>
                    <p className="mt-1 text-xs">{t('dashboard.emptyTodayHint')}</p>
                    <Link
                      to="/appointments"
                      className="mt-3 inline-flex cf-btn cf-btn-primary py-1 text-xs !text-white"
                    >
                      {t('appointments.add')}
                    </Link>
                  </td>
                </tr>
              ) : (
                tableRows.map((a) => (
                  <tr key={a.id} className="table-row-hover border-t border-outline-variant">
                    <td className="px-md py-md whitespace-nowrap">
                      {format(new Date(a.scheduled_at), 'dd/MM hh:mm a')}
                    </td>
                    <td className="px-md py-md font-medium">{a.patients?.full_name ?? '—'}</td>
                    <td className="px-md py-md">
                      <span className={appointmentStatusBadgeClass(a.status)}>
                        {t(`appointments.status.${a.status}`)}
                      </span>
                    </td>
                    <td className="px-md py-md">
                      <div className="flex flex-wrap gap-1">
                        <Link
                          to={`/patients/${a.patient_id}`}
                          className="cf-btn cf-btn-secondary py-1 text-xs"
                        >
                          <Icon name="folder_open" className="text-[16px]" />
                          {t('patients.openFile')}
                        </Link>
                        <Link
                          to={`/consultation?patientId=${a.patient_id}&appointmentId=${a.id}`}
                          className="cf-btn cf-btn-primary py-1 text-xs !text-white"
                        >
                          <Icon name="medical_services" className="text-[16px]" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-outline">
        {tenant?.name} — {user?.full_name}
      </p>
    </div>
  )
}
