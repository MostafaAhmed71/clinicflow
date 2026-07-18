/**
 * WhatsApp deep links for Egypt clinic desk — no Business API required.
 * Opens wa.me so the secretary/doctor sends from their phone.
 */

export function normalizeEgyptPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (!digits) return null

  // Local 01xxxxxxxxx → 201xxxxxxxxx
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0') && digits.length === 11) digits = `20${digits.slice(1)}`
  if (digits.length === 10 && digits.startsWith('1')) digits = `20${digits}`
  if (!digits.startsWith('20') && digits.length >= 10) {
    // Already international without +
  }
  if (digits.length < 10) return null
  return digits
}

export function whatsappUrl(phone: string | null | undefined, message: string): string | null {
  const normalized = normalizeEgyptPhone(phone)
  if (!normalized) return null
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

export function openWhatsApp(phone: string | null | undefined, message: string) {
  const url = whatsappUrl(phone, message)
  if (!url) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

export function appointmentReminderMessage(input: {
  clinicName: string
  patientName: string
  whenLabel: string
  clinicPhone?: string | null
  lang?: 'ar' | 'en'
}) {
  if (input.lang === 'en') {
    return [
      `Hello ${input.patientName},`,
      `Reminder: your appointment at ${input.clinicName} is on ${input.whenLabel}.`,
      input.clinicPhone ? `Clinic phone: ${input.clinicPhone}` : '',
      'Please reply to confirm. Thank you.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  return [
    `مرحباً ${input.patientName}،`,
    `تذكير بموعدكم في عيادة ${input.clinicName} يوم ${input.whenLabel}.`,
    input.clinicPhone ? `للتواصل: ${input.clinicPhone}` : '',
    'برجاء الرد لتأكيد الحضور. شكراً لكم.',
  ]
    .filter(Boolean)
    .join('\n')
}

export function followUpWhatsAppMessage(input: {
  clinicName: string
  patientName: string
  followUpDate: string
  lang?: 'ar' | 'en'
}) {
  if (input.lang === 'en') {
    return `Hello ${input.patientName}, this is ${input.clinicName}. Your follow-up is due on ${input.followUpDate}. Would you like to book an appointment?`
  }
  return `مرحباً ${input.patientName}، معكم عيادة ${input.clinicName}. موعد المتابعة المستحق ${input.followUpDate}. هل تودون حجز موعد؟`
}
