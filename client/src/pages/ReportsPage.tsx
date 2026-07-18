import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import { ar, enUS } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Icon } from '../components/Icon'
import { printWeeklyReport } from '../lib/print'

type Period = 'day' | 'week' | 'month' | 'year'
type ReportTab = 'patients' | 'revenue' | 'doctor' | 'diseases'

function rangeFor(period: Period) {
  const now = new Date()
  if (period === 'day') return { start: startOfDay(now), end: endOfDay(now) }
  if (period === 'week') {
    return { start: startOfWeek(now, { weekStartsOn: 6 }), end: endOfWeek(now, { weekStartsOn: 6 }) }
  }
  if (period === 'month') return { start: startOfMonth(now), end: endOfMonth(now) }
  return { start: startOfYear(now), end: endOfYear(now) }
}

function formatMoney(amount: number, currency: string) {
  return `${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`
}

export function ReportsPage() {
  const { t, i18n } = useTranslation()
  const { tenant, user } = useAuth()
  const locale = i18n.language === 'ar' ? ar : enUS
  const currency = t('secretary.currency')
  const [period, setPeriod] = useState<Period>('month')
  const [tab, setTab] = useState<ReportTab>('patients')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [patientRows, setPatientRows] = useState<{ name: string; visits: number }[]>([])
  const [revenueTotal, setRevenueTotal] = useState(0)
  const [revenueByDay, setRevenueByDay] = useState<{ day: string; total: number }[]>([])
  const [doctorRows, setDoctorRows] = useState<{ name: string; visits: number }[]>([])
  const [diseaseRows, setDiseaseRows] = useState<{ name: string; count: number }[]>([])

  const range = useMemo(() => rangeFor(period), [period])
  const visitCount = useMemo(
    () => patientRows.reduce((s, r) => s + r.visits, 0),
    [patientRows],
  )
  const maxRevenueDay = useMemo(
    () => Math.max(1, ...revenueByDay.map((r) => r.total)),
    [revenueByDay],
  )
  const maxDisease = useMemo(
    () => Math.max(1, ...diseaseRows.slice(0, 8).map((r) => r.count)),
    [diseaseRows],
  )

  useEffect(() => {
    async function load() {
      if (!tenant) return
      setLoading(true)
      setError(null)
      const startIso = range.start.toISOString()
      const endIso = range.end.toISOString()

      const [{ data: visits, error: e1 }, { data: invoices, error: e2 }, { data: users }] =
        await Promise.all([
          supabase
            .from('visits')
            .select('id, patient_id, doctor_id, diagnosis, visit_date, patients(full_name)')
            .eq('tenant_id', tenant.id)
            .gte('visit_date', startIso)
            .lte('visit_date', endIso),
          supabase
            .from('invoices')
            .select('total, created_at')
            .eq('tenant_id', tenant.id)
            .gte('created_at', startIso)
            .lte('created_at', endIso),
          supabase.from('users').select('id, full_name').eq('tenant_id', tenant.id),
        ])

      if (e1 || e2) {
        setError(e1?.message ?? e2?.message ?? t('common.error'))
        setLoading(false)
        return
      }

      const visitList = visits ?? []
      const patientMap = new Map<string, { name: string; visits: number }>()
      for (const v of visitList) {
        const name = (v.patients as { full_name?: string } | null)?.full_name ?? v.patient_id
        const prev = patientMap.get(v.patient_id) ?? { name, visits: 0 }
        prev.visits += 1
        patientMap.set(v.patient_id, prev)
      }
      setPatientRows([...patientMap.values()].sort((a, b) => b.visits - a.visits).slice(0, 50))

      const invList = invoices ?? []
      setRevenueTotal(invList.reduce((s, i) => s + Number(i.total ?? 0), 0))
      const byDay = new Map<string, number>()
      for (const inv of invList) {
        const day = format(new Date(inv.created_at), 'yyyy-MM-dd')
        byDay.set(day, (byDay.get(day) ?? 0) + Number(inv.total ?? 0))
      }
      setRevenueByDay(
        [...byDay.entries()]
          .map(([day, total]) => ({ day, total }))
          .sort((a, b) => a.day.localeCompare(b.day)),
      )

      const userMap = new Map((users ?? []).map((u) => [u.id, u.full_name]))
      const doctorMap = new Map<string, { name: string; visits: number }>()
      for (const v of visitList) {
        const id = v.doctor_id ?? 'unknown'
        const name = userMap.get(id) ?? t('reports.unknownDoctor')
        const prev = doctorMap.get(id) ?? { name, visits: 0 }
        prev.visits += 1
        doctorMap.set(id, prev)
      }
      setDoctorRows([...doctorMap.values()].sort((a, b) => b.visits - a.visits))

      const diseaseMap = new Map<string, number>()
      for (const v of visitList) {
        const dx = (v.diagnosis ?? '').trim()
        if (!dx) continue
        diseaseMap.set(dx, (diseaseMap.get(dx) ?? 0) + 1)
      }
      setDiseaseRows(
        [...diseaseMap.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 50),
      )

      setLoading(false)
    }
    void load()
  }, [tenant, range.start, range.end, t])

  const tabs: Array<{ key: ReportTab; icon: string }> = [
    { key: 'patients', icon: 'groups' },
    { key: 'revenue', icon: 'payments' },
    { key: 'doctor', icon: 'medical_services' },
    { key: 'diseases', icon: 'coronavirus' },
  ]

  return (
    <div className="cf-page-enter space-y-lg">
      <div className="cf-history-hero">
        <div className="min-w-0">
          <div className="flex items-center gap-sm">
            <span className="cf-history-card-icon bg-primary-fixed text-primary">
              <Icon name="assessment" />
            </span>
            <div>
              <h1 className="font-headline-md text-headline-md font-bold text-on-surface">
                {t('reports.title')}
              </h1>
              <p className="mt-0.5 text-sm text-on-surface-variant">
                {format(range.start, 'dd MMM yyyy', { locale })} →{' '}
                {format(range.end, 'dd MMM yyyy', { locale })}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-sm">
          <Link to="/invoices" className="cf-btn cf-btn-secondary">
            <Icon name="payments" />
            {t('nav.billing')}
          </Link>
          {!loading && (
            <button
              type="button"
              className="cf-btn cf-btn-primary !text-white"
              onClick={() =>
                printWeeklyReport({
                  clinicName: tenant?.name ?? 'ClinicFlow',
                  logoUrl: tenant?.logo_url,
                  clinicPhone: tenant?.phone,
                  rangeLabel: `${format(range.start, 'yyyy-MM-dd')} → ${format(range.end, 'yyyy-MM-dd')}`,
                  visits: visitCount,
                  patients: patientRows.length,
                  revenue: revenueTotal,
                  topDiseases: diseaseRows,
                  doctorName: user?.full_name,
                })
              }
            >
              <Icon name="print" />
              {period === 'week' ? t('reports.printWeekly') : t('reports.printPeriod')}
            </button>
          )}
        </div>
      </div>

      <div className="cf-wait-tabs-wrap">
        <div className="cf-wait-tabs !min-w-0 !flex-wrap" role="tablist" aria-label={t('reports.periodLabel')}>
          {(['day', 'week', 'month', 'year'] as Period[]).map((p) => {
            const active = period === p
            return (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(p)}
                className={`cf-wait-tab cf-wait-tab-all${active ? ' is-active' : ''}`}
              >
                <span className="cf-wait-tab-dot" aria-hidden />
                <span className="cf-wait-tab-label">{t(`reports.period.${p}`)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-error-container bg-error-container px-md py-sm text-sm text-on-error-container">
          {error}
        </p>
      )}

      {loading ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest px-md py-xl text-center text-on-surface-variant">
          <Icon name="progress_activity" className="mb-sm animate-spin text-3xl text-primary" />
          <p>{t('common.loading')}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
            <div className="cf-finance-stat cf-finance-stat-primary">
              <span className="cf-stat-label">{t('patients.visits')}</span>
              <div className="cf-stat-value">{visitCount}</div>
            </div>
            <div className="cf-finance-stat cf-finance-stat-secondary">
              <span className="cf-stat-label">{t('billing.total')}</span>
              <div className="cf-stat-value text-[1.25rem]">
                {formatMoney(revenueTotal, currency)}
              </div>
            </div>
            <div className="cf-finance-stat cf-finance-stat-today">
              <span className="cf-stat-label">{t('reports.doctor')}</span>
              <div className="cf-stat-value">{doctorRows.length}</div>
            </div>
            <div className="cf-finance-stat">
              <span className="cf-stat-label">{t('visits.diagnosis')}</span>
              <div className="cf-stat-value">{diseaseRows.length}</div>
            </div>
          </div>

          <div className="cf-card overflow-hidden">
            <div className="cf-wait-tabs-wrap border-b border-outline-variant/60 bg-surface-container-low/40 px-md py-md">
              <div className="cf-wait-tabs !min-w-0 !flex-wrap" role="tablist">
                {tabs.map((item) => {
                  const active = tab === item.key
                  const count =
                    item.key === 'patients'
                      ? patientRows.length
                      : item.key === 'revenue'
                        ? revenueByDay.length
                        : item.key === 'doctor'
                          ? doctorRows.length
                          : diseaseRows.length
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(item.key)}
                      className={`cf-wait-tab cf-wait-tab-all${active ? ' is-active' : ''}`}
                    >
                      <Icon name={item.icon} className="text-[16px]" />
                      <span className="cf-wait-tab-label">{t(`reports.tabs.${item.key}`)}</span>
                      <span className="cf-wait-tab-count">{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="p-md">
              {tab === 'patients' && (
                patientRows.length === 0 ? (
                  <EmptyReport text={t('reports.emptyPatients')} />
                ) : (
                  <div className="space-y-sm">
                    {patientRows.map((r, idx) => (
                      <div key={`${r.name}-${idx}`} className="cf-report-row">
                        <span className="cf-report-rank">{String(idx + 1).padStart(2, '0')}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-on-surface">{r.name}</p>
                          <p className="text-xs text-on-surface-variant">{t('patients.visits')}</p>
                        </div>
                        <span className="text-lg font-extrabold text-primary">{r.visits}</span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'revenue' && (
                revenueByDay.length === 0 ? (
                  <EmptyReport text={t('reports.emptyRevenue')} />
                ) : (
                  <div className="space-y-md">
                    <div className="rounded-xl bg-secondary-container/35 px-md py-md">
                      <p className="text-xs font-bold text-on-secondary-container">
                        {t('billing.total')}
                      </p>
                      <p className="text-2xl font-extrabold text-on-secondary-container">
                        {formatMoney(revenueTotal, currency)}
                      </p>
                    </div>
                    <div className="space-y-sm">
                      {revenueByDay.map((r) => (
                        <div key={r.day} className="cf-report-bar-row">
                          <div className="flex items-center justify-between gap-sm text-sm">
                            <span className="font-semibold">
                              {format(new Date(r.day), 'dd MMM yyyy', { locale })}
                            </span>
                            <span className="font-bold text-primary">
                              {formatMoney(r.total, currency)}
                            </span>
                          </div>
                          <div className="cf-report-bar-track">
                            <div
                              className="cf-report-bar-fill"
                              style={{ width: `${Math.max(6, (r.total / maxRevenueDay) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {tab === 'doctor' && (
                doctorRows.length === 0 ? (
                  <EmptyReport text={t('reports.emptyDoctor')} />
                ) : (
                  <div className="space-y-sm">
                    {doctorRows.map((r, idx) => (
                      <div key={`${r.name}-${idx}`} className="cf-report-row">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-fixed text-primary">
                          <Icon name="stethoscope" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-on-surface">{r.name}</p>
                          <p className="text-xs text-on-surface-variant">{t('reports.doctor')}</p>
                        </div>
                        <span className="text-lg font-extrabold text-primary">{r.visits}</span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === 'diseases' && (
                diseaseRows.length === 0 ? (
                  <EmptyReport text={t('reports.emptyDiseases')} />
                ) : (
                  <div className="space-y-sm">
                    {diseaseRows.map((r) => (
                      <div key={r.name} className="cf-report-bar-row">
                        <div className="flex items-center justify-between gap-sm text-sm">
                          <span className="min-w-0 truncate font-semibold">{r.name}</span>
                          <span className="shrink-0 font-bold text-primary">{r.count}</span>
                        </div>
                        <div className="cf-report-bar-track">
                          <div
                            className="cf-report-bar-fill cf-report-bar-fill-alt"
                            style={{
                              width: `${Math.max(6, (r.count / maxDisease) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function EmptyReport({ text }: { text: string }) {
  return (
    <div className="py-xl text-center text-on-surface-variant">
      <Icon name="inbox" className="mb-sm text-4xl text-outline" />
      <p className="font-semibold text-on-surface">{text}</p>
    </div>
  )
}
