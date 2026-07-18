import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { Icon } from './Icon'

/** Sticky banner while super_admin is viewing a clinic as support */
export function ImpersonationBanner() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { impersonating, tenant, stopImpersonate } = useAuth()

  if (!impersonating || !tenant) return null

  return (
    <div className="cf-impersonate-banner" role="status">
      <div className="flex min-w-0 flex-1 items-center gap-sm">
        <Icon name="support_agent" className="shrink-0 text-xl" />
        <span className="truncate text-sm font-bold">
          {t('admin.impersonatingAs', { name: tenant.name })}
        </span>
      </div>
      <button
        type="button"
        className="cf-btn shrink-0 !bg-white !px-3 !py-1.5 text-xs !text-primary"
        onClick={() => {
          void stopImpersonate().then(() => navigate('/admin'))
        }}
      >
        {t('admin.exitImpersonate')}
      </button>
    </div>
  )
}
