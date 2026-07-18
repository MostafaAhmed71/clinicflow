import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ar, enUS } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { printInvoice } from '../lib/print'
import { billingProvider } from '../lib/billing/provider'
import { Icon } from '../components/Icon'
import { Toast } from '../components/Toast'
import type { Patient } from '../types/database'

type ServiceLine = { name: string; amount: number }

type Invoice = {
  id: string
  tenant_id: string
  patient_id: string
  visit_id: string | null
  consultation_fee: number
  discounts: number
  services: ServiceLine[]
  total: number
  payment_method: string | null
  paid_at: string | null
  created_at: string
  patients?: { full_name: string; file_number: number } | null
}

function formatMoney(amount: number, currency: string) {
  return `${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`
}

export function InvoicesPage() {
  const { t, i18n } = useTranslation()
  const { tenant, user } = useAuth()
  const locale = i18n.language === 'ar' ? ar : enUS
  const currency = t('secretary.currency')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    patient_id: '',
    consultation_fee: String(tenant?.consultation_fee ?? 0),
    discounts: '0',
    payment_method: 'cash',
    serviceName: '',
    serviceAmount: '',
  })
  const [services, setServices] = useState<ServiceLine[]>([])

  const total = useMemo(() => {
    const fee = Number(form.consultation_fee) || 0
    const disc = Number(form.discounts) || 0
    const extra = services.reduce((s, x) => s + x.amount, 0)
    return Math.max(0, fee + extra - disc)
  }, [form.consultation_fee, form.discounts, services])

  const summary = useMemo(() => {
    const paid = invoices.reduce((s, i) => s + Number(i.total ?? 0), 0)
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const todayTotal = invoices
      .filter((i) => format(new Date(i.created_at), 'yyyy-MM-dd') === todayStr)
      .reduce((s, i) => s + Number(i.total ?? 0), 0)
    return { count: invoices.length, total: paid, todayTotal }
  }, [invoices])

  async function load() {
    if (!tenant) return
    const [{ data: inv, error: e1 }, { data: pats }] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, patients(full_name, file_number)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('patients')
        .select('id, full_name, file_number')
        .eq('tenant_id', tenant.id)
        .order('full_name')
        .limit(200),
    ])
    if (e1) setError(e1.message)
    setInvoices((inv as unknown as Invoice[]) ?? [])
    setPatients((pats as Patient[]) ?? [])
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id])

  useEffect(() => {
    if (tenant?.consultation_fee != null) {
      setForm((f) => ({ ...f, consultation_fee: String(tenant.consultation_fee) }))
    }
  }, [tenant?.consultation_fee])

  async function createInvoice(e: FormEvent) {
    e.preventDefault()
    if (!tenant || !form.patient_id) return
    setBusy(true)
    setError(null)

    const payment = await billingProvider.createPaymentIntent({
      tenantId: tenant.id,
      amount: total,
      description: 'visit invoice',
    })

    const { data, error: err } = await supabase
      .from('invoices')
      .insert({
        tenant_id: tenant.id,
        patient_id: form.patient_id,
        consultation_fee: Number(form.consultation_fee) || 0,
        discounts: Number(form.discounts) || 0,
        services,
        total,
        payment_method: `${form.payment_method} (${payment.reference})`,
        paid_at: new Date().toISOString(),
      })
      .select('*, patients(full_name, file_number)')
      .single()

    if (err) {
      setError(err.message)
      setBusy(false)
      return
    }

    const row = data as unknown as Invoice
    await supabase.from('cash_register_entries').insert({
      tenant_id: tenant.id,
      type: 'revenue',
      amount: total,
      description: `Invoice ${row.id.slice(0, 8)} — ${row.patients?.full_name ?? ''}`,
    })

    setShowForm(false)
    setServices([])
    setForm((f) => ({
      ...f,
      patient_id: '',
      discounts: '0',
      serviceName: '',
      serviceAmount: '',
    }))
    setBusy(false)
    setToast(t('billing.invoiceSaved'))
    await load()
  }

  function onPrint(inv: Invoice) {
    printInvoice({
      clinicName: tenant?.name ?? 'ClinicFlow',
      logoUrl: tenant?.logo_url,
      clinicPhone: tenant?.phone,
      clinicAddress: tenant?.address,
      patientName: inv.patients?.full_name ?? inv.patient_id,
      fileNumber: inv.patients?.file_number ?? 0,
      consultationFee: Number(inv.consultation_fee),
      discounts: Number(inv.discounts),
      services: Array.isArray(inv.services) ? inv.services : [],
      total: Number(inv.total),
      paymentMethod: inv.payment_method ?? '',
      createdAt: inv.created_at,
      format: tenant?.print_format === 'thermal' ? 'thermal' : 'a4',
      cashier: user?.full_name ?? '',
    })
  }

  return (
    <div className="cf-page-enter space-y-lg">
      <Toast message={toast} tone="success" onDismiss={() => setToast(null)} />

      <div className="cf-history-hero">
        <div className="min-w-0">
          <div className="flex items-center gap-sm">
            <span className="cf-history-card-icon bg-secondary-container text-on-secondary-container">
              <Icon name="payments" />
            </span>
            <div>
              <h1 className="font-headline-md text-headline-md font-bold text-on-surface">
                {t('nav.billing')}
              </h1>
              <p className="mt-0.5 text-sm text-on-surface-variant">{t('billing.subtitle')}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-sm">
          <Link to="/cash" className="cf-btn cf-btn-secondary">
            <Icon name="point_of_sale" />
            {t('billing.cash')}
          </Link>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="cf-btn cf-btn-primary !text-white"
          >
            <Icon name={showForm ? 'close' : 'receipt_long'} />
            {showForm ? t('patients.cancel') : t('billing.newInvoice')}
          </button>
        </div>
      </div>

      <div className="grid gap-md sm:grid-cols-3">
        <div className="cf-finance-stat cf-finance-stat-primary">
          <span className="cf-stat-label">{t('billing.invoices')}</span>
          <div className="cf-stat-value">{summary.count}</div>
        </div>
        <div className="cf-finance-stat cf-finance-stat-today">
          <span className="cf-stat-label">{t('billing.todayTotal')}</span>
          <div className="cf-stat-value text-[1.35rem]">{formatMoney(summary.todayTotal, currency)}</div>
        </div>
        <div className="cf-finance-stat cf-finance-stat-secondary">
          <span className="cf-stat-label">{t('billing.total')}</span>
          <div className="cf-stat-value text-[1.35rem]">{formatMoney(summary.total, currency)}</div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-error-container bg-error-container px-md py-sm text-sm text-on-error-container">
          {error}
        </p>
      )}

      {showForm && (
        <form onSubmit={createInvoice} className="cf-history-card cf-history-card-info overflow-visible">
          <div className="cf-history-card-head">
            <span className="cf-history-card-icon">
              <Icon name="receipt_long" />
            </span>
            <div>
              <p className="font-semibold text-on-surface">{t('billing.newInvoice')}</p>
              <p className="text-xs text-on-surface-variant">{t('billing.newInvoiceHint')}</p>
            </div>
          </div>
          <div className="cf-history-card-body space-y-md">
            <label className="block text-sm">
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

            <div className="grid gap-sm sm:grid-cols-3">
              <label className="cf-vital-field">
                <span className="cf-vital-field-head">
                  <Icon name="stethoscope" className="text-[16px] text-primary" />
                  {t('billing.consultationFee')}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="cf-input !mt-0"
                  value={form.consultation_fee}
                  onChange={(e) => setForm((f) => ({ ...f, consultation_fee: e.target.value }))}
                />
              </label>
              <label className="cf-vital-field">
                <span className="cf-vital-field-head">
                  <Icon name="sell" className="text-[16px] text-primary" />
                  {t('billing.discounts')}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="cf-input !mt-0"
                  value={form.discounts}
                  onChange={(e) => setForm((f) => ({ ...f, discounts: e.target.value }))}
                />
              </label>
              <label className="cf-vital-field">
                <span className="cf-vital-field-head">
                  <Icon name="credit_card" className="text-[16px] text-primary" />
                  {t('billing.paymentMethod')}
                </span>
                <select
                  className="cf-input !mt-0"
                  value={form.payment_method}
                  onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
                >
                  <option value="cash">{t('billing.cashPay')}</option>
                  <option value="card">{t('billing.cardPay')}</option>
                  <option value="transfer">{t('billing.transferPay')}</option>
                  <option value="other">{t('billing.otherPay')}</option>
                </select>
              </label>
            </div>

            <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low/40 p-md">
              <p className="mb-sm text-xs font-bold uppercase tracking-wide text-outline">
                {t('billing.addService')}
              </p>
              <div className="grid gap-sm sm:grid-cols-[1fr_8rem_auto]">
                <input
                  className="cf-input"
                  placeholder={t('billing.serviceName')}
                  value={form.serviceName}
                  onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="cf-input"
                  placeholder={t('billing.serviceAmount')}
                  value={form.serviceAmount}
                  onChange={(e) => setForm((f) => ({ ...f, serviceAmount: e.target.value }))}
                />
                <button
                  type="button"
                  className="cf-btn cf-btn-secondary"
                  onClick={() => {
                    if (!form.serviceName || !form.serviceAmount) return
                    setServices((s) => [
                      ...s,
                      { name: form.serviceName, amount: Number(form.serviceAmount) || 0 },
                    ])
                    setForm((f) => ({ ...f, serviceName: '', serviceAmount: '' }))
                  }}
                >
                  <Icon name="add" />
                  {t('billing.addService')}
                </button>
              </div>
              {services.length > 0 && (
                <ul className="mt-sm space-y-1">
                  {services.map((s, i) => (
                    <li
                      key={`${s.name}-${i}`}
                      className="flex items-center justify-between rounded-lg bg-surface-container-lowest px-sm py-1.5 text-sm"
                    >
                      <span>{s.name}</span>
                      <span className="font-semibold">{formatMoney(s.amount, currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="cf-history-actions !static">
              <p className="text-lg font-bold text-on-surface">
                {t('billing.total')}: {formatMoney(total, currency)}
              </p>
              <button type="submit" disabled={busy} className="cf-btn cf-btn-primary !text-white">
                <Icon name={busy ? 'progress_activity' : 'save'} className={busy ? 'animate-spin' : ''} />
                {busy ? t('common.loading') : t('patients.save')}
              </button>
            </div>
          </div>
        </form>
      )}

      <div>
        <h2 className="mb-sm text-sm font-bold text-on-surface">{t('billing.recentInvoices')}</h2>
        {invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low/40 px-md py-xl text-center">
            <Icon name="receipt_long" className="mb-sm text-4xl text-outline" />
            <p className="font-semibold text-on-surface">{t('billing.emptyInvoices')}</p>
            <p className="mt-xs text-sm text-on-surface-variant">{t('billing.emptyHint')}</p>
            <button
              type="button"
              className="cf-btn cf-btn-primary mt-md inline-flex !text-white"
              onClick={() => setShowForm(true)}
            >
              <Icon name="receipt_long" />
              {t('billing.newInvoice')}
            </button>
          </div>
        ) : (
          <div className="space-y-sm">
            {invoices.map((inv) => (
              <article key={inv.id} className="cf-invoice-card">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container">
                  <Icon name="receipt" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-sm">
                    <h3 className="font-bold text-on-surface">{inv.patients?.full_name ?? '—'}</h3>
                    <span className="cf-badge cf-badge-muted">
                      #{inv.patients?.file_number ?? '—'}
                    </span>
                  </div>
                  <div className="mt-xs flex flex-wrap gap-x-md gap-y-xs text-xs text-on-surface-variant">
                    <span className="inline-flex items-center gap-xs">
                      <Icon name="schedule" className="text-[14px]" />
                      {format(new Date(inv.created_at), 'dd MMM yyyy · HH:mm', { locale })}
                    </span>
                    <span className="inline-flex items-center gap-xs">
                      <Icon name="payments" className="text-[14px]" />
                      {inv.payment_method ?? '—'}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-sm">
                  <div className="text-lg font-extrabold text-primary">
                    {formatMoney(Number(inv.total), currency)}
                  </div>
                  <button
                    type="button"
                    className="cf-btn cf-btn-secondary py-sm text-xs"
                    onClick={() => onPrint(inv)}
                  >
                    <Icon name="print" className="text-base" />
                    {t('billing.print')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
