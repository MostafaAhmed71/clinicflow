/**
 * Payment provider integration point.
 * MVP: manual / text payment method only — no real gateway.
 * Later: Paymob / Fawry without restructuring billing UI.
 */

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
