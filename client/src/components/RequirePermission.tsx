import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { pathToModule, usePermissions } from '../hooks/usePermissions'

export function RequirePermission({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { canView } = usePermissions()
  const module = pathToModule(location.pathname)

  if (module && !canView(module)) {
    return <Navigate to="/" replace state={{ denied: module }} />
  }

  return children
}
