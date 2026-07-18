import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

/** Common Rx dosage patterns used in Egyptian clinics */
export const DOSAGE_PRESETS = [
  '1×1',
  '1×2',
  '1×3',
  '1×4',
  '2×1',
  '2×2',
  '2×3',
  '½×1',
  '½×2',
  '½×3',
  '¼×1',
  '¼×2',
  '¼×3',
] as const

const CUSTOM = '__custom__'

function normalizeDosage(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '')
    .replace(/\*/g, '×')
    .replace(/1\/2/g, '½')
    .replace(/1\/4/g, '¼')
}

type Props = {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function DosageSelect({ value, onChange, className = '' }: Props) {
  const { t } = useTranslation()
  const normalized = normalizeDosage(value)
  const isPreset = (DOSAGE_PRESETS as readonly string[]).includes(normalized)
  const selectValue = !value.trim() ? '' : isPreset ? normalized : CUSTOM
  const showCustom = selectValue === CUSTOM

  const options = useMemo(
    () =>
      DOSAGE_PRESETS.map((d) => ({
        value: d,
        label: d.replace('×', ' × '),
      })),
    [],
  )

  return (
    <div className={`cf-dosage-field ${className}`}>
      <select
        className="cf-input"
        value={selectValue}
        aria-label={t('consultation.dosage')}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') onChange('')
          else if (v === CUSTOM) onChange(value.trim() && !isPreset ? value : '')
          else onChange(v)
        }}
      >
        <option value="">{t('consultation.dosagePick')}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value={CUSTOM}>{t('consultation.dosageCustom')}</option>
      </select>
      {showCustom ? (
        <input
          className="cf-input mt-1"
          placeholder={t('consultation.dosageCustomPh')}
          value={value}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </div>
  )
}
