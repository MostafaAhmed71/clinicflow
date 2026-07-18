import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { SUPPORT_WHATSAPP_DISPLAY, supportWhatsAppUrl } from '../lib/supportContact'
import { Icon } from './Icon'

/** Shown when the clinic account is suspended by platform admin */
export function SuspendedScreen() {
  const { t, i18n } = useTranslation()
  const { suspended, signOut } = useAuth()

  if (!suspended) return null

  const waMsg =
    i18n.language === 'ar'
      ? `مرحباً، عيادة ${suspended.clinicName} — أحتاج تفعيل الاشتراك / الدعم.`
      : `Hi, clinic ${suspended.clinicName} — I need subscription activation / support.`

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-md py-lg">
      <div className="w-full max-w-md space-y-md rounded-2xl border border-error/30 bg-surface-container-lowest p-lg text-center shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-error-container text-error">
          <Icon name="block" filled className="text-3xl" />
        </div>
        <h1 className="text-xl font-bold text-on-surface">
          {suspended.reason === 'trial_expired'
            ? t('suspend.trialTitle')
            : suspended.reason === 'subscription'
              ? t('suspend.subTitle')
              : t('suspend.title')}
        </h1>
        <p className="text-sm font-semibold text-on-surface-variant">{suspended.clinicName}</p>
        <p className="rounded-xl bg-error-container/40 px-md py-sm text-sm leading-relaxed text-on-error-container">
          {suspended.message}
        </p>
        <p className="text-xs text-outline">{t('suspend.hint')}</p>
        <a
          className="cf-btn cf-btn-primary w-full"
          href={supportWhatsAppUrl(waMsg)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="chat" />
          {t('suspend.whatsapp')} · {SUPPORT_WHATSAPP_DISPLAY}
        </a>
        <button type="button" className="cf-btn cf-btn-ghost w-full" onClick={() => void signOut()}>
          <Icon name="logout" />
          {t('nav.logout')}
        </button>
      </div>
    </main>
  )
}
