import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'
import { openWhatsApp } from '../lib/whatsapp'

type Props = {
  phone: string | null | undefined
  message: string
  label?: string
  className?: string
  compact?: boolean
}

export function WhatsAppButton({ phone, message, label, className = '', compact }: Props) {
  const { t } = useTranslation()
  const disabled = !phone?.trim()

  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? t('whatsapp.noPhone') : t('whatsapp.send')}
      className={
        className ||
        (compact
          ? 'cf-btn cf-btn-ghost py-sm text-xs text-[#128C7E] disabled:opacity-40'
          : 'cf-btn cf-btn-secondary py-sm text-xs !border-[#25D366]/50 !text-[#128C7E]')
      }
      onClick={() => {
        if (!openWhatsApp(phone, message)) {
          /* no-op; button disabled when no phone */
        }
      }}
    >
      <Icon name="chat" className="text-[16px]" />
      {label ?? t('whatsapp.send')}
    </button>
  )
}
