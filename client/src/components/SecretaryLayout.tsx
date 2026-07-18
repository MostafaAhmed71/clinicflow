import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useDeskCounts } from '../hooks/useDeskCounts'
import { Icon } from './Icon'
import { MobileBottomNav } from './MobileBottomNav'
import { PwaInstallBanner } from './PwaInstallBanner'

export function SecretaryLayout() {
  const { t, i18n } = useTranslation()
  const { user, tenant, signOut } = useAuth()
  const { waiting, unpaid } = useDeskCounts(tenant?.id)

  const deskLinks = [
    { to: '/desk', end: true, key: 'secretary.bookings', icon: 'event' },
    { to: '/desk/waiting', end: false, key: 'appointments.waitingRoom', icon: 'hourglass_top' },
  ]

  return (
    <div className="cf-desk-shell">
      <PwaInstallBanner />
      <header className="cf-desk-header">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-sm px-md py-sm sm:gap-md sm:px-lg sm:py-md">
          <div className="flex min-w-0 items-center gap-sm sm:gap-md">
            {tenant?.logo_url ? (
              <img
                src={tenant.logo_url}
                alt=""
                className="h-10 w-10 shrink-0 rounded-xl border border-white/25 object-cover shadow-sm sm:h-11 sm:w-11"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 sm:h-11 sm:w-11">
                <Icon name="desk" filled />
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-base font-bold tracking-tight sm:text-lg">{t('secretary.desk')}</div>
              <div className="truncate text-[11px] text-on-primary/75 sm:text-xs">
                {tenant?.name} · {user?.full_name}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-sm">
            <nav className="hidden gap-1.5 sm:flex">
              <NavLink
                to="/desk"
                end
                className={({ isActive }) =>
                  `cf-desk-nav-link ${isActive ? 'cf-desk-nav-link--active' : 'cf-desk-nav-link--idle'}`
                }
              >
                <Icon name="event" className="text-[18px]" />
                {t('secretary.bookings')}
                {unpaid > 0 ? (
                  <span className="cf-nav-count cf-nav-count--unpaid">{unpaid}</span>
                ) : null}
              </NavLink>
              <NavLink
                to="/desk/waiting"
                className={({ isActive }) =>
                  `cf-desk-nav-link ${isActive ? 'cf-desk-nav-link--active' : 'cf-desk-nav-link--idle'}`
                }
              >
                <Icon name="hourglass_top" className="text-[18px]" />
                {t('appointments.waitingRoom')}
                {waiting > 0 ? (
                  <span className="cf-nav-count cf-nav-count--waiting">{waiting}</span>
                ) : null}
              </NavLink>
            </nav>
            <button
              type="button"
              className="min-h-10 min-w-10 rounded-xl bg-white/12 px-sm py-sm text-xs !text-white ring-1 ring-white/15 hover:bg-white/20"
              onClick={() => void i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
            >
              <Icon name="language" className="text-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="hidden items-center gap-1 rounded-xl bg-white px-md py-sm text-sm font-bold !text-primary shadow-sm hover:bg-primary-fixed sm:inline-flex"
            >
              <Icon name="logout" className="text-[18px] !text-primary" />
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="cf-desk-main mx-auto max-w-5xl space-y-md px-md py-md pb-[calc(5rem+env(safe-area-inset-bottom))] sm:space-y-lg sm:px-lg sm:py-lg lg:pb-lg">
        <Outlet />
      </main>

      <MobileBottomNav
        links={deskLinks}
        onSignOut={() => void signOut()}
      />
    </div>
  )
}
