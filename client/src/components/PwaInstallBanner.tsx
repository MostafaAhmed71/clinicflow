import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'cf-pwa-install-dismissed'

/** Soft prompt to install ClinicFlow as an app on supported browsers */
export function PwaInstallBanner() {
  const { t } = useTranslation()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === '1') return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  if (!visible || !deferred) return null

  return (
    <div className="cf-pwa-banner lg:hidden" role="status">
      <div className="flex min-w-0 flex-1 items-start gap-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
          <Icon name="install_mobile" className="text-xl" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-on-surface">{t('pwa.installTitle')}</div>
          <p className="text-xs text-on-surface-variant">{t('pwa.installHint')}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="cf-btn cf-btn-primary !px-3 !py-1.5 text-xs"
          onClick={async () => {
            await deferred.prompt()
            await deferred.userChoice
            setVisible(false)
            setDeferred(null)
          }}
        >
          {t('pwa.install')}
        </button>
        <button
          type="button"
          className="cf-btn cf-btn-ghost !px-2 !py-1.5 text-xs"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1')
            setVisible(false)
          }}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
