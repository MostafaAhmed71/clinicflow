import type { Appointment } from '../types/clinic'
import type { Tenant } from '../types/database'

export type VisitKind = 'new_visit' | 'follow_up'

export function feeForVisitKind(tenant: Tenant | null | undefined, kind: VisitKind): number {
  if (!tenant) return 0
  if (kind === 'follow_up') {
    const follow = Number(tenant.follow_up_fee)
    if (!Number.isNaN(follow) && follow > 0) return follow
    // Fallback before migration / unset: half of consultation
    return Math.round((Number(tenant.consultation_fee ?? 0) / 2) * 100) / 100
  }
  return Number(tenant.consultation_fee ?? 0)
}

export function appointmentFee(a: Appointment, tenant?: Tenant | null): number {
  const stored = Number(a.fee_amount)
  if (!Number.isNaN(stored) && stored > 0) return stored
  return feeForVisitKind(tenant, a.visit_kind === 'follow_up' ? 'follow_up' : 'new_visit')
}
