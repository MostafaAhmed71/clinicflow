import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { BrandLogo } from '../components/BrandLogo'
import { Icon } from '../components/Icon'

export function SignupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session, user, loading } = useAuth()
  const [fullName, setFullName] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session && user?.tenant_id) return <Navigate to="/" replace />
  if (!loading && session && !user?.tenant_id) return <Navigate to="/onboarding" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, clinic_name: clinicName } },
      })
      if (signUpError) throw signUpError
      navigate('/onboarding', { replace: true, state: { clinicName, fullName } })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-row-reverse bg-background text-on-surface">
      {/* Branding panel */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-xl text-on-primary lg:flex lg:w-1/2">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary-fixed blur-3xl" />
          <div className="absolute -bottom-10 left-10 h-64 w-64 rounded-full bg-secondary-container blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="mb-xl">
            <BrandLogo
              size="xl"
              variant="full"
              imgClassName="rounded-2xl bg-white p-1.5 shadow-sm"
            />
          </div>
          <h1 className="mb-md font-display text-display leading-tight">{t('signup.heroTitle')}</h1>
          <p className="max-w-md font-body-lg text-body-lg text-on-primary/85">{t('signup.heroBody')}</p>
        </div>
        <div className="glass-effect relative z-10 rounded-xl border border-white/20 p-lg">
          <div className="mb-sm font-label-md text-label-md text-white/80">{t('signup.liveStats')}</div>
          <div className="grid grid-cols-2 gap-md">
            <div>
              <div className="text-2xl font-bold">14</div>
              <div className="text-xs text-white/70">{t('signup.trialDays')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold">RTL</div>
              <div className="text-xs text-white/70">{t('signup.bilingual')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="flex w-full flex-col justify-center bg-surface px-lg py-xl lg:w-1/2">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-lg lg:hidden">
            <BrandLogo size="lg" variant="full" />
          </div>
          <h2 className="mb-xs font-headline-lg text-headline-lg text-on-surface">{t('signup.title')}</h2>
          <p className="mb-lg font-body-md text-body-md text-on-surface-variant">{t('signup.hint')}</p>

          <form onSubmit={onSubmit} className="space-y-md">
            <label className="block">
              <span className="mb-xs block font-label-md text-label-md text-on-surface-variant">{t('onboarding.fullName')}</span>
              <input className="cf-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
            <label className="block">
              <span className="mb-xs block font-label-md text-label-md text-on-surface-variant">{t('onboarding.clinicName')}</span>
              <input className="cf-input" value={clinicName} onChange={(e) => setClinicName(e.target.value)} required />
            </label>
            <label className="block">
              <span className="mb-xs block font-label-md text-label-md text-on-surface-variant">{t('auth.email')}</span>
              <input
                className="cf-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="mb-xs block font-label-md text-label-md text-on-surface-variant">{t('auth.password')}</span>
              <input
                className="cf-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>

            {error && <p className="text-sm text-error">{error}</p>}

            <button type="submit" disabled={busy} className="cf-btn cf-btn-primary w-full py-md">
              {busy ? t('common.loading') : t('signup.submit')}
              <Icon name="arrow_back" />
            </button>
          </form>

          <p className="mt-xl text-center font-body-md text-body-md text-on-surface-variant">
            {t('auth.haveAccount')}{' '}
            <Link className="font-bold text-primary hover:underline" to="/login">
              {t('auth.backToLogin')}
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
