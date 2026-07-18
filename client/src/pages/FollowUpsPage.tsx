import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ar, enUS } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Icon } from '../components/Icon'
import { Toast } from '../components/Toast'
import { WhatsAppButton } from '../components/WhatsAppButton'
import { localDateStr, startOfLocalDay } from '../lib/clinicDay'
import { followUpWhatsAppMessage } from '../lib/whatsapp'

type FollowUpRow = {
  id: string
  patient_id: string
  follow_up_date: string
  diagnosis: string | null
  chief_complaint: string | null
  visit_date: string
  patients?: { full_name: string; phone: string | null; file_number: number } | null
}

type Filter = 'all' | 'overdue' | 'today' | 'upcoming'

function daysFromToday(dateStr: string, today: string) {
  return differenceInCalendarDays(parseISO(dateStr), parseISO(today))
}

export function FollowUpsPage() {
  const { t, i18n } = useTranslation()
  const { tenant } = useAuth()
  const locale = i18n.language === 'ar' ? ar : enUS
  const [rows, setRows] = useState<FollowUpRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [toast, setToast] = useState<string | null>(null)
  const [openMoreId, setOpenMoreId] = useState<string | null>(null)

  const today = localDateStr(startOfLocalDay())

  const load = useCallback(async () => {
    if (!tenant) return
    const horizon = startOfLocalDay()
    horizon.setDate(horizon.getDate() + 14)
    const horizonStr = localDateStr(horizon)

    const { data, error: err } = await supabase
      .from('visits')
      .select(
        'id, patient_id, follow_up_date, diagnosis, chief_complaint, visit_date, patients(full_name, phone, file_number)',
      )
      .eq('tenant_id', tenant.id)
      .not('follow_up_date', 'is', null)
      .lte('follow_up_date', horizonStr)
      .order('follow_up_date', { ascending: true })
      .limit(80)

    if (err) setError(err.message)
    else setRows((data as unknown as FollowUpRow[]) ?? [])
  }, [tenant])

  useEffect(() => {
    void load()
  }, [load])

  async function clearFollowUp(id: string) {
    setBusyId(id)
    const { error: err } = await supabase.from('visits').update({ follow_up_date: null }).eq('id', id)
    setBusyId(null)
    setOpenMoreId(null)
    if (err) setError(err.message)
    else {
      setToast(t('followUps.doneToast'))
      await load()
    }
  }

  async function snooze(id: string, days: number) {
    setBusyId(id)
    const d = startOfLocalDay()
    d.setDate(d.getDate() + days)
    const { error: err } = await supabase
      .from('visits')
      .update({ follow_up_date: localDateStr(d) })
      .eq('id', id)
    setBusyId(null)
    setOpenMoreId(null)
    if (err) setError(err.message)
    else {
      setToast(t('followUps.snoozeToast', { days }))
      await load()
    }
  }

  const overdue = useMemo(() => rows.filter((r) => r.follow_up_date < today), [rows, today])
  const dueToday = useMemo(() => rows.filter((r) => r.follow_up_date === today), [rows, today])
  const upcoming = useMemo(() => rows.filter((r) => r.follow_up_date > today), [rows, today])

  const visible = useMemo(() => {
    if (filter === 'overdue') return overdue
    if (filter === 'today') return dueToday
    if (filter === 'upcoming') return upcoming
    return [...overdue, ...dueToday, ...upcoming]
  }, [filter, overdue, dueToday, upcoming])

  function toneFor(r: FollowUpRow): 'danger' | 'warning' | 'info' {
    if (r.follow_up_date < today) return 'danger'
    if (r.follow_up_date === today) return 'warning'
    return 'info'
  }

  function dueLabel(r: FollowUpRow) {
    const days = daysFromToday(r.follow_up_date, today)
    if (days < 0) return t('followUps.daysOverdue', { count: Math.abs(days) })
    if (days === 0) return t('followUps.dueTodayBadge')
    if (days === 1) return t('followUps.dueTomorrow')
    return t('followUps.daysUntil', { count: days })
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
      key: 'overdue',
      value: overdue.length,
      icon: 'priority_high',
      label: t('followUps.overdue'),
      tone: 'border-error/30 bg-error-container/40',
      activeTone: 'ring-2 ring-error/35 border-error/50',
    },
    {
      key: 'today',
      value: dueToday.length,
      icon: 'today',
      label: t('followUps.today'),
      tone: 'border-orange-300/60 bg-orange-50/80',
      activeTone: 'ring-2 ring-orange-400/45 border-orange-400',
    },
    {
      key: 'upcoming',
      value: upcoming.length,
      icon: 'event_upcoming',
      label: t('followUps.upcoming'),
      tone: 'border-primary/30 bg-primary-fixed/40',
      activeTone: 'ring-2 ring-primary/30 border-primary/45',
    },
    {
      key: 'all',
      value: rows.length,
      icon: 'inbox',
      label: t('followUps.all'),
      tone: 'border-outline-variant bg-surface-container-low/60',
      activeTone: 'ring-2 ring-primary/25 border-primary/40',
    },
  ]

  function renderCard(r: FollowUpRow) {
    const tone = toneFor(r)
    const moreOpen = openMoreId === r.id
    const busy = busyId === r.id

    return (
      <article
        key={r.id}
        className={`cf-follow-card cf-follow-card-${tone} cf-interactive`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cf-follow-date">
          <span className="day">{format(parseISO(r.follow_up_date), 'd')}</span>
          <span className="mon">{format(parseISO(r.follow_up_date), 'MMM', { locale })}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-sm">
            <h3 className="truncate text-base font-bold text-on-surface">
              {r.patients?.full_name ?? '—'}
            </h3>
            <span className={`cf-follow-badge cf-follow-badge-${tone}`}>{dueLabel(r)}</span>
          </div>

          <div className="mt-xs flex flex-wrap items-center gap-x-md gap-y-xs text-sm text-on-surface-variant">
            <span className="font-medium">#{r.patients?.file_number}</span>
            {r.patients?.phone ? (
              <span className="inline-flex items-center gap-xs">
                <Icon name="call" className="text-[14px]" />
                {r.patients.phone}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-xs">
              <Icon name="event" className="text-[14px]" />
              {format(parseISO(r.follow_up_date), 'dd MMM yyyy', { locale })}
            </span>
          </div>

          <p className="mt-sm text-sm text-on-surface">
            {r.diagnosis?.trim() || r.chief_complaint?.trim() || t('consultation.noDx')}
          </p>
          <p className="mt-1 text-xs text-outline">
            {t('followUps.lastVisit')}:{' '}
            {format(parseISO(r.visit_date), 'dd MMM yyyy', { locale })}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-sm">
          <Link
            to={`/appointments?patientId=${r.patient_id}`}
            className="cf-btn cf-btn-primary py-sm text-sm !text-white"
          >
            <Icon name="event" />
            {t('followUps.book')}
          </Link>
          <button
            type="button"
            disabled={busy}
            className="cf-btn cf-btn-success py-sm text-sm !text-white"
            onClick={() => void clearFollowUp(r.id)}
          >
            <Icon name={busy ? 'progress_activity' : 'check'} className={busy ? 'animate-spin' : ''} />
            {t('followUps.done')}
          </button>

          <div className="relative">
            <button
              type="button"
              className="cf-btn cf-btn-ghost py-sm text-xs"
              aria-expanded={moreOpen}
              onClick={(e) => {
                e.stopPropagation()
                setOpenMoreId(moreOpen ? null : r.id)
              }}
            >
              <Icon name="more_horiz" />
              {t('waiting.moreActions')}
            </button>
            {moreOpen ? (
              <div className="cf-wait-menu absolute end-0 z-20 mt-1 min-w-[12rem] overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest py-1 shadow-lg">
                <div className="px-2 py-1">
                  <WhatsAppButton
                    compact
                    phone={r.patients?.phone}
                    message={followUpWhatsAppMessage({
                      clinicName: tenant?.name ?? 'ClinicFlow',
                      patientName: r.patients?.full_name ?? '',
                      followUpDate: r.follow_up_date,
                      lang: i18n.language === 'en' ? 'en' : 'ar',
                    })}
                  />
                </div>
                <Link
                  to={`/patients/${r.patient_id}`}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container"
                  onClick={() => setOpenMoreId(null)}
                >
                  <Icon name="folder_open" className="text-[16px]" />
                  {t('patients.openFile')}
                </Link>
                <Link
                  to={`/consultation?patientId=${r.patient_id}`}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container"
                  onClick={() => setOpenMoreId(null)}
                >
                  <Icon name="stethoscope" className="text-[16px]" />
                  {t('consultation.start')}
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container"
                  onClick={() => void snooze(r.id, 7)}
                >
                  <Icon name="snooze" className="text-[16px]" />
                  {t('followUps.snooze')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container"
                  onClick={() => void snooze(r.id, 3)}
                >
                  <Icon name="update" className="text-[16px]" />
                  {t('followUps.snooze3')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </article>
    )
  }

  function renderGroup(title: string, icon: string, items: FollowUpRow[], tone: string) {
    if (items.length === 0) return null
    return (
      <section className="space-y-sm">
        <div className={`flex items-center gap-sm rounded-xl px-md py-sm ${tone}`}>
          <Icon name={icon} className="text-xl" />
          <h2 className="font-semibold text-on-surface">{title}</h2>
          <span className="ms-auto rounded-full bg-surface-container-lowest/80 px-2.5 py-0.5 text-xs font-bold">
            {items.length}
          </span>
        </div>
        <div className="space-y-sm">{items.map(renderCard)}</div>
      </section>
    )
  }

  return (
    <div className="cf-page-enter space-y-lg" onClick={() => setOpenMoreId(null)}>
      <Toast message={toast} tone="success" onDismiss={() => setToast(null)} />

      <div className="cf-history-hero">
        <div className="min-w-0">
          <div className="flex items-center gap-sm">
            <span className="cf-history-card-icon bg-primary-fixed text-primary">
              <Icon name="event_repeat" />
            </span>
            <div>
              <h1 className="font-headline-md text-headline-md font-bold text-on-surface">
                {t('followUps.title')}
              </h1>
              <p className="mt-0.5 text-sm text-on-surface-variant">{t('followUps.subtitle')}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-sm">
          <Link to="/appointments" className="cf-btn cf-btn-primary !text-white">
            <Icon name="event" />
            {t('appointments.add')}
          </Link>
          <Link to="/waiting" className="cf-btn cf-btn-secondary">
            <Icon name="group" />
            {t('appointments.waitingRoom')}
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-error-container bg-error-container px-md py-sm text-sm text-on-error-container">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setFilter(card.key)}
            className={`cf-card flex items-center gap-md p-md text-start transition ${card.tone} ${
              filter === card.key ? card.activeTone : 'hover:brightness-[0.99]'
            }`}
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

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low/40 px-md py-xl text-center">
          <Icon name="event_available" className="mb-sm text-4xl text-outline" />
          <p className="font-semibold text-on-surface">{t('followUps.empty')}</p>
          <p className="mt-xs text-sm text-on-surface-variant">{t('followUps.emptyHint')}</p>
          <Link to="/consultation" className="cf-btn cf-btn-primary mt-md inline-flex !text-white">
            <Icon name="stethoscope" />
            {t('consultation.start')}
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant px-md py-xl text-center text-on-surface-variant">
          {t('followUps.filterEmpty')}
        </div>
      ) : filter === 'all' ? (
        <div className="space-y-lg" onClick={(e) => e.stopPropagation()}>
          {renderGroup(
            t('followUps.overdue'),
            'priority_high',
            overdue,
            'bg-error-container/55 text-on-error-container',
          )}
          {renderGroup(t('followUps.today'), 'today', dueToday, 'bg-orange-50 text-orange-900')}
          {renderGroup(
            t('followUps.upcoming'),
            'event_upcoming',
            upcoming,
            'bg-primary-fixed/50 text-on-primary-fixed-variant',
          )}
        </div>
      ) : (
        <div className="space-y-sm" onClick={(e) => e.stopPropagation()}>
          {visible.map(renderCard)}
        </div>
      )}
    </div>
  )
}
