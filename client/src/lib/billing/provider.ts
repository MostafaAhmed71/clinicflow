/**
 * Platform subscription payment providers.
 * Manual works now; Paymob / Fawry return a pending intent until keys are configured.
 */

export type PaymentProviderId = 'manual' | 'paymob' | 'fawry'

export type SubscriptionPaymentInput = {
  tenantId: string
  invoiceId: string
  amountEgp: number
  description?: string
}

export type SubscriptionPaymentResult = {
  provider: PaymentProviderId
  status: 'pending_manual' | 'pending_redirect' | 'ready_stub'
  reference: string
  checkoutUrl?: string | null
  messageAr: string
}

const PLAN_PRICES_EGP: Record<string, number> = {
  starter: 499,
  professional: 899,
  enterprise: 1499,
}

export function planMonthlyPrice(plan: string): number {
  return PLAN_PRICES_EGP[plan] ?? 499
}

export async function createSubscriptionPayment(
  provider: PaymentProviderId,
  input: SubscriptionPaymentInput,
): Promise<SubscriptionPaymentResult> {
  const reference = `${provider}-${input.invoiceId.slice(0, 8)}-${Date.now()}`

  if (provider === 'manual') {
    return {
      provider: 'manual',
      status: 'pending_manual',
      reference,
      messageAr: 'تسجيل يدوي — حدّث الحالة إلى «مدفوع» بعد استلام التحويل أو فوري.',
    }
  }

  if (provider === 'paymob') {
    // Stub until PAYMOB_API_KEY / integration IDs are configured server-side
    return {
      provider: 'paymob',
      status: 'ready_stub',
      reference,
      checkoutUrl: null,
      messageAr:
        'Paymob جاهز للربط — أضف مفاتيح API في Edge Function ثم فعّل رابط الدفع. المرجعية محفوظة للتتبع.',
    }
  }

  return {
    provider: 'fawry',
    status: 'ready_stub',
    reference,
    checkoutUrl: null,
    messageAr:
      'Fawry جاهز للربط — أضف بيانات التاجر ثم أصدر مرجع الدفع. المرجعية محفوظة للتتبع.',
  }
}

/** @deprecated use createSubscriptionPayment — kept for older clinic invoice UI */
export type PaymentIntentInput = {
  tenantId: string
  amount: number
  currency?: string
  description?: string
}

export type PaymentIntentResult = {
  provider: 'manual'
  status: 'pending_manual'
  reference: string
}

export interface BillingProvider {
  createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>
}

export const billingProvider: BillingProvider = {
  async createPaymentIntent(input) {
    return {
      provider: 'manual',
      status: 'pending_manual',
      reference: `manual-${input.tenantId}-${Date.now()}`,
    }
  },
}
