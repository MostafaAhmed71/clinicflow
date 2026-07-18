import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type StaffUser = {
  id: string
  full_name: string
  email: string
  role: string
}

export function StaffInvitesPanel() {
  const { t } = useTranslation()
  const { tenant, user, refreshProfile } = useAuth()
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'secretary' as 'secretary' | 'doctor',
  })

  const canManage = user?.role === 'doctor' || user?.role === 'clinic_manager'

  async function load() {
    if (!tenant) return
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email, role')
      .eq('tenant_id', tenant.id)
      .order('full_name')
    setStaff((users as StaffUser[]) ?? [])
  }

  useEffect(() => {
    if (canManage) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id, canManage])

  if (!canManage) return null

  async function createStaff(e: FormEvent) {
    e.preventDefault()
    if (!tenant) return
    setBusy(true)
    setError(null)
    setMessage(null)

    const {
      data: { session: doctorSession },
    } = await supabase.auth.getSession()

    if (!doctorSession) {
      setError(t('common.error'))
      setBusy(false)
      return
    }

    const accessToken = doctorSession.access_token
    const refreshToken = doctorSession.refresh_token

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { full_name: form.full_name.trim() },
      },
    })

    if (signUpError || !signUpData.user) {
      setError(signUpError?.message ?? t('common.error'))
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      setBusy(false)
      return
    }

    const newUserId = signUpData.user.id

    const { error: restoreError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })

    if (restoreError) {
      setError(restoreError.message)
      setBusy(false)
      return
    }

    const { error: linkError } = await supabase.rpc('link_staff_user', {
      p_user_id: newUserId,
      p_full_name: form.full_name.trim(),
      p_email: form.email.trim(),
      p_role: form.role,
    })

    if (linkError) {
      setError(linkError.message)
      setBusy(false)
      return
    }

    setMessage(t('secretary.staffCreated'))
    setForm({ full_name: '', email: '', password: '', role: 'secretary' })
    await refreshProfile()
    await load()
    setBusy(false)
  }

  return (
    <section className="space-y-3 cf-card p-6">
      <h2 className="text-lg font-medium">{t('secretary.staffTitle')}</h2>
      <p className="text-sm text-on-surface-variant">{t('secretary.staffHint')}</p>

      <form onSubmit={createStaff} className="grid gap-2 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-on-surface-variant">{t('secretary.staffName')}</span>
          <input
            required
            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-on-surface-variant">{t('auth.email')}</span>
          <input
            required
            type="email"
            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-on-surface-variant">{t('auth.password')}</span>
          <input
            required
            type="password"
            minLength={6}
            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-on-surface-variant">{t('secretary.role')}</span>
          <select
            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
            value={form.role}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                role: e.target.value as 'secretary' | 'doctor',
              }))
            }
          >
            <option value="secretary">{t('secretary.roleSecretary')}</option>
            <option value="doctor">{t('secretary.roleDoctor')}</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="cf-btn cf-btn-primary text-sm sm:col-span-2"
        >
          {busy ? t('common.loading') : t('secretary.createStaff')}
        </button>
      </form>

      {error && <p className="text-sm text-error">{error}</p>}
      {message && <p className="text-sm text-primary">{message}</p>}

      <div>
        <h3 className="mb-2 text-sm font-medium">{t('secretary.team')}</h3>
        <ul className="space-y-1 text-sm">
          {staff.map((s) => (
            <li key={s.id} className="flex justify-between border-b border-outline-variant py-1">
              <span>
                {s.full_name} <span className="text-on-surface-variant">({s.role})</span>
              </span>
              <span className="text-on-surface-variant">{s.email}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
