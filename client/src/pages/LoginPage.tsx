import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Icon } from '../components/Icon'

export function LoginPage() {
  const { t } = useTranslation()
  const { session, user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session && user?.role === 'super_admin') return <Navigate to="/admin" replace />
  if (!loading && session && user?.role === 'secretary' && user.tenant_id) {
    return <Navigate to="/desk" replace />
  }
  if (!loading && session && user?.tenant_id) return <Navigate to="/" replace />
  if (!loading && session && !user?.tenant_id) return <Navigate to="/onboarding" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    void remember
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen flex-row-reverse bg-background text-on-surface">
      {/* Branding panel */}
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary p-xl text-on-primary lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary-fixed blur-3xl" />
          <div className="absolute -bottom-10 left-10 h-64 w-64 rounded-full bg-secondary-container blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="mb-xl flex items-center gap-sm">
            <Icon name="medical_services" filled className="text-4xl" />
            <span className="font-headline-md text-headline-md font-bold">{t('appName')}</span>
          </div>
          <span className="mb-md inline-block rounded-full bg-white/15 px-md py-xs font-label-md text-label-md">
            ClinicFlow v2.0
          </span>
          <h1 className="mb-md max-w-lg font-display text-display leading-tight">{t('auth.heroTitle')}</h1>
          <p className="max-w-md font-body-lg text-body-lg text-on-primary/85">{t('auth.heroBody')}</p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-md">
          {[
            ['speed', t('auth.featureSpeed')],
            ['security', t('auth.featureSecurity')],
            ['analytics', t('auth.featureReports')],
            ['group', t('auth.featureTeam')],
          ].map(([icon, label]) => (
            <div
              key={label}
              className="flex items-center gap-sm rounded-xl border border-white/15 bg-white/10 px-md py-md backdrop-blur-sm"
            >
              <span className="rounded-lg bg-secondary-container/30 p-xs text-secondary-container">
                <Icon name={icon} />
              </span>
              <span className="font-label-md text-label-md text-white/95">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Form */}
      <section className="flex w-full flex-col justify-center bg-surface-container-lowest px-lg py-xl lg:w-1/2">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-xl">
            <div className="mb-xs flex items-center gap-sm">
              <Icon name="medical_services" filled className="text-4xl text-primary" />
              <h1 className="font-headline-md text-headline-md font-bold text-primary">{t('appName')}</h1>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">{t('auth.welcomeBack')}</p>
          </div>

          <div className="mb-lg">
            <h2 className="mb-xs font-headline-lg text-headline-lg text-on-surface">{t('auth.login')}</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">{t('auth.loginHint')}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-lg">
            <div className="space-y-base">
              <label className="block font-label-md text-label-md text-on-surface-variant" htmlFor="email">
                {t('auth.email')}
              </label>
              <div className="relative">
                <input
                  id="email"
                  className="w-full rounded-lg border border-outline-variant bg-surface py-md pe-lg ps-12 text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@clinic.com"
                  required
                  autoComplete="email"
                />
                <Icon
                  name="alternate_email"
                  className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-outline"
                />
              </div>
            </div>

            <div className="space-y-base">
              <label className="block font-label-md text-label-md text-on-surface-variant" htmlFor="password">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  className="w-full rounded-lg border border-outline-variant bg-surface py-md pe-12 ps-lg text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute end-4 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-primary"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-sm">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-5 w-5 cursor-pointer rounded border-outline-variant text-primary focus:ring-primary"
              />
              <label
                htmlFor="remember"
                className="cursor-pointer select-none font-body-md text-body-md text-on-surface-variant"
              >
                {t('auth.remember')}
              </label>
            </div>

            {error && <p className="text-sm text-error">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-sm rounded-lg bg-primary py-md font-bold text-on-primary shadow-md transition-all duration-200 hover:bg-primary-container hover:shadow-lg active:scale-[0.98] disabled:opacity-60"
            >
              <span>{busy ? t('common.loading') : t('auth.submitLogin')}</span>
              <Icon name="login" />
            </button>
          </form>

          <p className="mt-xl text-center font-body-md text-body-md text-on-surface-variant">
            {t('auth.noAccount')}{' '}
            <Link className="font-bold text-primary hover:underline" to="/signup">
              {t('auth.createClinic')}
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
