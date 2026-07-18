import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export type AppModule =
  | 'patients'
  | 'appointments'
  | 'consultation'
  | 'billing'
  | 'reports'
  | 'settings'
  | 'templates'

export type PermissionFlags = {
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
}

const DEFAULT_BY_ROLE: Record<string, Record<AppModule, PermissionFlags>> = {
  doctor: {
    patients: { can_view: true, can_edit: true, can_delete: true },
    appointments: { can_view: true, can_edit: true, can_delete: true },
    consultation: { can_view: true, can_edit: true, can_delete: true },
    billing: { can_view: true, can_edit: true, can_delete: true },
    reports: { can_view: true, can_edit: true, can_delete: false },
    settings: { can_view: true, can_edit: true, can_delete: false },
    templates: { can_view: true, can_edit: true, can_delete: true },
  },
  secretary: {
    patients: { can_view: true, can_edit: true, can_delete: false },
    appointments: { can_view: true, can_edit: true, can_delete: false },
    consultation: { can_view: false, can_edit: false, can_delete: false },
    billing: { can_view: true, can_edit: true, can_delete: false },
    reports: { can_view: false, can_edit: false, can_delete: false },
    settings: { can_view: false, can_edit: false, can_delete: false },
    templates: { can_view: false, can_edit: false, can_delete: false },
  },
  super_admin: {
    patients: { can_view: true, can_edit: true, can_delete: true },
    appointments: { can_view: true, can_edit: true, can_delete: true },
    consultation: { can_view: true, can_edit: true, can_delete: true },
    billing: { can_view: true, can_edit: true, can_delete: true },
    reports: { can_view: true, can_edit: true, can_delete: true },
    settings: { can_view: true, can_edit: true, can_delete: true },
    templates: { can_view: true, can_edit: true, can_delete: true },
  },
}

const MODULES: AppModule[] = [
  'patients',
  'appointments',
  'consultation',
  'billing',
  'reports',
  'settings',
  'templates',
]

type PermissionsState = {
  permissions: Record<AppModule, PermissionFlags>
  canView: (module: AppModule) => boolean
  canEdit: (module: AppModule) => boolean
  loading: boolean
  refreshPermissions: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsState | undefined>(undefined)

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [overrides, setOverrides] = useState<Partial<Record<AppModule, PermissionFlags>>>({})
  const loadedForUser = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!user || user.role === 'super_admin' || !user.tenant_id) {
      setOverrides({})
      loadedForUser.current = user?.id ?? null
      return
    }

    const { data } = await supabase
      .from('permissions')
      .select('module, can_view, can_edit, can_delete')
      .eq('user_id', user.id)

    const map: Partial<Record<AppModule, PermissionFlags>> = {}
    for (const row of data ?? []) {
      if (MODULES.includes(row.module as AppModule)) {
        map[row.module as AppModule] = {
          can_view: !!row.can_view,
          can_edit: !!row.can_edit,
          can_delete: !!row.can_delete,
        }
      }
    }
    setOverrides(map)
    loadedForUser.current = user.id
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const permissions = useMemo(() => {
    const roleKey =
      user?.role === 'clinic_manager' ? 'doctor' : (user?.role ?? 'secretary')
    const roleDefaults = DEFAULT_BY_ROLE[roleKey] ?? DEFAULT_BY_ROLE.doctor
    const result = { ...roleDefaults }
    for (const module of MODULES) {
      if (overrides[module]) result[module] = overrides[module]!
    }
    return result
  }, [user?.role, overrides])

  const value = useMemo<PermissionsState>(
    () => ({
      permissions,
      loading: false,
      canView: (module: AppModule) => {
        if (user?.role === 'super_admin') return true
        return permissions[module]?.can_view ?? false
      },
      canEdit: (module: AppModule) => {
        if (user?.role === 'super_admin') return true
        return permissions[module]?.can_edit ?? false
      },
      refreshPermissions: load,
    }),
    [permissions, user?.role, load],
  )

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext)
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider')
  return ctx
}

export function pathToModule(pathname: string): AppModule | null {
  if (pathname.startsWith('/patients')) return 'patients'
  if (pathname.startsWith('/appointments') || pathname.startsWith('/waiting')) return 'appointments'
  if (pathname.startsWith('/consultation') || pathname.startsWith('/follow-ups')) return 'consultation'
  if (pathname.startsWith('/invoices') || pathname.startsWith('/cash')) return 'billing'
  if (pathname.startsWith('/reports')) return 'reports'
  if (pathname.startsWith('/templates')) return 'templates'
  if (pathname.startsWith('/settings') || pathname.startsWith('/permissions')) return 'settings'
  return null
}
