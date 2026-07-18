import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ar, enUS } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Icon } from '../components/Icon'
import { appointmentStatusBadgeClass } from '../lib/appointmentStatus'
import type { Appointment } from '../types/clinic'
import type { Patient } from '../types/database'

type ViewMode = 'day' | 'week' | 'month'

const STATUSES: Appointment['status'][] = [
  'waiting',
  'with_doctor',
  'done',
  'no_show',
  'cancelled',
]

export function AppointmentsPage() {
  const { t, i18n } = useTranslation()
  const { tenant, user } = useAuth()
  const [view, setView] = useState<ViewMode>('day')
  const [cursor, setCursor] = useState(new Date())
  const [items, setItems] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    patient_id: '',
    scheduled_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    duration_minutes: 30,
  })

  const locale = i18n.language === 'ar' ? ar : enUS

  const range = useMemo(() => {
    if (view === 'day') {
      const start = startOfDay(cursor)
      return { start, end: addDays(start, 1) }
    }
    if (view === 'week') {
      const start = startOfWeek(cursor, { weekStartsOn: 6 })
      return { start, end: endOfWeek(cursor, { weekStartsOn: 6 }) }
    }
    const start = startOfMonth(cursor)
    return { start, end: endOfMonth(cursor) }
  }, [cursor, view])

  async function load() {
    if (!tenant) return
    setError(null)
    const [{ data: appts, error: aErr }, { data: pats }] = await Promise.all([
      supabase
        .from('appointments')
        .select('*, patients(full_name, phone, file_number)')
        .eq('tenant_id', tenant.id)
        .gte('scheduled_at', range.start.toISOString())
        .lte('scheduled_at', range.end.toISOString())
        .order('scheduled_at', { ascending: true }),
      supabase
        .from('patients')
        .select('id, full_name, file_number, phone')
        .eq('tenant_id', tenant.id)
        .order('full_name')
        .limit(200),
    ])
    if (aErr) setError(aErr.message)
    setItems((appts as Appointment[]) ?? [])
    setPatients((pats as Patient[]) ?? [])
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id, range.start.toISOString(), range.end.toISOString()])

  async function createAppt(e: FormEvent) {
    e.preventDefault()
    if (!tenant || !form.patient_id) return
    const { error: err } = await supabase.from('appointments').insert({
      tenant_id: tenant.id,
      patient_id: form.patient_id,
      doctor_id: user?.id ?? null,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes,
      status: 'waiting',
    })
    if (err) setError(err.message)
    else {
      setShowForm(false)
      await load()
    }
  }

  async function updateStatus(id: string, status: Appointment['status']) {
    const { error: err } = await supabase.from('appointments').update({ status }).eq('id', id)
    if (err) setError(err.message)
    else await load()
  }

  async function reschedule(id: string, scheduled_at: string) {
    const { error: err } = await supabase
      .from('appointments')
      .update({ scheduled_at: new Date(scheduled_at).toISOString() })
      .eq('id', id)
    if (err) setError(err.message)
    else await load()
  }

  const monthDays = useMemo(() => {
    if (view !== 'month') return []
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 6 })
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 6 })
    const days: Date[] = []
    let d = start
    while (d <= end) {
      days.push(d)
      d = addDays(d, 1)
    }
    return days
  }, [cursor, view])

  return (
    <div className="space-y-lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md font-bold text-on-surface">{t('appointments.title')}</h1>
          <p className="mt-xs font-body-md text-body-md text-on-surface-variant">{format(cursor, view === 'month' ? 'MMMM yyyy' : 'dd MMM yyyy', { locale })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/waiting" className="cf-btn cf-btn-ghost">
            <Icon name="hourglass_top" />
            {t('appointments.waitingRoom')}
          </Link>
          <button type="button" onClick={() => setShowForm((v) => !v)} className="cf-btn cf-btn-primary">
            <Icon name="add" />
            {t('appointments.add')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-sm">
        {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setView(mode)}
            className={`cf-btn text-sm ${view === mode ? 'cf-btn-primary' : 'cf-btn-ghost'}`}
          >
            {t(`appointments.${mode}`)}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-outline-variant" />
        <button type="button" className="cf-btn cf-btn-ghost px-2" onClick={() => setCursor(addDays(cursor, view === 'month' ? -30 : view === 'week' ? -7 : -1))}>
          <Icon name="chevron_right" className="ltr:rotate-180" />
        </button>
        <span className="text-sm font-medium">{format(cursor, view === 'month' ? 'MMMM yyyy' : 'dd MMM yyyy', { locale })}</span>
        <button type="button" className="cf-btn cf-btn-ghost px-2" onClick={() => setCursor(addDays(cursor, view === 'month' ? 30 : view === 'week' ? 7 : 1))}>
          <Icon name="chevron_left" className="ltr:rotate-180" />
        </button>
        <button type="button" className="cf-btn cf-btn-secondary text-sm" onClick={() => setCursor(new Date())}>
          {t('appointments.today')}
        </button>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {showForm && (
        <form onSubmit={createAppt} className="grid gap-md rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="cf-label">{t('patients.title')}</span>
            <select
              required
              className="cf-input"
              value={form.patient_id}
              onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))}
            >
              <option value="">—</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.file_number} — {p.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="cf-label">{t('appointments.when')}</span>
            <input
              type="datetime-local"
              required
              className="cf-input"
              value={form.scheduled_at}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
            />
          </label>
          <button type="submit" className="cf-btn cf-btn-primary sm:col-span-3">
            {t('patients.save')}
          </button>
        </form>
      )}

      {view === 'month' ? (
        <div className="grid grid-cols-7 gap-1 rounded-xl border border-outline-variant bg-surface-container-lowest p-md text-sm shadow-sm">
          {monthDays.map((day) => {
            const dayItems = items.filter((a) => isSameDay(new Date(a.scheduled_at), day))
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => {
                  setCursor(day)
                  setView('day')
                }}
                className={`min-h-20 rounded-[var(--cf-radius)] border p-1.5 text-start transition-colors hover:bg-surface-container-low ${isSameMonth(day, cursor) ? 'border-outline-variant' : 'border-transparent opacity-40'} ${isSameDay(day, new Date()) ? 'bg-primary-fixed ring-1 ring-primary' : ''}`}
              >
                <div className="text-xs font-semibold">{format(day, 'd')}</div>
                {dayItems.slice(0, 3).map((a) => (
                  <div key={a.id} className="truncate text-[10px] text-on-surface-variant">
                    {a.patients?.full_name}
                  </div>
                ))}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          {items.length === 0 ? (
            <p className="p-6 text-center text-on-surface-variant">{t('appointments.empty')}</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="px-4 py-3 text-start">{t('patients.fullName')}</th>
                  <th className="px-4 py-3 text-start">{t('appointments.when')}</th>
                  <th className="px-4 py-3 text-start">{t('appointments.title')}</th>
                  <th className="px-4 py-3 text-start">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className="border-t border-outline-variant hover:bg-surface-container-low">
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.patients?.full_name ?? a.patient_id}</div>
                      <div className="text-xs text-on-surface-variant">#{a.patients?.file_number}</div>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {format(new Date(a.scheduled_at), 'PPpp', { locale })}
                      <span className="ms-1 text-xs">· {a.duration_minutes}m</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={appointmentStatusBadgeClass(a.status)}>
                        {t(`appointments.status.${a.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <select
                          className="cf-input w-auto px-2 py-1 text-xs"
                          value={a.status}
                          onChange={(e) => void updateStatus(a.id, e.target.value as Appointment['status'])}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {t(`appointments.status.${s}`)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="datetime-local"
                          className="cf-input w-auto px-2 py-1 text-xs"
                          defaultValue={format(new Date(a.scheduled_at), "yyyy-MM-dd'T'HH:mm")}
                          onBlur={(e) => {
                            if (e.target.value) void reschedule(a.id, e.target.value)
                          }}
                        />
                        {a.status === 'with_doctor' && (
                          <Link
                            to={`/consultation?patientId=${a.patient_id}&appointmentId=${a.id}`}
                            className="cf-btn cf-btn-primary px-2 py-1 text-xs"
                          >
                            {t('consultation.start')}
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
