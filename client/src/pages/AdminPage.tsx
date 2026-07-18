import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns'
import { ar, enUS } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Icon } from '../components/Icon'
import { Toast } from '../components/Toast'
import { getSpecialtyPack } from '../lib/specialtyPacks'
import {
  createSubscriptionPayment,
  planMonthlyPrice,
  type PaymentProviderId,
} from '../lib/billing/provider'
import type { PlatformSubscriptionInvoice, Tenant } from '../types/database'

type AdminTab = 'clinics' | 'billing' | 'alerts' | 'growth'

type StaffUser = {
  id: string
  tenant_id: string | null
  full_name: string
  email: string
  role: string
  created_at?: string
}

type TenantRow = Tenant & {
  users_count: number
  patients_count: number
  appointments_7d: number
  staff: StaffUser[]
}

type StatusFilter = 'all' | 'trial' | 'expired' | 'no_trial'
type PlanFilter = 'all' | Tenant['subscription_plan']
type SubStatus = NonNullable<Tenant['subscription_status']>

type AuditRow = {
  id: string
  tenant_id: string
  action: string
  entity_type: string
  created_at: string
}

function monthBounds(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return {
    periodStart: format(start, 'yyyy-MM-dd'),
    periodEnd: format(end, 'yyyy-MM-dd'),
  }
}

function trialStatus(trialEndsAt: string | null | undefined): StatusFilter {
  if (!trialEndsAt) return 'no_trial'
  return new Date(trialEndsAt).getTime() >= Date.now() ? 'trial' : 'expired'
}

function daysLeft(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null
  return differenceInCalendarDays(parseISO(trialEndsAt), new Date())
}

function effectiveSubStatus(tenant: Tenant): SubStatus | 'unknown' {
  if (tenant.subscription_status) return tenant.subscription_status
  const ts = trialStatus(tenant.trial_ends_at)
  if (ts === 'trial') return 'trial'
  if (ts === 'expired') return 'past_due'
  return 'unknown'
}

function whatsAppUrl(phone: string | null | undefined): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `20${digits.slice(1)}`
  if (!digits) return null
  return `https://wa.me/${digits}`
}

export function AdminPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, loading: authLoading, signOut, startImpersonate, stopImpersonate, impersonating, tenant: impersonateTenant } =
    useAuth()
  const locale = i18n.language === 'en' ? enUS : ar
  const defaultPeriod = monthBounds()

  const [tab, setTab] = useState<AdminTab>('clinics')
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [invoices, setInvoices] = useState<PlatformSubscriptionInvoice[]>([])
  const [needMigrationHint, setNeedMigrationHint] = useState(false)
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [trialDays, setTrialDays] = useState(14)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [extendDays, setExtendDays] = useState(14)
  const [suspendTarget, setSuspendTarget] = useState<TenantRow | null>(null)
  const [suspendMessage, setSuspendMessage] = useState('')

  const [billTenantId, setBillTenantId] = useState('')
  const [billPlan, setBillPlan] = useState<Tenant['subscription_plan']>('starter')
  const [billAmount, setBillAmount] = useState(planMonthlyPrice('starter'))
  const [billPeriodStart, setBillPeriodStart] = useState(defaultPeriod.periodStart)
  const [billPeriodEnd, setBillPeriodEnd] = useState(defaultPeriod.periodEnd)
  const [billProvider, setBillProvider] = useState<PaymentProviderId>('manual')
  const [billNotes, setBillNotes] = useState('')

  async function load() {
    setError(null)
    setLoading(true)
    const since7 = subDays(new Date(), 7)

    const [
      { data: tenantRows, error: tErr },
      { data: settings },
      { data: userRows, error: uErr },
      { data: patientRows },
      { data: apptRows },
      { data: auditRows },
      invoiceResult,
    ] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('platform_settings').select('default_trial_days').eq('id', 1).maybeSingle(),
      supabase
        .from('users')
        .select('id, tenant_id, full_name, email, role, created_at')
        .not('tenant_id', 'is', null)
        .order('created_at', { ascending: false }),
      supabase.from('patients').select('tenant_id'),
      supabase.from('appointments').select('tenant_id').gte('created_at', since7.toISOString()),
      supabase
        .from('audit_log')
        .select('id, tenant_id, action, entity_type, created_at')
        .order('created_at', { ascending: false })
        .limit(25),
      supabase
        .from('platform_subscription_invoices')
        .select('*')
        .order('created_at', { ascending: false }),
    ])

    if (tErr) {
      setError(tErr.message)
      setLoading(false)
      return
    }
    if (uErr) console.warn(uErr.message)

    let invoiceRows: PlatformSubscriptionInvoice[] = []
    if (invoiceResult.error) {
      console.warn(invoiceResult.error.message)
      setNeedMigrationHint(true)
    } else {
      setNeedMigrationHint(false)
      invoiceRows = (invoiceResult.data as PlatformSubscriptionInvoice[]) ?? []
    }

    const staffByTenant = new Map<string, StaffUser[]>()
    for (const u of (userRows as StaffUser[]) ?? []) {
      if (!u.tenant_id) continue
      const list = staffByTenant.get(u.tenant_id) ?? []
      list.push(u)
      staffByTenant.set(u.tenant_id, list)
    }

    const patientsByTenant = new Map<string, number>()
    for (const p of patientRows ?? []) {
      const tid = (p as { tenant_id: string }).tenant_id
      patientsByTenant.set(tid, (patientsByTenant.get(tid) ?? 0) + 1)
    }

    const apptByTenant = new Map<string, number>()
    for (const a of apptRows ?? []) {
      const tid = (a as { tenant_id: string }).tenant_id
      apptByTenant.set(tid, (apptByTenant.get(tid) ?? 0) + 1)
    }

    const enriched: TenantRow[] = ((tenantRows as Tenant[]) ?? []).map((tenant) => {
      const staff = staffByTenant.get(tenant.id) ?? []
      return {
        ...tenant,
        staff,
        users_count: staff.length,
        patients_count: patientsByTenant.get(tenant.id) ?? 0,
        appointments_7d: apptByTenant.get(tenant.id) ?? 0,
      }
    })

    setTenants(enriched)
    setInvoices(invoiceRows)
    setAudit((auditRows as AuditRow[]) ?? [])
    if (settings?.default_trial_days) setTrialDays(settings.default_trial_days)
    if (!billTenantId && enriched.length) setBillTenantId(enriched[0].id)
    setLoading(false)
  }

  useEffect(() => {
    if (user?.role === 'super_admin') void load()
  }, [user?.role])

  useEffect(() => {
    setBillAmount(planMonthlyPrice(billPlan))
  }, [billPlan])

  const kpis = useMemo(() => {
    const total = tenants.length
    const trial = tenants.filter((row) => trialStatus(row.trial_ends_at) === 'trial').length
    const expired = tenants.filter((row) => trialStatus(row.trial_ends_at) === 'expired').length
    const users = tenants.reduce((s, row) => s + row.users_count, 0)
    const patients = tenants.reduce((s, row) => s + row.patients_count, 0)
    const appts7 = tenants.reduce((s, row) => s + row.appointments_7d, 0)
    const byPlan = {
      starter: tenants.filter((row) => row.subscription_plan === 'starter').length,
      professional: tenants.filter((row) => row.subscription_plan === 'professional').length,
      enterprise: tenants.filter((row) => row.subscription_plan === 'enterprise').length,
    }
    return { total, trial, expired, users, patients, appts7, byPlan }
  }, [tenants])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tenants.filter((tenant) => {
      if (planFilter !== 'all' && tenant.subscription_plan !== planFilter) return false
      if (statusFilter !== 'all' && trialStatus(tenant.trial_ends_at) !== statusFilter) return false
      if (!q) return true
      const hay = [tenant.name, tenant.phone, tenant.address, tenant.specialty, ...tenant.staff.map((s) => s.email)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [tenants, query, planFilter, statusFilter])

  const tenantNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const row of tenants) m.set(row.id, row.name)
    return m
  }, [tenants])

  const alertClinics = useMemo(() => {
    return tenants
      .filter((row) => !row.is_suspended)
      .filter((row) => {
        const left = daysLeft(row.trial_ends_at)
        return left != null && left >= 0 && left <= 3
      })
      .sort((a, b) => {
        const la = daysLeft(a.trial_ends_at) ?? 99
        const lb = daysLeft(b.trial_ends_at) ?? 99
        return la - lb
      })
  }, [tenants])

  const growth = useMemo(() => {
    const now = new Date()
    const since7 = subDays(now, 7)
    const since30 = subDays(now, 30)
    const new7 = tenants.filter((row) => new Date(row.created_at) >= since7).length
    const new30 = tenants.filter((row) => new Date(row.created_at) >= since30).length
    const onTrial = tenants.filter((row) => effectiveSubStatus(row) === 'trial').length
    const active = tenants.filter((row) => effectiveSubStatus(row) === 'active').length

    const paidTenantIds = new Set(
      invoices.filter((inv) => inv.status === 'paid').map((inv) => inv.tenant_id),
    )
    const invoiceTenantIds = new Set(invoices.map((inv) => inv.tenant_id))
    const eligible = tenants.filter((row) => {
      const trialPast = row.trial_ends_at != null && new Date(row.trial_ends_at) < now
      return trialPast || invoiceTenantIds.has(row.id)
    })
    const converted = eligible.filter((row) => paidTenantIds.has(row.id)).length
    const conversionPct = eligible.length ? Math.round((converted / eligible.length) * 100) : 0

    const revenue = invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount_egp), 0)

    const weekBuckets: { label: string; count: number }[] = []
    for (let i = 7; i >= 0; i--) {
      const weekEnd = startOfDay(subDays(now, i * 7))
      const weekStart = subDays(weekEnd, 6)
      const count = tenants.filter((row) => {
        const created = new Date(row.created_at)
        return created >= weekStart && created <= weekEnd
      }).length
      weekBuckets.push({
        label: `${format(weekStart, 'd MMM', { locale })} – ${format(weekEnd, 'd MMM', { locale })}`,
        count,
      })
    }

    return { new7, new30, onTrial, active, conversionPct, revenue, weekBuckets }
  }, [tenants, invoices, locale])

  if (authLoading) {
    return <p className="p-6 text-on-surface-variant">{t('common.loading')}</p>
  }

  if (!user || user.role !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  async function saveTrialDays(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const updatedAt = new Date().toISOString()
    const { data: updated, error: updErr } = await supabase
      .from('platform_settings')
      .update({ default_trial_days: trialDays, updated_at: updatedAt })
      .eq('id', 1)
      .select('id')
    if (updErr) {
      setError(updErr.message)
      setBusy(false)
      return
    }
    if (!updated?.length) {
      const { error: insErr } = await supabase.from('platform_settings').insert({
        id: 1,
        default_trial_days: trialDays,
        updated_at: updatedAt,
      })
      if (insErr) {
        setError(insErr.message)
        setBusy(false)
        return
      }
    }
    setToast(t('admin.settingsSaved'))
    setBusy(false)
  }

  async function updateTenant(
    id: string,
    patch: Partial<
      Pick<
        Tenant,
        | 'subscription_plan'
        | 'trial_ends_at'
        | 'is_suspended'
        | 'suspend_message'
        | 'subscription_status'
        | 'trial_alert_sent_at'
      >
    >,
  ) {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.from('tenants').update(patch).eq('id', id)
    if (err) setError(err.message)
    else {
      setToast(t('admin.tenantUpdated'))
      await load()
    }
    setBusy(false)
  }

  async function updateSubscriptionStatus(id: string, status: SubStatus) {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.from('tenants').update({ subscription_status: status }).eq('id', id)
    if (err) {
      setError(err.message)
      setBusy(false)
      return
    }
    setToast(t('admin.tenantUpdated'))
    await load()
    setBusy(false)
  }

  function extendTrial(tenant: TenantRow, days: number) {
    const base =
      tenant.trial_ends_at && new Date(tenant.trial_ends_at).getTime() > Date.now()
        ? new Date(tenant.trial_ends_at)
        : new Date()
    base.setDate(base.getDate() + days)
    void updateTenant(tenant.id, {
      trial_ends_at: base.toISOString(),
      subscription_status: 'trial',
      is_suspended: false,
      suspend_message: null,
    })
  }

  function endTrialNow(tenant: TenantRow) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    void updateTenant(tenant.id, {
      trial_ends_at: yesterday.toISOString(),
      subscription_status: 'past_due',
    })
  }

  async function confirmSuspend() {
    if (!suspendTarget) return
    await updateTenant(suspendTarget.id, {
      is_suspended: true,
      suspend_message: suspendMessage.trim() || null,
    })
    setSuspendTarget(null)
    setSuspendMessage('')
  }

  async function unsuspendTenant(tenant: TenantRow) {
    await updateTenant(tenant.id, { is_suspended: false, suspend_message: null })
  }

  async function impersonateClinic(tenant: TenantRow) {
    await startImpersonate(tenant.id)
    navigate('/')
  }

  async function markAlertSent(tenant: TenantRow) {
    await updateTenant(tenant.id, { trial_alert_sent_at: new Date().toISOString() })
  }

  async function createInvoice(e: FormEvent) {
    e.preventDefault()
    if (!billTenantId) return
    setBusy(true)
    setError(null)

    const { data: inserted, error: insErr } = await supabase
      .from('platform_subscription_invoices')
      .insert({
        tenant_id: billTenantId,
        plan: billPlan,
        amount_egp: billAmount,
        period_start: billPeriodStart,
        period_end: billPeriodEnd,
        status: 'pending',
        payment_provider: billProvider,
        notes: billNotes.trim() || null,
        created_by: user.id,
      })
      .select('*')
      .single()

    if (insErr || !inserted) {
      setError(insErr?.message ?? 'Insert failed')
      setBusy(false)
      return
    }

    const invoice = inserted as PlatformSubscriptionInvoice
    const payment = await createSubscriptionPayment(billProvider, {
      tenantId: billTenantId,
      invoiceId: invoice.id,
      amountEgp: billAmount,
    })

    await supabase
      .from('platform_subscription_invoices')
      .update({ provider_reference: payment.reference })
      .eq('id', invoice.id)

    setToast(payment.messageAr)
    setBillNotes('')
    await load()
    setBusy(false)
  }

  async function updateInvoiceStatus(
    invoice: PlatformSubscriptionInvoice,
    status: PlatformSubscriptionInvoice['status'],
  ) {
    setBusy(true)
    setError(null)
    const patch: Partial<PlatformSubscriptionInvoice> = { status }
    if (status === 'paid') patch.paid_at = new Date().toISOString()

    const { error: err } = await supabase
      .from('platform_subscription_invoices')
      .update(patch)
      .eq('id', invoice.id)

    if (err) {
      setError(err.message)
      setBusy(false)
      return
    }

    if (status === 'paid') {
      const extend = new Date()
      extend.setDate(extend.getDate() + 30)
      await supabase
        .from('tenants')
        .update({
          subscription_status: 'active',
          subscription_plan: invoice.plan,
          trial_ends_at: extend.toISOString(),
        })
        .eq('id', invoice.tenant_id)
    }

    setToast(t('admin.tenantUpdated'))
    await load()
    setBusy(false)
  }

  function exportCsv() {
    const header = [
      'name',
      'phone',
      'plan',
      'specialty',
      'trial_ends_at',
      'status',
      'suspended',
      'users',
      'patients',
      'appointments_7d',
      'created_at',
    ]
    const rows = filtered.map((row) => [
      row.name,
      row.phone ?? '',
      row.subscription_plan,
      row.specialty ?? '',
      row.trial_ends_at ?? '',
      trialStatus(row.trial_ends_at),
      row.is_suspended ? 'yes' : 'no',
      String(row.users_count),
      String(row.patients_count),
      String(row.appointments_7d),
      row.created_at,
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clinicflow-tenants-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setToast(t('admin.exported'))
  }

  function statusBadge(tenant: TenantRow) {
    const status = trialStatus(tenant.trial_ends_at)
    const left = daysLeft(tenant.trial_ends_at)
    if (status === 'trial') {
      return (
        <span className="cf-admin-badge cf-admin-badge--trial">
          {t('admin.statusTrial')}
          {left != null ? ` · ${left} ${t('admin.days')}` : ''}
        </span>
      )
    }
    if (status === 'expired') {
      return <span className="cf-admin-badge cf-admin-badge--expired">{t('admin.statusExpired')}</span>
    }
    return <span className="cf-admin-badge cf-admin-badge--none">{t('admin.statusNoTrial')}</span>
  }

  function subStatusLabel(status: SubStatus | 'unknown') {
    if (status === 'active') return t('admin.statusActive')
    if (status === 'past_due') return t('admin.statusPastDue')
    if (status === 'cancelled') return t('admin.statusCancelled')
    if (status === 'trial') return t('admin.statusTrial')
    return '—'
  }

  const tabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'clinics', label: t('admin.tabClinics'), icon: 'apartment' },
    { id: 'billing', label: t('admin.tabBilling'), icon: 'receipt_long' },
    { id: 'alerts', label: t('admin.tabAlerts'), icon: 'notifications_active' },
    { id: 'growth', label: t('admin.tabGrowth'), icon: 'trending_up' },
  ]

  return (
    <div className="cf-admin-shell min-h-screen bg-background text-on-surface">
      <Toast message={toast} tone="success" onDismiss={() => setToast(null)} />
      <Toast message={error} tone="error" onDismiss={() => setError(null)} />

      <header className="sticky top-0 z-40 border-b border-outline-variant bg-surface-container-lowest/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-md px-md py-md sm:px-lg">
          <div className="flex min-w-0 items-center gap-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-on-primary">
              <Icon name="admin_panel_settings" filled />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-primary sm:text-xl">{t('admin.title')}</h1>
              <p className="truncate text-xs text-on-surface-variant">
                {user.full_name} · {user.email}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-sm">
            {impersonating && impersonateTenant ? (
              <button
                type="button"
                className="cf-btn cf-btn-secondary py-sm text-xs"
                onClick={() => void stopImpersonate()}
              >
                <Icon name="logout" className="text-base" />
                {t('admin.exitImpersonate')}
              </button>
            ) : null}
            <button
              type="button"
              className="cf-btn cf-btn-ghost py-sm text-xs"
              onClick={() => void load()}
              disabled={loading || busy}
            >
              <Icon name="refresh" className="text-base" />
              {t('admin.refresh')}
            </button>
            <button
              type="button"
              className="cf-btn cf-btn-ghost py-sm text-xs"
              onClick={() => void i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
            >
              <Icon name="language" className="text-base" />
              {i18n.language === 'ar' ? 'EN' : 'ع'}
            </button>
            <button
              type="button"
              className="cf-btn cf-btn-secondary py-sm text-xs"
              onClick={() => void signOut()}
            >
              <Icon name="logout" className="text-base" />
              {t('nav.logout')}
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-md pb-md sm:px-lg">
          <div className="cf-wait-tabs-wrap">
            <div className="cf-wait-tabs !min-w-0 !flex-wrap" role="tablist" aria-label={t('admin.title')}>
              {tabs.map(({ id, label, icon }) => {
                const active = tab === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(id)}
                    className={`cf-wait-tab cf-wait-tab-all${active ? ' is-active' : ''}`}
                  >
                    <Icon name={icon} className="text-base opacity-80" />
                    <span className="cf-wait-tab-label">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </header>

      {impersonating && impersonateTenant ? (
        <div className="border-b border-secondary-container bg-secondary-container/40 px-md py-sm text-center text-xs font-semibold text-on-secondary-container">
          {t('admin.impersonatingAs')}: {impersonateTenant.name}
        </div>
      ) : null}

      {needMigrationHint ? (
        <div className="mx-auto max-w-6xl px-md pt-md sm:px-lg">
          <p className="rounded-lg border border-outline-variant bg-surface-container px-md py-sm text-xs text-on-surface-variant">
            {t('admin.needMigration015')}
          </p>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl space-y-lg px-md py-lg sm:px-lg">
        {tab === 'clinics' ? (
          <>
            <section className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="cf-admin-kpi">
                <div className="cf-admin-kpi-label">{t('admin.kpiClinics')}</div>
                <div className="cf-admin-kpi-value">{kpis.total}</div>
              </div>
              <div className="cf-admin-kpi cf-admin-kpi--trial">
                <div className="cf-admin-kpi-label">{t('admin.kpiTrial')}</div>
                <div className="cf-admin-kpi-value">{kpis.trial}</div>
              </div>
              <div className="cf-admin-kpi cf-admin-kpi--warn">
                <div className="cf-admin-kpi-label">{t('admin.kpiExpired')}</div>
                <div className="cf-admin-kpi-value">{kpis.expired}</div>
              </div>
              <div className="cf-admin-kpi">
                <div className="cf-admin-kpi-label">{t('admin.kpiUsers')}</div>
                <div className="cf-admin-kpi-value">{kpis.users}</div>
              </div>
              <div className="cf-admin-kpi">
                <div className="cf-admin-kpi-label">{t('admin.kpiPatients')}</div>
                <div className="cf-admin-kpi-value">{kpis.patients}</div>
              </div>
              <div className="cf-admin-kpi">
                <div className="cf-admin-kpi-label">{t('admin.kpiAppts7')}</div>
                <div className="cf-admin-kpi-value">{kpis.appts7}</div>
              </div>
            </section>

            <section className="grid gap-md lg:grid-cols-[1.4fr_1fr]">
              <form onSubmit={saveTrialDays} className="cf-card space-y-md p-lg">
                <h2 className="flex items-center gap-2 font-semibold text-primary">
                  <Icon name="tune" />
                  {t('admin.platformSettings')}
                </h2>
                <p className="text-xs text-on-surface-variant">{t('admin.platformSettingsHint')}</p>
                <div className="flex flex-wrap items-end gap-md">
                  <label className="block text-sm">
                    <span className="cf-label">{t('admin.defaultTrialDays')}</span>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      className="cf-input w-36"
                      value={trialDays}
                      onChange={(e) => setTrialDays(Number(e.target.value))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="cf-label">{t('admin.extendDaysLabel')}</span>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      className="cf-input w-36"
                      value={extendDays}
                      onChange={(e) => setExtendDays(Number(e.target.value))}
                    />
                  </label>
                  <button type="submit" disabled={busy} className="cf-btn cf-btn-primary">
                    {t('patients.save')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-sm text-xs text-on-surface-variant">
                  <span className="rounded-lg bg-surface-container px-sm py-xs">Starter: {kpis.byPlan.starter}</span>
                  <span className="rounded-lg bg-surface-container px-sm py-xs">
                    Professional: {kpis.byPlan.professional}
                  </span>
                  <span className="rounded-lg bg-surface-container px-sm py-xs">
                    Enterprise: {kpis.byPlan.enterprise}
                  </span>
                </div>
              </form>

              <aside className="cf-card space-y-sm p-lg">
                <h2 className="flex items-center gap-2 font-semibold text-primary">
                  <Icon name="lightbulb" />
                  {t('admin.ideasTitle')}
                </h2>
                <ul className="space-y-sm text-xs leading-relaxed text-on-surface-variant">
                  <li>• {t('admin.idea1')}</li>
                  <li>• {t('admin.idea2')}</li>
                  <li>• {t('admin.idea3')}</li>
                  <li>• {t('admin.idea4')}</li>
                  <li>• {t('admin.idea5')}</li>
                </ul>
              </aside>
            </section>

            <section className="cf-card space-y-md p-lg">
              <div className="flex flex-wrap items-center justify-between gap-md">
                <h2 className="flex items-center gap-2 font-semibold text-primary">
                  <Icon name="apartment" />
                  {t('admin.clinics')}
                  <span className="text-sm font-medium text-on-surface-variant">({filtered.length})</span>
                </h2>
                <button type="button" className="cf-btn cf-btn-secondary py-sm text-xs" onClick={exportCsv}>
                  <Icon name="download" className="text-base" />
                  {t('admin.exportCsv')}
                </button>
              </div>

              <div className="grid gap-sm md:grid-cols-3">
                <label className="block text-sm md:col-span-1">
                  <span className="cf-label">{t('admin.search')}</span>
                  <input
                    className="cf-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('admin.searchPh')}
                  />
                </label>
                <label className="block text-sm">
                  <span className="cf-label">{t('admin.plan')}</span>
                  <select
                    className="cf-input"
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value as PlanFilter)}
                  >
                    <option value="all">{t('admin.filterAll')}</option>
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="cf-label">{t('admin.trialStatus')}</span>
                  <select
                    className="cf-input"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  >
                    <option value="all">{t('admin.filterAll')}</option>
                    <option value="trial">{t('admin.statusTrial')}</option>
                    <option value="expired">{t('admin.statusExpired')}</option>
                    <option value="no_trial">{t('admin.statusNoTrial')}</option>
                  </select>
                </label>
              </div>

              {loading ? (
                <p className="py-8 text-center text-sm text-on-surface-variant">{t('common.loading')}</p>
              ) : filtered.length === 0 ? (
                <p className="rounded-xl border border-dashed border-outline-variant p-lg text-center text-sm text-on-surface-variant">
                  {t('admin.empty')}
                </p>
              ) : (
                <div className="space-y-sm">
                  {filtered.map((tenant) => {
                    const open = expandedId === tenant.id
                    const subStatus = effectiveSubStatus(tenant)
                    return (
                      <article
                        key={tenant.id}
                        className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-md">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-sm">
                              <h3 className="truncate text-base font-bold text-on-surface">{tenant.name}</h3>
                              {statusBadge(tenant)}
                              {tenant.is_suspended ? (
                                <span className="cf-admin-badge cf-admin-badge--expired">{t('admin.suspend')}</span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-on-surface-variant">
                              {[
                                tenant.phone,
                                tenant.specialty
                                  ? t(`specialty.${getSpecialtyPack(tenant.specialty).id}`)
                                  : null,
                                tenant.created_at
                                  ? format(new Date(tenant.created_at), 'd MMM yyyy', { locale })
                                  : null,
                                subStatus !== 'unknown' ? subStatusLabel(subStatus) : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-sm text-[11px] font-semibold text-on-surface-variant">
                              <span className="rounded-md bg-surface-container px-2 py-0.5">
                                {t('admin.users')}: {tenant.users_count}
                              </span>
                              <span className="rounded-md bg-surface-container px-2 py-0.5">
                                {t('admin.patients')}: {tenant.patients_count}
                              </span>
                              <span className="rounded-md bg-surface-container px-2 py-0.5">
                                {t('admin.appts7')}: {tenant.appointments_7d}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-sm">
                            <select
                              className="cf-input !w-auto py-1.5 text-xs"
                              disabled={busy}
                              value={tenant.subscription_plan}
                              onChange={(e) =>
                                void updateTenant(tenant.id, {
                                  subscription_plan: e.target.value as Tenant['subscription_plan'],
                                })
                              }
                            >
                              <option value="starter">Starter</option>
                              <option value="professional">Professional</option>
                              <option value="enterprise">Enterprise</option>
                            </select>
                            <select
                              className="cf-input !w-auto py-1.5 text-xs"
                              disabled={busy}
                              value={tenant.subscription_status ?? (subStatus === 'unknown' ? 'trial' : subStatus)}
                              onChange={(e) =>
                                void updateSubscriptionStatus(tenant.id, e.target.value as SubStatus)
                              }
                              title={t('admin.subscriptionStatus')}
                            >
                              <option value="trial">{t('admin.statusTrial')}</option>
                              <option value="active">{t('admin.statusActive')}</option>
                              <option value="past_due">{t('admin.statusPastDue')}</option>
                              <option value="cancelled">{t('admin.statusCancelled')}</option>
                            </select>
                            <button
                              type="button"
                              className="cf-btn cf-btn-primary py-sm text-xs"
                              disabled={busy}
                              onClick={() => extendTrial(tenant, extendDays)}
                            >
                              {t('admin.extendTrial')} +{extendDays}
                            </button>
                            <button
                              type="button"
                              className="cf-btn cf-btn-ghost py-sm text-xs"
                              disabled={busy}
                              onClick={() => endTrialNow(tenant)}
                            >
                              {t('admin.endTrial')}
                            </button>
                            {tenant.is_suspended ? (
                              <button
                                type="button"
                                className="cf-btn cf-btn-secondary py-sm text-xs"
                                disabled={busy}
                                onClick={() => void unsuspendTenant(tenant)}
                              >
                                {t('admin.unsuspend')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="cf-btn cf-btn-ghost py-sm text-xs"
                                disabled={busy}
                                onClick={() => {
                                  setSuspendTarget(tenant)
                                  setSuspendMessage(tenant.suspend_message ?? '')
                                }}
                              >
                                {t('admin.suspend')}
                              </button>
                            )}
                            <button
                              type="button"
                              className="cf-btn cf-btn-secondary py-sm text-xs"
                              disabled={busy}
                              onClick={() => void impersonateClinic(tenant)}
                            >
                              {t('admin.impersonate')}
                            </button>
                            <button
                              type="button"
                              className="cf-btn cf-btn-ghost py-sm text-xs"
                              onClick={() => setExpandedId(open ? null : tenant.id)}
                            >
                              <Icon name={open ? 'expand_less' : 'expand_more'} className="text-base" />
                              {t('admin.details')}
                            </button>
                          </div>
                        </div>

                        {open ? (
                          <div className="mt-md grid gap-md border-t border-outline-variant pt-md sm:grid-cols-2">
                            <div>
                              <h4 className="mb-sm text-xs font-bold text-primary">{t('admin.team')}</h4>
                              {tenant.staff.length === 0 ? (
                                <p className="text-xs text-on-surface-variant">{t('admin.noStaff')}</p>
                              ) : (
                                <ul className="space-y-1.5">
                                  {tenant.staff.map((s) => (
                                    <li
                                      key={s.id}
                                      className="rounded-lg bg-surface-container-low px-sm py-1.5 text-xs"
                                    >
                                      <span className="font-bold">{s.full_name}</span>
                                      <span className="text-on-surface-variant"> · {s.role}</span>
                                      <div className="text-on-surface-variant">{s.email}</div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div className="space-y-sm text-xs">
                              <div>
                                <span className="font-bold text-on-surface-variant">{t('admin.trialEnds')}: </span>
                                {tenant.trial_ends_at
                                  ? format(new Date(tenant.trial_ends_at), 'yyyy-MM-dd HH:mm')
                                  : '—'}
                              </div>
                              <div>
                                <span className="font-bold text-on-surface-variant">{t('onboarding.address')}: </span>
                                {tenant.address ?? '—'}
                              </div>
                              {tenant.is_suspended && tenant.suspend_message ? (
                                <div className="rounded-lg bg-error-container/30 px-sm py-xs text-on-error-container">
                                  {tenant.suspend_message}
                                </div>
                              ) : null}
                              <label className="block">
                                <span className="cf-label">{t('admin.setTrialDate')}</span>
                                <input
                                  type="date"
                                  className="cf-input text-sm"
                                  defaultValue={
                                    tenant.trial_ends_at
                                      ? format(new Date(tenant.trial_ends_at), 'yyyy-MM-dd')
                                      : ''
                                  }
                                  onChange={(e) => {
                                    if (!e.target.value) return
                                    const d = new Date(`${e.target.value}T23:59:59`)
                                    const past = d.getTime() < Date.now()
                                    void updateTenant(tenant.id, {
                                      trial_ends_at: d.toISOString(),
                                      subscription_status: past ? 'past_due' : 'trial',
                                    })
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="cf-card space-y-md p-lg">
              <h2 className="flex items-center gap-2 font-semibold text-primary">
                <Icon name="history" />
                {t('admin.recentActivity')}
              </h2>
              {audit.length === 0 ? (
                <p className="text-sm text-on-surface-variant">{t('admin.noActivity')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-on-surface-variant">
                        <th className="px-2 py-2 text-start font-semibold">{t('admin.when')}</th>
                        <th className="px-2 py-2 text-start font-semibold">{t('admin.clinic')}</th>
                        <th className="px-2 py-2 text-start font-semibold">{t('admin.action')}</th>
                        <th className="px-2 py-2 text-start font-semibold">{t('admin.entity')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.map((row) => (
                        <tr key={row.id} className="border-t border-outline-variant/70">
                          <td className="whitespace-nowrap px-2 py-2">
                            {format(new Date(row.created_at), 'd MMM HH:mm', { locale })}
                          </td>
                          <td className="px-2 py-2">
                            {tenantNameById.get(row.tenant_id) ?? row.tenant_id.slice(0, 8)}
                          </td>
                          <td className="px-2 py-2 font-semibold">{row.action}</td>
                          <td className="px-2 py-2">{row.entity_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}

        {tab === 'billing' ? (
          <>
            <form onSubmit={createInvoice} className="cf-card space-y-md p-lg">
              <h2 className="flex items-center gap-2 font-semibold text-primary">
                <Icon name="add_card" />
                {t('admin.createInvoice')}
              </h2>
              <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
                <label className="block text-sm sm:col-span-2 lg:col-span-1">
                  <span className="cf-label">{t('admin.clinic')}</span>
                  <select
                    className="cf-input"
                    value={billTenantId}
                    onChange={(e) => setBillTenantId(e.target.value)}
                    required
                  >
                    <option value="">—</option>
                    {tenants.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="cf-label">{t('admin.plan')}</span>
                  <select
                    className="cf-input"
                    value={billPlan}
                    onChange={(e) => setBillPlan(e.target.value as Tenant['subscription_plan'])}
                  >
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="cf-label">{t('admin.amount')} (EGP)</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="cf-input"
                    value={billAmount}
                    onChange={(e) => setBillAmount(Number(e.target.value))}
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="cf-label">{t('admin.periodStart')}</span>
                  <input
                    type="date"
                    className="cf-input"
                    value={billPeriodStart}
                    onChange={(e) => setBillPeriodStart(e.target.value)}
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="cf-label">{t('admin.periodEnd')}</span>
                  <input
                    type="date"
                    className="cf-input"
                    value={billPeriodEnd}
                    onChange={(e) => setBillPeriodEnd(e.target.value)}
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="cf-label">{t('admin.provider')}</span>
                  <select
                    className="cf-input"
                    value={billProvider}
                    onChange={(e) => setBillProvider(e.target.value as PaymentProviderId)}
                  >
                    <option value="manual">Manual</option>
                    <option value="paymob">Paymob</option>
                    <option value="fawry">Fawry</option>
                  </select>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="cf-label">{t('visits.notes')}</span>
                  <input
                    className="cf-input"
                    value={billNotes}
                    onChange={(e) => setBillNotes(e.target.value)}
                  />
                </label>
              </div>
              <button type="submit" disabled={busy || !billTenantId} className="cf-btn cf-btn-primary">
                {t('admin.createInvoice')}
              </button>
            </form>

            <section className="cf-card space-y-md p-lg">
              <h2 className="flex items-center gap-2 font-semibold text-primary">
                <Icon name="receipt_long" />
                {t('admin.tabBilling')}
              </h2>
              {loading ? (
                <p className="py-8 text-center text-sm text-on-surface-variant">{t('common.loading')}</p>
              ) : invoices.length === 0 ? (
                <p className="text-sm text-on-surface-variant">{t('admin.billingEmpty')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-on-surface-variant">
                        <th className="px-2 py-2 text-start font-semibold">{t('admin.clinic')}</th>
                        <th className="px-2 py-2 text-start font-semibold">{t('admin.plan')}</th>
                        <th className="px-2 py-2 text-start font-semibold">{t('admin.amount')}</th>
                        <th className="px-2 py-2 text-start font-semibold">{t('admin.provider')}</th>
                        <th className="px-2 py-2 text-start font-semibold">{t('admin.when')}</th>
                        <th className="px-2 py-2 text-start font-semibold">{t('admin.action')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="border-t border-outline-variant/70">
                          <td className="px-2 py-2">{tenantNameById.get(inv.tenant_id) ?? inv.tenant_id.slice(0, 8)}</td>
                          <td className="px-2 py-2 capitalize">{inv.plan}</td>
                          <td className="px-2 py-2 font-semibold">
                            {Number(inv.amount_egp).toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-EG')} EGP
                          </td>
                          <td className="px-2 py-2">
                            <span className="cf-admin-badge cf-admin-badge--none">{inv.status}</span>
                            <div className="mt-0.5 text-on-surface-variant">{inv.payment_provider}</div>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">
                            {format(new Date(inv.created_at), 'd MMM yyyy', { locale })}
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-1">
                              {inv.status !== 'paid' ? (
                                <button
                                  type="button"
                                  className="cf-btn cf-btn-primary py-0.5 text-[10px]"
                                  disabled={busy}
                                  onClick={() => void updateInvoiceStatus(inv, 'paid')}
                                >
                                  {t('admin.markPaid')}
                                </button>
                              ) : null}
                              {inv.status !== 'failed' ? (
                                <button
                                  type="button"
                                  className="cf-btn cf-btn-ghost py-0.5 text-[10px]"
                                  disabled={busy}
                                  onClick={() => void updateInvoiceStatus(inv, 'failed')}
                                >
                                  {t('admin.markFailed')}
                                </button>
                              ) : null}
                              {inv.status !== 'cancelled' ? (
                                <button
                                  type="button"
                                  className="cf-btn cf-btn-ghost py-0.5 text-[10px]"
                                  disabled={busy}
                                  onClick={() => void updateInvoiceStatus(inv, 'cancelled')}
                                >
                                  {t('admin.markCancelled')}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}

        {tab === 'alerts' ? (
          <section className="cf-card space-y-md p-lg">
            <h2 className="flex items-center gap-2 font-semibold text-primary">
              <Icon name="notifications_active" />
              {t('admin.alertsTitle')}
            </h2>
            {loading ? (
              <p className="py-8 text-center text-sm text-on-surface-variant">{t('common.loading')}</p>
            ) : alertClinics.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{t('admin.alertsEmpty')}</p>
            ) : (
              <div className="space-y-sm">
                {alertClinics.map((tenant) => {
                  const left = daysLeft(tenant.trial_ends_at)
                  const wa = whatsAppUrl(tenant.phone)
                  return (
                    <article
                      key={tenant.id}
                      className="flex flex-wrap items-center justify-between gap-md rounded-xl border border-outline-variant bg-surface-container-lowest p-md"
                    >
                      <div className="min-w-0">
                        <h3 className="font-bold text-on-surface">{tenant.name}</h3>
                        <p className="text-xs text-on-surface-variant">
                          {tenant.phone ?? '—'} · {t('admin.daysLeft')}: {left ?? '—'}
                        </p>
                        {tenant.trial_alert_sent_at ? (
                          <p className="mt-1 text-[11px] font-semibold text-secondary">
                            {t('admin.alertSent')}{' '}
                            {format(new Date(tenant.trial_alert_sent_at), 'd MMM HH:mm', { locale })}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-sm">
                        {wa ? (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cf-btn cf-btn-secondary py-sm text-xs"
                          >
                            <Icon name="chat" className="text-base" />
                            WhatsApp
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="cf-btn cf-btn-primary py-sm text-xs"
                          disabled={busy}
                          onClick={() => void markAlertSent(tenant)}
                        >
                          {t('admin.markAlertSent')}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        ) : null}

        {tab === 'growth' ? (
          <>
            <section className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="cf-admin-kpi">
                <div className="cf-admin-kpi-label">{t('admin.growthNew7')}</div>
                <div className="cf-admin-kpi-value">{growth.new7}</div>
              </div>
              <div className="cf-admin-kpi">
                <div className="cf-admin-kpi-label">{t('admin.growthNew30')}</div>
                <div className="cf-admin-kpi-value">{growth.new30}</div>
              </div>
              <div className="cf-admin-kpi cf-admin-kpi--trial">
                <div className="cf-admin-kpi-label">{t('admin.growthTrial')}</div>
                <div className="cf-admin-kpi-value">{growth.onTrial}</div>
              </div>
              <div className="cf-admin-kpi">
                <div className="cf-admin-kpi-label">{t('admin.growthActive')}</div>
                <div className="cf-admin-kpi-value">{growth.active}</div>
              </div>
              <div className="cf-admin-kpi cf-admin-kpi--warn">
                <div className="cf-admin-kpi-label">{t('admin.growthConversion')}</div>
                <div className="cf-admin-kpi-value">{growth.conversionPct}%</div>
              </div>
              <div className="cf-admin-kpi">
                <div className="cf-admin-kpi-label">{t('admin.growthRevenue')}</div>
                <div className="cf-admin-kpi-value text-base">
                  {growth.revenue.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-EG')}
                </div>
              </div>
            </section>

            <section className="cf-card space-y-md p-lg">
              <h2 className="flex items-center gap-2 font-semibold text-primary">
                <Icon name="trending_up" />
                {t('admin.growthTitle')}
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-on-surface-variant">
                      <th className="px-2 py-2 text-start font-semibold">{t('admin.growthWeek')}</th>
                      <th className="px-2 py-2 text-start font-semibold">{t('admin.growthNewClinics')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {growth.weekBuckets.map((bucket) => (
                      <tr key={bucket.label} className="border-t border-outline-variant/70">
                        <td className="px-2 py-2">{bucket.label}</td>
                        <td className="px-2 py-2 font-bold text-primary">{bucket.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </main>

      {suspendTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-md">
          <div className="cf-card w-full max-w-md space-y-md p-lg shadow-xl">
            <h3 className="font-bold text-primary">{t('admin.confirmSuspend')}</h3>
            <p className="text-sm text-on-surface-variant">{suspendTarget.name}</p>
            <label className="block text-sm">
              <span className="cf-label">{t('admin.suspendMessage')}</span>
              <textarea
                className="cf-input min-h-[88px]"
                value={suspendMessage}
                onChange={(e) => setSuspendMessage(e.target.value)}
                placeholder={t('admin.suspendMessagePh')}
              />
            </label>
            <div className="flex flex-wrap justify-end gap-sm">
              <button
                type="button"
                className="cf-btn cf-btn-ghost"
                onClick={() => {
                  setSuspendTarget(null)
                  setSuspendMessage('')
                }}
              >
                {t('common.cancel')}
              </button>
              <button type="button" className="cf-btn cf-btn-primary" disabled={busy} onClick={() => void confirmSuspend()}>
                {t('admin.suspend')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
