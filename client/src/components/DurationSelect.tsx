import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

/** Common Rx duration patterns used in Egyptian clinics */
export const DURATION_PRESETS = [
  '3 أيام',
  '5 أيام',
  '7 أيام',
  '10 أيام',
  '14 يوم',
  '21 يوم',
  'شهر',
  'شهرين',
  '3 أشهر',
  'عند اللزوم',
] as const

const DURATION_PRESETS_EN = [
  '3 days',
  '5 days',
  '7 days',
  '10 days',
  '14 days',
  '21 days',
  '1 month',
  '2 months',
  '3 months',
  'as needed',
] as const

const CUSTOM = '__custom__'

type Props = {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function DurationSelect({ value, onChange, className = '' }: Props) {
  const { t, i18n } = useTranslation()
  const presets = i18n.language === 'en' ? DURATION_PRESETS_EN : DURATION_PRESETS
  const trimmed = value.trim()
  const isPreset = (presets as readonly string[]).includes(trimmed)
  const selectValue = !trimmed ? '' : isPreset ? trimmed : CUSTOM
  const showCustom = selectValue === CUSTOM

  const options = useMemo(() => presets.map((d) => ({ value: d, label: d })), [presets])

  return (
    <div className={`cf-dosage-field ${className}`}>
      <select
        className="cf-input"
        value={selectValue}
        aria-label={t('consultation.duration')}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') onChange('')
          else if (v === CUSTOM) onChange(trimmed && !isPreset ? value : '')
          else onChange(v)
        }}
      >
        <option value="">{t('consultation.durationPick')}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value={CUSTOM}>{t('consultation.durationCustom')}</option>
      </select>
      {showCustom ? (
        <input
          className="cf-input mt-1"
          placeholder={t('consultation.durationCustomPh')}
          value={value}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </div>
  )
}
