import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'

export type MobileNavLink = {
  to: string
  end: boolean
  key: string
  icon: string
}

type Props = {
  links: MobileNavLink[]
  moreLinks?: MobileNavLink[]
  hidden?: boolean
  onSignOut?: () => void
  extra?: ReactNode
}

/** Bottom tab bar + “more” sheet — primary phone navigation */
export function MobileBottomNav({ links, moreLinks = [], hidden, onSignOut, extra }: Props) {
  const { t } = useTranslation()
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  if (hidden) return null

  const primary = links.slice(0, 4)
  const rest = [...links.slice(4), ...moreLinks]
  const showMore = rest.length > 0 || Boolean(onSignOut) || Boolean(extra)

  return (
    <>
      <nav className="cf-mobile-bottom-nav lg:hidden" aria-label={t('shell.mobileNav')}>
        {primary.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `cf-mobile-tab ${isActive ? 'cf-mobile-tab--active' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={link.icon} filled={isActive} className="text-[22px]" />
                <span>{t(link.key)}</span>
              </>
            )}
          </NavLink>
        ))}
        {showMore ? (
          <button
            type="button"
            className={`cf-mobile-tab ${moreOpen ? 'cf-mobile-tab--active' : ''}`}
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
          >
            <Icon name="menu" className="text-[22px]" />
            <span>{t('shell.more')}</span>
          </button>
        ) : null}
      </nav>

      {moreOpen ? (
        <div className="cf-mobile-sheet-root lg:hidden" role="presentation">
          <button
            type="button"
            className="cf-mobile-sheet-backdrop"
            aria-label={t('common.cancel')}
            onClick={() => setMoreOpen(false)}
          />
          <div className="cf-mobile-sheet" role="dialog" aria-modal="true" aria-label={t('shell.more')}>
            <div className="cf-mobile-sheet-handle" />
            <div className="cf-mobile-sheet-grid">
              {rest.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `cf-mobile-sheet-item ${isActive ? 'cf-mobile-sheet-item--active' : ''}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon name={link.icon} filled={isActive} />
                      <span>{t(link.key)}</span>
                    </>
                  )}
                </NavLink>
              ))}
              {extra}
              {onSignOut ? (
                <button
                  type="button"
                  className="cf-mobile-sheet-item cf-mobile-sheet-item--danger"
                  onClick={() => {
                    setMoreOpen(false)
                    onSignOut()
                  }}
                >
                  <Icon name="logout" />
                  <span>{t('nav.logout')}</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
