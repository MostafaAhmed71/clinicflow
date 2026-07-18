import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

type Props = {
  value: string | null | undefined
  onChange: (isoDate: string) => void
  disabled?: boolean
  id?: string
}

function parseParts(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return { year: '', month: '', day: '' }
  }
  const [year, month, day] = value.slice(0, 10).split('-')
  return { year, month, day }
}

function toIso(year: string, month: string, day: string) {
  if (!year || !month || !day) return ''
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

export function BirthDateFields({ value, onChange, disabled }: Props) {
  const { t } = useTranslation()
  const parts = parseParts(value)

  const years = useMemo(() => {
    const now = new Date().getFullYear()
    const list: number[] = []
    for (let y = now; y >= now - 120; y -= 1) list.push(y)
    return list
  }, [])

  const daysInMonth = useMemo(() => {
    if (!parts.year || !parts.month) return 31
    return new Date(Number(parts.year), Number(parts.month), 0).getDate()
  }, [parts.year, parts.month])

  function update(next: { year?: string; month?: string; day?: string }) {
    const year = next.year ?? parts.year
    const month = next.month ?? parts.month
    let day = next.day ?? parts.day
    if (year && month && day) {
      const max = new Date(Number(year), Number(month), 0).getDate()
      if (Number(day) > max) day = String(max)
    }
    onChange(toIso(year, month, day))
  }

  const selectClass =
    'w-full rounded-lg border border-outline-variant px-2 py-2 text-sm disabled:opacity-60'

  return (
    <div className="grid grid-cols-3 gap-2">
      <label className="block text-xs">
        <span className="mb-1 block text-on-surface-variant">{t('patients.day')}</span>
        <select
          className={selectClass}
          disabled={disabled}
          value={parts.day}
          onChange={(e) => update({ day: e.target.value })}
        >
          <option value="">—</option>
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = String(i + 1).padStart(2, '0')
            return (
              <option key={d} value={d}>
                {i + 1}
              </option>
            )
          })}
        </select>
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-on-surface-variant">{t('patients.month')}</span>
        <select
          className={selectClass}
          disabled={disabled}
          value={parts.month}
          onChange={(e) => update({ month: e.target.value })}
        >
          <option value="">—</option>
          {Array.from({ length: 12 }, (_, i) => {
            const m = String(i + 1).padStart(2, '0')
            return (
              <option key={m} value={m}>
                {i + 1}
              </option>
            )
          })}
        </select>
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-on-surface-variant">{t('patients.year')}</span>
        <select
          className={selectClass}
          disabled={disabled}
          value={parts.year}
          onChange={(e) => update({ year: e.target.value })}
        >
          <option value="">—</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
