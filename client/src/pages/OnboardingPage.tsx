import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Icon } from '../components/Icon'

export function OnboardingPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? {}) as { clinicName?: string; fullName?: string }
  const { session, user, loading, refreshProfile } = useAuth()
  const [clinicName, setClinicName] = useState(state.clinicName ?? '')
  const [fullName, setFullName] = useState(state.fullName ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [defaultLanguage, setDefaultLanguage] = useState<'ar' | 'en'>(
    i18n.language === 'en' ? 'en' : 'ar',
  )
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal' | 'both'>('a4')
  const [trialDays, setTrialDays] = useState(14)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void supabase
      .from('platform_settings')
      .select('default_trial_days')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.default_trial_days) setTrialDays(data.default_trial_days)
      })
  }, [])

  if (!loading && user?.role === 'super_admin') return <Navigate to="/admin" replace />
  if (!loading && session && user?.tenant_id) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    try {
      if (!session) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (signUpError) throw signUpError
      }

      const { data, error: rpcError } = await supabase.rpc('onboard_clinic', {
        p_clinic_name: clinicName,
        p_full_name: fullName,
        p_default_language: defaultLanguage,
        p_print_format: printFormat,
        p_phone: phone || null,
        p_address: address || null,
        p_trial_days: trialDays,
      })

      if (rpcError) throw rpcError

      await i18n.changeLanguage(defaultLanguage)
      await refreshProfile()
      void data
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  const steps = [
    { icon: 'medical_services', label: t('onboarding.steps.profile'), active: true },
    { icon: 'palette', label: t('onboarding.steps.branding'), active: false },
    { icon: 'schedule', label: t('onboarding.steps.hours'), active: false },
    { icon: 'print', label: t('onboarding.steps.print'), active: false },
  ]

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-on-surface">
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-50">
        <div className="absolute right-[-10%] top-[-10%] h-96 w-96 rounded-full bg-primary-fixed blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] h-80 w-80 rounded-full bg-secondary-container blur-[90px]" />
      </div>

      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant bg-surface-container-lowest/90 px-lg backdrop-blur">
        <div className="font-headline-md text-headline-md font-bold text-primary">{t('appName')}</div>
        <Link to="/login" className="cf-btn cf-btn-ghost text-sm">
          <Icon name="person" />
          {t('auth.backToLogin')}
        </Link>
      </header>

      <main className="mx-auto mt-16 flex w-full max-w-5xl flex-grow gap-lg px-lg py-xl">
        <aside className="sticky top-24 hidden h-fit w-sidebar-width shrink-0 space-y-sm rounded-xl border border-outline-variant bg-surface-container-low p-md lg:block">
          <div className="mb-md px-sm">
            <div className="font-bold text-primary">Onboarding</div>
            <div className="font-body-md text-body-md text-on-surface-variant">{t('onboarding.setupHint')}</div>
          </div>
          {steps.map((step) => (
            <div
              key={step.label}
              className={`flex items-center gap-md rounded-xl px-md py-sm font-body-md text-body-md ${
                step.active
                  ? 'bg-secondary-container font-bold text-on-secondary-container'
                  : 'text-on-surface-variant'
              }`}
            >
              <Icon name={step.icon} filled={step.active} />
              {step.label}
            </div>
          ))}
        </aside>

        <form
          onSubmit={onSubmit}
          className="flex-grow space-y-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-xl shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 font-label-md text-label-md text-on-surface-variant">
            <span>{t('onboarding.stepOf', { current: 1, total: 4 })}</span>
            <span>25% {t('onboarding.complete')}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
            <div className="h-full w-1/4 rounded-full bg-primary" />
          </div>

          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">{t('onboarding.profileTitle')}</h1>
            <p className="mt-xs font-body-md text-body-md text-on-surface-variant">{t('onboarding.profileHint')}</p>
          </div>

          <Field label={t('onboarding.clinicName')}>
            <input
              className="cf-input"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder={t('onboarding.clinicNamePlaceholder')}
              required
            />
          </Field>
          <Field label={t('onboarding.fullName')}>
            <input className="cf-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </Field>
          {!session && (
            <>
              <Field label={t('auth.email')}>
                <input
                  className="cf-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label={t('auth.password')}>
                <input
                  className="cf-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </Field>
            </>
          )}
          <Field label={t('onboarding.phone')}>
            <input className="cf-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
          </Field>
          <Field label={t('onboarding.address')}>
            <textarea
              className="cf-input min-h-[88px] resize-y"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          <div className="grid gap-md sm:grid-cols-2">
            <Field label={t('onboarding.language')}>
              <select
                className="cf-input"
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value as 'ar' | 'en')}
              >
                <option value="ar">{t('common.arabic')}</option>
                <option value="en">{t('common.english')}</option>
              </select>
            </Field>
            <Field label={t('onboarding.printFormat')}>
              <select
                className="cf-input"
                value={printFormat}
                onChange={(e) => setPrintFormat(e.target.value as 'a4' | 'thermal' | 'both')}
              >
                <option value="a4">{t('onboarding.printA4')}</option>
                <option value="thermal">{t('onboarding.printThermal')}</option>
                <option value="both">{t('onboarding.printBoth')}</option>
              </select>
            </Field>
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button type="submit" disabled={busy} className="cf-btn cf-btn-primary w-full py-md">
            {busy ? t('common.loading') : t('onboarding.start')}
            <Icon name="arrow_back" />
          </button>
        </form>
      </main>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="cf-label">{label}</span>
      {children}
    </label>
  )
}
