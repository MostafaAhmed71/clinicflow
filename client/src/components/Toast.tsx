import { useEffect } from 'react'
import { Icon } from './Icon'

type ToastTone = 'success' | 'error' | 'info'

type Props = {
  message: string | null
  tone?: ToastTone
  onDismiss: () => void
  durationMs?: number
}

const ICONS: Record<ToastTone, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
}

export function Toast({ message, tone = 'success', onDismiss, durationMs = 2800 }: Props) {
  useEffect(() => {
    if (!message) return
    const handle = window.setTimeout(onDismiss, durationMs)
    return () => window.clearTimeout(handle)
  }, [message, durationMs, onDismiss])

  if (!message) return null

  return (
    <div className={`cf-toast cf-toast--${tone}`} role="status" aria-live="polite">
      <Icon name={ICONS[tone]} className="text-[20px]" filled={tone === 'success'} />
      <span>{message}</span>
    </div>
  )
}
