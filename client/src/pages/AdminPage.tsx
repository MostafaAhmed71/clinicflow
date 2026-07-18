import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Tenant } from '../types/database'

type TenantRow = Tenant & { users_count?: number }

export function AdminPage() {
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [trialDays, setTrialDays] = useState(14)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setError(null)
    const [{ data: tenantRows, error: tErr }, { data: settings }] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('platform_settings').select('default_trial_days').eq('id', 1).maybeSingle(),
    ])
    if (tErr) {
      setError(tErr.message)
      return
    }
    setTenants((tenantRows as TenantRow[]) ?? [])
    if (settings?.default_trial_days) setTrialDays(settings.default_trial_days)
  }

  useEffect(() => {
    if (user?.role === 'super_admin') void load()
  }, [user?.role])

  if (authLoading) {
    return <p className="p-6 text-on-surface-variant">{t('common.loading')}</p>
  }

  if (!user || user.role !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  async function saveTrialDays(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    setError(null)
    const payload = {
      id: 1,
      default_trial_days: trialDays,
      updated_at: new Date().toISOString(),
    }
    // Prefer update (row id=1 is seeded); fall back to upsert if missing
    const { data: updated, error: updErr } = await supabase
      .from('platform_settings')
      .update({ default_trial_days: trialDays, updated_at: payload.updated_at })
      .eq('id', 1)
      .select('id')
    if (updErr) {
      setError(updErr.message)
      setBusy(false)
      return
    }
    if (!updated?.length) {
      const { error: insErr } = await supabase.from('platform_settings').insert(payload)
      if (insErr) {
        setError(insErr.message)
        setBusy(false)
        return
      }
    }
    setMessage(t('settings.saved'))
    setBusy(false)
  }

  async function updateTenant(
    id: string,
    patch: Partial<Pick<Tenant, 'subscription_plan' | 'trial_ends_at'>>,
  ) {
    setBusy(true)
    const { error: err } = await supabase.from('tenants').update(patch).eq('id', id)
    if (err) setError(err.message)
    else await load()
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('admin.title')}</h1>
          <p className="text-sm text-on-surface-variant">{t('admin.subtitle')}</p>
        </div>
        <Link to="/" className="text-sm text-primary underline">
          {t('nav.dashboard')}
        </Link>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}
      {message && <p className="text-sm text-primary">{message}</p>}

      <form
        onSubmit={saveTrialDays}
        className="cf-card flex flex-wrap items-end gap-3 p-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-on-surface-variant">{t('admin.defaultTrialDays')}</span>
          <input
            type="number"
            min={7}
            max={14}
            className="w-32 rounded-lg border border-outline-variant px-3 py-2"
            value={trialDays}
            onChange={(e) => setTrialDays(Number(e.target.value))}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="cf-btn cf-btn-primary"
        >
          {t('patients.save')}
        </button>
      </form>

      <div className="cf-card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-primary-fixed text-primary">
            <tr>
              <th className="px-3 py-2 text-start">{t('onboarding.clinicName')}</th>
              <th className="px-3 py-2 text-start">{t('admin.plan')}</th>
              <th className="px-3 py-2 text-start">{t('admin.trialEnds')}</th>
              <th className="px-3 py-2 text-start">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-on-surface-variant">
                  {t('admin.empty')}
                </td>
              </tr>
            ) : (
              tenants.map((tenant) => (
                <tr key={tenant.id} className="border-t border-outline-variant">
                  <td className="px-3 py-2">
                    <div className="font-medium">{tenant.name}</div>
                    <div className="text-xs text-on-surface-variant">{tenant.phone ?? '—'}</div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded-lg border border-outline-variant px-2 py-1"
                      value={tenant.subscription_plan}
                      onChange={(e) =>
                        void updateTenant(tenant.id, {
                          subscription_plan: e.target.value as Tenant['subscription_plan'],
                        })
                      }
                    >
                      <option value="starter">starter</option>
                      <option value="professional">professional</option>
                      <option value="enterprise">enterprise</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    {tenant.trial_ends_at
                      ? format(new Date(tenant.trial_ends_at), 'yyyy-MM-dd')
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => {
                        const days = trialDays
                        const ends = new Date()
                        ends.setDate(ends.getDate() + days)
                        void updateTenant(tenant.id, { trial_ends_at: ends.toISOString() })
                      }}
                    >
                      {t('admin.extendTrial')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
