/** Platform developer / sales WhatsApp (ClinicFlow) */
export const SUPPORT_WHATSAPP_DISPLAY = '0543641209'
/** International digits for wa.me (KSA 966) */
export const SUPPORT_WHATSAPP_E164 = '966543641209'

export function supportWhatsAppUrl(message?: string): string {
  const base = `https://wa.me/${SUPPORT_WHATSAPP_E164}`
  if (!message?.trim()) return base
  return `${base}?text=${encodeURIComponent(message.trim())}`
}
