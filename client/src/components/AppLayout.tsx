import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useFocusMode } from '../hooks/useFocusMode'
import { usePermissions, type AppModule } from '../hooks/usePermissions'
import { Icon } from './Icon'
import { MobileBottomNav } from './MobileBottomNav'
import { PwaInstallBanner } from './PwaInstallBanner'
import { ImpersonationBanner } from './ImpersonationBanner'

const links: {
  to: string
  end: boolean
  key: string
  module: AppModule | null
  icon: string
}[] = [
  { to: '/', end: true, key: 'nav.dashboard', module: null, icon: 'dashboard' },
  { to: '/patients', end: false, key: 'nav.patients', module: 'patients', icon: 'folder_shared' },
  { to: '/appointments', end: false, key: 'nav.appointments', module: 'appointments', icon: 'calendar_today' },
  { to: '/waiting', end: false, key: 'nav.waiting', module: 'appointments', icon: 'hourglass_top' },
  { to: '/follow-ups', end: false, key: 'nav.followUps', module: 'consultation', icon: 'event_repeat' },
  { to: '/consultation', end: false, key: 'nav.consultation', module: 'consultation', icon: 'medical_services' },
  { to: '/invoices', end: false, key: 'nav.billing', module: 'billing', icon: 'payments' },
  { to: '/reports', end: false, key: 'nav.reports', module: 'reports', icon: 'assessment' },
  { to: '/settings', end: false, key: 'nav.settings', module: 'settings', icon: 'settings' },
]

const titles: Record<string, string> = {
  '/': 'nav.dashboard',
  '/patients': 'nav.patients',
  '/appointments': 'nav.appointments',
  '/waiting': 'nav.waiting',
  '/follow-ups': 'nav.followUps',
  '/consultation': 'nav.consultation',
  '/invoices': 'nav.billing',
  '/cash': 'nav.cash',
  '/reports': 'nav.reports',
  '/settings': 'nav.settings',
  '/settings/setup': 'clinicSetup.title',
  '/permissions': 'nav.permissions',
  '/templates': 'nav.templates',
}

function pageTitleKey(pathname: string) {
  if (pathname.startsWith('/patients')) return 'nav.patients'
  if (pathname.startsWith('/settings/setup')) return 'clinicSetup.title'
  return titles[pathname] ?? 'nav.dashboard'
}

/** Primary tabs on phone bottom bar (order matters) */
const MOBILE_PRIMARY = ['/', '/patients', '/waiting', '/consultation']

export function AppLayout() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, tenant, signOut } = useAuth()
  const { canView } = usePermissions()
  const { focusMode } = useFocusMode()

  const visibleLinks = links.filter((link) => !link.module || canView(link.module))
  const initial = (user?.full_name ?? '?').trim().charAt(0)
  const onConsultation = location.pathname.startsWith('/consultation')
  const hideChrome = focusMode && onConsultation

  const mobilePrimary = MOBILE_PRIMARY.map((to) => visibleLinks.find((l) => l.to === to)).filter(
    Boolean,
  ) as typeof visibleLinks
  const mobileMore = visibleLinks.filter((l) => !MOBILE_PRIMARY.includes(l.to))
  if (user?.role === 'super_admin') {
    mobileMore.push({
      to: '/admin',
      end: false,
      key: 'nav.admin',
      module: null,
      icon: 'admin_panel_settings',
    })
  }
  mobileMore.push(
    { to: '/templates', end: false, key: 'nav.templates', module: 'templates', icon: 'description' },
    { to: '/cash', end: false, key: 'nav.cash', module: 'billing', icon: 'account_balance_wallet' },
  )

  return (
    <div className="cf-app-shell min-h-screen bg-background text-on-surface">
      <ImpersonationBanner />
      <PwaInstallBanner />

      {/* SideNavBar — desktop only */}
      <aside
        className={`fixed right-0 top-0 z-50 hidden h-full w-sidebar-width flex-col gap-sm border-l border-outline-variant bg-surface p-md lg:flex ${
          hideChrome ? '!hidden' : ''
        }`}
      >
        <div className="mb-lg flex flex-col items-center gap-xs px-sm">
          {tenant?.logo_url ? (
            <img
              src={tenant.logo_url}
              alt=""
              className="h-12 w-12 rounded-xl border border-outline-variant object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-on-primary">
              <Icon name="medical_services" filled className="text-3xl" />
            </div>
          )}
          <h1 className="font-headline-md text-headline-md font-bold text-primary">{t('appName')}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant opacity-70">{t('tagline')}</p>
        </div>

        <nav className="custom-scrollbar flex flex-1 flex-col gap-xs overflow-y-auto">
          {visibleLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive
                  ? 'flex items-center gap-md rounded-lg bg-primary-container px-md py-sm font-bold text-on-primary-container transition-transform active:scale-95'
                  : 'flex items-center gap-md rounded-lg px-md py-sm text-on-surface-variant transition-colors duration-200 hover:bg-surface-container-high'
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={link.icon} filled={isActive} />
                  <span className="font-body-md text-body-md">{t(link.key)}</span>
                </>
              )}
            </NavLink>
          ))}
          {user?.role === 'super_admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                isActive
                  ? 'flex items-center gap-md rounded-lg bg-primary-container px-md py-sm font-bold text-on-primary-container'
                  : 'flex items-center gap-md rounded-lg px-md py-sm text-on-surface-variant hover:bg-surface-container-high'
              }
            >
              <Icon name="admin_panel_settings" />
              <span className="font-body-md text-body-md">{t('nav.admin')}</span>
            </NavLink>
          )}
        </nav>

        <div className="mt-auto space-y-sm border-t border-outline-variant pt-md">
          <button
            type="button"
            onClick={() => navigate('/patients?new=1')}
            className="flex w-full items-center justify-center gap-sm rounded-xl bg-primary py-md font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary-container active:scale-95"
          >
            <Icon name="person_add" />
            <span>{t('patients.add')}</span>
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-md rounded-lg px-md py-sm text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <Icon name="logout" />
            <span className="font-body-md text-body-md">{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      <main
        className={`min-h-screen transition-all duration-300 ${hideChrome ? '' : 'lg:mr-sidebar-width'}`}
      >
        <header
          className={`cf-app-header sticky top-0 z-40 flex h-14 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-md shadow-sm sm:h-16 sm:px-lg ${
            hideChrome ? 'hidden' : ''
          }`}
        >
          <div className="flex min-w-0 items-center gap-md sm:gap-lg">
            <h2 className="truncate font-title-lg text-base font-bold text-primary sm:text-title-lg">
              {t(pageTitleKey(location.pathname))}
            </h2>
            <div className="relative hidden md:block">
              <input
                className="w-80 rounded-full border-none bg-surface-container-low px-xl py-xs font-label-md text-label-md outline-none transition-all focus:ring-2 focus:ring-primary/20"
                placeholder={t('shell.search')}
                type="search"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const q = (e.target as HTMLInputElement).value.trim()
                    if (q) navigate(`/patients?q=${encodeURIComponent(q)}`)
                  }
                }}
              />
              <Icon
                name="search"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-outline"
              />
            </div>
          </div>

          <div className="flex items-center gap-sm sm:gap-md">
            <button
              type="button"
              className="flex min-h-10 min-w-10 items-center justify-center rounded-lg p-xs transition-all hover:text-primary md:hidden"
              onClick={() => navigate('/patients')}
              aria-label={t('shell.search')}
            >
              <Icon name="search" />
            </button>
            <button
              type="button"
              className="flex min-h-10 min-w-10 cursor-pointer items-center justify-center p-xs transition-all hover:text-primary"
              onClick={() => void i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
              title={i18n.language === 'ar' ? t('common.english') : t('common.arabic')}
            >
              <Icon name="language" />
            </button>
            <div className="mx-xs hidden h-8 w-px bg-outline-variant sm:block" />
            <div className="flex items-center gap-sm">
              <div className="hidden text-left sm:block">
                <p className="font-label-md text-label-md font-bold text-on-surface">{user?.full_name}</p>
                <p className="text-right text-[10px] text-outline">{tenant?.name}</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary-fixed bg-primary text-sm font-bold text-on-primary sm:h-10 sm:w-10">
                {initial}
              </div>
            </div>
          </div>
        </header>

        <div
          className={`cf-app-content mx-auto space-y-md p-md sm:space-y-lg sm:p-lg ${
            hideChrome ? 'max-w-none pb-28' : 'max-w-[1440px] pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-lg'
          }`}
        >
          <Outlet />
        </div>
      </main>

      <MobileBottomNav
        hidden={hideChrome}
        links={mobilePrimary}
        moreLinks={mobileMore.filter((l) => !l.module || canView(l.module))}
        onSignOut={() => void signOut()}
      />
    </div>
  )
}
