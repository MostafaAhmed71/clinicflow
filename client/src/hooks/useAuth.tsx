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
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Tenant, UserProfile } from '../types/database'

type AuthState = {
  session: Session | null
  user: UserProfile | null
  tenant: Tenant | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

function sameProfile(a: UserProfile | null, b: UserProfile | null) {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.id === b.id &&
    a.tenant_id === b.tenant_id &&
    a.role === b.role &&
    a.full_name === b.full_name &&
    a.email === b.email
  )
}

function sameTenant(a: Tenant | null, b: Tenant | null) {
  if (a === b) return true
  if (!a || !b) return false
  const specialtyA = a.specialty ?? 'general'
  const specialtyB = b.specialty ?? 'general'
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.phone === b.phone &&
    a.address === b.address &&
    a.logo_url === b.logo_url &&
    specialtyA === specialtyB &&
    a.stamp_url === b.stamp_url &&
    a.doctor_signature_url === b.doctor_signature_url &&
    a.consultation_fee === b.consultation_fee &&
    a.follow_up_fee === b.follow_up_fee &&
    a.tax_rate === b.tax_rate &&
    a.default_language === b.default_language &&
    a.print_format === b.print_format
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const profileRequest = useRef(0)
  const sessionRef = useRef<Session | null>(null)

  const loadProfile = useCallback(async (userId: string) => {
    const requestId = ++profileRequest.current

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (requestId !== profileRequest.current) return

    const nextUser = (profile as UserProfile | null) ?? null
    setUser((prev) => (sameProfile(prev, nextUser) ? prev : nextUser))

    if (nextUser?.tenant_id) {
      const { data: tenantRow } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', nextUser.tenant_id)
        .maybeSingle()
      if (requestId !== profileRequest.current) return
      const nextTenant = (tenantRow as Tenant | null) ?? null
      setTenant((prev) => (sameTenant(prev, nextTenant) ? prev : nextTenant))
    } else {
      setTenant(null)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const userId = sessionRef.current?.user?.id
    if (!userId) {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser) {
        setUser(null)
        setTenant(null)
        return
      }
      await loadProfile(authUser.id)
      return
    }
    await loadProfile(userId)
  }, [loadProfile])

  useEffect(() => {
    let mounted = true

    // Initial session once — never flip loading back to true after this
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      const next = data.session
      sessionRef.current = next
      setSession(next)
      if (next?.user) {
        void loadProfile(next.user.id).finally(() => {
          if (mounted) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return

      sessionRef.current = next

      setSession((prev) => {
        if (prev?.access_token === next?.access_token && prev?.user?.id === next?.user?.id) {
          return prev
        }
        return next
      })

      if (event === 'TOKEN_REFRESHED') return

      if (event === 'SIGNED_OUT' || !next?.user) {
        setUser(null)
        setTenant(null)
        return
      }

      // Defer to avoid supabase auth deadlock inside the callback
      setTimeout(() => {
        if (!mounted) return
        void loadProfile(next.user.id)
      }, 0)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    sessionRef.current = null
    setUser(null)
    setTenant(null)
    setSession(null)
  }, [])

  const value = useMemo(
    () => ({ session, user, tenant, loading, refreshProfile, signOut }),
    [session, user, tenant, loading, refreshProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
