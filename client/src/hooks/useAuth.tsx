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

const IMPERSONATE_KEY = 'cf-impersonate-tenant'

type SuspendedInfo = {
  clinicName: string
  message: string
  reason: 'suspended' | 'trial_expired' | 'subscription'
}

/** Block clinic staff when suspended, trial ended, or subscription lapsed. Active plans stay open. */
function clinicAccessBlock(tenant: Tenant): SuspendedInfo | null {
  if (tenant.is_suspended) {
    return {
      reason: 'suspended',
      clinicName: tenant.name,
      message:
        tenant.suspend_message?.trim() ||
        'تم تعليق حساب العيادة مؤقتًا. تواصل مع دعم ClinicFlow.',
    }
  }

  const status = tenant.subscription_status
  if (status === 'active') return null

  if (status === 'cancelled') {
    return {
      reason: 'subscription',
      clinicName: tenant.name,
      message: 'تم إلغاء اشتراك العيادة. جدّد الاشتراك للعودة إلى ClinicFlow.',
    }
  }

  if (status === 'past_due') {
    return {
      reason: 'subscription',
      clinicName: tenant.name,
      message: 'انتهت صلاحية الاشتراك أو الفترة التجريبية. تواصل مع دعم ClinicFlow للتجديد.',
    }
  }

  // trial / null: enforce trial_ends_at when set
  if (tenant.trial_ends_at && new Date(tenant.trial_ends_at).getTime() < Date.now()) {
    return {
      reason: 'trial_expired',
      clinicName: tenant.name,
      message: 'انتهت الفترة التجريبية لهذه العيادة. تواصل مع دعم ClinicFlow لتفعيل الاشتراك.',
    }
  }

  return null
}

type AuthState = {
  session: Session | null
  user: UserProfile | null
  tenant: Tenant | null
  loading: boolean
  impersonating: boolean
  suspended: SuspendedInfo | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
  startImpersonate: (tenantId: string) => Promise<void>
  stopImpersonate: () => Promise<void>
  clearSuspended: () => void
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
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.phone === b.phone &&
    a.address === b.address &&
    a.logo_url === b.logo_url &&
    (a.specialty ?? 'general') === (b.specialty ?? 'general') &&
    a.stamp_url === b.stamp_url &&
    a.doctor_signature_url === b.doctor_signature_url &&
    a.consultation_fee === b.consultation_fee &&
    a.follow_up_fee === b.follow_up_fee &&
    a.tax_rate === b.tax_rate &&
    a.default_language === b.default_language &&
    a.print_format === b.print_format &&
    !!a.is_suspended === !!b.is_suspended &&
    a.suspend_message === b.suspend_message &&
    a.subscription_status === b.subscription_status &&
    a.subscription_plan === b.subscription_plan &&
    a.trial_ends_at === b.trial_ends_at
  )
}

function readImpersonateId() {
  try {
    return localStorage.getItem(IMPERSONATE_KEY)
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [impersonating, setImpersonating] = useState(() => Boolean(readImpersonateId()))
  const [suspended, setSuspended] = useState<SuspendedInfo | null>(null)
  const profileRequest = useRef(0)
  const sessionRef = useRef<Session | null>(null)

  const loadTenantById = useCallback(async (tenantId: string) => {
    const { data } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle()
    return (data as Tenant | null) ?? null
  }, [])

  const loadProfile = useCallback(
    async (userId: string) => {
      const requestId = ++profileRequest.current

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (requestId !== profileRequest.current) return

      const nextUser = (profile as UserProfile | null) ?? null
      setUser((prev) => (sameProfile(prev, nextUser) ? prev : nextUser))

      const impersonateId = readImpersonateId()
      const isSa = nextUser?.role === 'super_admin'

      if (isSa && impersonateId) {
        const nextTenant = await loadTenantById(impersonateId)
        if (requestId !== profileRequest.current) return
        setImpersonating(true)
        setSuspended(null)
        setTenant((prev) => (sameTenant(prev, nextTenant) ? prev : nextTenant))
        return
      }

      if (!isSa) {
        try {
          localStorage.removeItem(IMPERSONATE_KEY)
        } catch {
          /* ignore */
        }
        setImpersonating(false)
      } else {
        setImpersonating(false)
      }

      if (nextUser?.tenant_id) {
        const nextTenant = await loadTenantById(nextUser.tenant_id)
        if (requestId !== profileRequest.current) return
        const block = nextTenant ? clinicAccessBlock(nextTenant) : null
        if (block) {
          setSuspended(block)
          setTenant(null)
        } else {
          setSuspended(null)
          setTenant((prev) => (sameTenant(prev, nextTenant) ? prev : nextTenant))
        }
      } else {
        setSuspended(null)
        setTenant(null)
      }
    },
    [loadTenantById],
  )

  const refreshProfile = useCallback(async () => {
    const userId = sessionRef.current?.user?.id
    if (!userId) {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (!authUser) {
        setUser(null)
        setTenant(null)
        setImpersonating(false)
        setSuspended(null)
        return
      }
      await loadProfile(authUser.id)
      return
    }
    await loadProfile(userId)
  }, [loadProfile])

  const startImpersonate = useCallback(
    async (tenantId: string) => {
      localStorage.setItem(IMPERSONATE_KEY, tenantId)
      setImpersonating(true)
      const nextTenant = await loadTenantById(tenantId)
      setTenant(nextTenant)
      setSuspended(null)
    },
    [loadTenantById],
  )

  const stopImpersonate = useCallback(async () => {
    localStorage.removeItem(IMPERSONATE_KEY)
    setImpersonating(false)
    setTenant(null)
  }, [])

  const clearSuspended = useCallback(() => setSuspended(null), [])

  useEffect(() => {
    let mounted = true

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
        setImpersonating(false)
        setSuspended(null)
        try {
          localStorage.removeItem(IMPERSONATE_KEY)
        } catch {
          /* ignore */
        }
        return
      }

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

  // Re-check trial / suspend soon after admin ends trial (doctor already logged in)
  useEffect(() => {
    if (!session?.user || impersonating) return

    const recheck = () => {
      void refreshProfile()
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') recheck()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', recheck)
    const interval = window.setInterval(recheck, 45_000)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', recheck)
      window.clearInterval(interval)
    }
  }, [session?.user, impersonating, refreshProfile])

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem(IMPERSONATE_KEY)
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut()
    sessionRef.current = null
    setUser(null)
    setTenant(null)
    setSession(null)
    setImpersonating(false)
    setSuspended(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user,
      tenant,
      loading,
      impersonating,
      suspended,
      refreshProfile,
      signOut,
      startImpersonate,
      stopImpersonate,
      clearSuspended,
    }),
    [
      session,
      user,
      tenant,
      loading,
      impersonating,
      suspended,
      refreshProfile,
      signOut,
      startImpersonate,
      stopImpersonate,
      clearSuspended,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
