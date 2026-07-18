import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ar, enUS } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Icon } from '../components/Icon'
import { Toast } from '../components/Toast'

type Entry = {
  id: string
  type: 'revenue' | 'expense' | 'refund'
  amount: number
  description: string | null
  created_at: string
}

function formatMoney(amount: number, currency: string) {
  return `${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`
}

export function CashRegisterPage() {
  const { t, i18n } = useTranslation()
  const { tenant } = useAuth()
  const locale = i18n.language === 'ar' ? ar : enUS
  const currency = t('secretary.currency')
  const [entries, setEntries] = useState<Entry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<'all' | Entry['type']>('all')
  const [form, setForm] = useState({
    type: 'expense' as Entry['type'],
    amount: '',
    description: '',
  })

  async function load() {
    if (!tenant) return
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const { data, error: err } = await supabase
      .from('cash_register_entries')
      .select('*')
      .eq('tenant_id', tenant.id)
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    setEntries((data as Entry[]) ?? [])
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id])

  const stats = useMemo(() => {
    let revenue = 0
    let expense = 0
    let refund = 0
    for (const e of entries) {
      const amount = Number(e.amount)
      if (e.type === 'revenue') revenue += amount
      else if (e.type === 'refund') refund += amount
      else expense += amount
    }
    return { revenue, expense, refund, balance: revenue - expense - refund }
  }, [entries])

  const visible = useMemo(() => {
    if (filter === 'all') return entries
    return entries.filter((e) => e.type === filter)
  }, [entries, filter])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!tenant) return
    setBusy(true)
    const { error: err } = await supabase.from('cash_register_entries').insert({
      tenant_id: tenant.id,
      type: form.type,
      amount: Number(form.amount) || 0,
      description: form.description || null,
    })
    setBusy(false)
    if (err) setError(err.message)
    else {
      setForm({ type: 'expense', amount: '', description: '' })
      setToast(t('billing.entrySaved'))
      await load()
    }
  }

  const typeMeta: Record<
    Entry['type'],
    { icon: string; badge: string; rail: string }
  > = {
    revenue: { icon: 'trending_up', badge: 'cf-badge cf-badge-status-done', rail: 'cf-cash-rail-revenue' },
    expense: { icon: 'trending_down', badge: 'cf-badge cf-badge-danger', rail: 'cf-cash-rail-expense' },
    refund: { icon: 'undo', badge: 'cf-badge cf-badge-warning', rail: 'cf-cash-rail-refund' },
  }

  return (
    <div className="cf-page-enter space-y-lg">
      <Toast message={toast} tone="success" onDismiss={() => setToast(null)} />

      <div className="cf-history-hero">
        <div className="min-w-0">
          <div className="flex items-center gap-sm">
            <span className="cf-history-card-icon bg-primary-fixed text-primary">
              <Icon name="point_of_sale" />
            </span>
            <div>
              <h1 className="font-headline-md text-headline-md font-bold text-on-surface">
                {t('billing.cash')}
              </h1>
              <p className="mt-0.5 text-sm text-on-surface-variant">{t('billing.cashHint')}</p>
            </div>
          </div>
        </div>
        <Link to="/invoices" className="cf-btn cf-btn-secondary">
          <Icon name="receipt_long" />
          {t('billing.invoices')}
        </Link>
      </div>

      <div className="grid gap-md sm:grid-cols-2 xl:grid-cols-4">
        <div className="cf-finance-stat cf-finance-stat-primary">
          <span className="cf-stat-label">{t('billing.revenue')}</span>
          <div className="cf-stat-value text-[1.25rem]">{formatMoney(stats.revenue, currency)}</div>
        </div>
        <div className="cf-finance-stat cf-finance-stat-danger">
          <span className="cf-stat-label">{t('billing.expense')}</span>
          <div className="cf-stat-value text-[1.25rem]">{formatMoney(stats.expense, currency)}</div>
        </div>
        <div className="cf-finance-stat cf-finance-stat-warning">
          <span className="cf-stat-label">{t('billing.refund')}</span>
          <div className="cf-stat-value text-[1.25rem]">{formatMoney(stats.refund, currency)}</div>
        </div>
        <div className="cf-finance-stat cf-finance-stat-secondary">
          <span className="cf-stat-label">{t('billing.dailyBalance')}</span>
          <div className="cf-stat-value text-[1.25rem]">{formatMoney(stats.balance, currency)}</div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-error-container bg-error-container px-md py-sm text-sm text-on-error-container">
          {error}
        </p>
      )}

      <form onSubmit={onSubmit} className="cf-history-card cf-history-card-muted overflow-visible">
        <div className="cf-history-card-head">
          <span className="cf-history-card-icon">
            <Icon name="add_circle" />
          </span>
          <div>
            <p className="font-semibold text-on-surface">{t('billing.addEntry')}</p>
            <p className="text-xs text-on-surface-variant">{t('billing.addEntryHint')}</p>
          </div>
        </div>
        <div className="cf-history-card-body space-y-md">
          <div className="flex flex-wrap gap-sm">
            {(['expense', 'revenue', 'refund'] as Entry['type'][]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type }))}
                className={`cf-btn py-sm text-sm ${
                  form.type === type ? 'cf-btn-primary !text-white' : 'cf-btn-ghost'
                }`}
              >
                <Icon name={typeMeta[type].icon} />
                {t(`billing.${type}`)}
              </button>
            ))}
          </div>
          <div className="grid gap-sm sm:grid-cols-[10rem_1fr_auto]">
            <label className="cf-vital-field">
              <span className="cf-vital-field-head">{t('billing.amount')}</span>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                className="cf-input !mt-0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </label>
            <label className="cf-vital-field">
              <span className="cf-vital-field-head">{t('visits.notes')}</span>
              <input
                className="cf-input !mt-0"
                placeholder={t('billing.descriptionPh')}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <button type="submit" disabled={busy} className="cf-btn cf-btn-primary self-end !text-white">
              <Icon name={busy ? 'progress_activity' : 'save'} className={busy ? 'animate-spin' : ''} />
              {t('patients.save')}
            </button>
          </div>
        </div>
      </form>

      <div className="cf-card overflow-hidden">
        <div className="cf-wait-tabs-wrap border-b border-outline-variant/60 bg-surface-container-low/40 px-md py-md">
          <div className="cf-wait-tabs" role="tablist">
            {(['all', 'revenue', 'expense', 'refund'] as const).map((f) => {
              const count =
                f === 'all' ? entries.length : entries.filter((e) => e.type === f).length
              const active = filter === f
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f)}
                  className={`cf-wait-tab ${
                    f === 'all'
                      ? 'cf-wait-tab-all'
                      : f === 'revenue'
                        ? 'cf-wait-tab-done'
                        : f === 'expense'
                          ? 'cf-wait-tab-unpaid'
                          : 'cf-wait-tab-waiting'
                  }${active ? ' is-active' : ''}`}
                >
                  <span className="cf-wait-tab-dot" aria-hidden />
                  <span className="cf-wait-tab-label">
                    {f === 'all' ? t('waiting.all') : t(`billing.${f}`)}
                  </span>
                  <span className="cf-wait-tab-count">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-sm p-md">
          {visible.length === 0 ? (
            <div className="py-xl text-center text-on-surface-variant">
              <Icon name="point_of_sale" className="mb-sm text-4xl text-outline" />
              <p className="font-semibold text-on-surface">{t('billing.emptyEntries')}</p>
              <p className="mt-xs text-sm">{t('billing.emptyEntriesHint')}</p>
            </div>
          ) : (
            visible.map((e) => {
              const meta = typeMeta[e.type]
              return (
                <article key={e.id} className={`cf-cash-row ${meta.rail}`}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest">
                    <Icon name={meta.icon} className="text-xl" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-sm">
                      <span className={meta.badge}>{t(`billing.${e.type}`)}</span>
                      <span className="text-xs text-on-surface-variant">
                        {format(new Date(e.created_at), 'HH:mm', { locale })}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-on-surface-variant">
                      {e.description?.trim() || '—'}
                    </p>
                  </div>
                  <div
                    className={`text-base font-extrabold ${
                      e.type === 'revenue'
                        ? 'text-on-secondary-container'
                        : e.type === 'expense'
                          ? 'text-error'
                          : 'text-orange-700'
                    }`}
                  >
                    {e.type === 'revenue' ? '+' : '−'}
                    {formatMoney(Number(e.amount), currency)}
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
