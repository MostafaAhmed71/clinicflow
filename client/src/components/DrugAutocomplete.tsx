import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import type { EgyptianDrug } from '../lib/egyptianDrugs'
import { formatDrugPickLabel, searchEgyptianDrugsClient } from '../lib/egyptianDrugs'
import { Icon } from './Icon'

type Props = {
  value: string
  onChange: (value: string) => void
  onPick?: (drug: EgyptianDrug) => void
  placeholder?: string
  className?: string
}

export function DrugAutocomplete({ value, onChange, onPick, placeholder, className = '' }: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'ar'
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hits, setHits] = useState<EgyptianDrug[]>([])
  const [hint, setHint] = useState<string | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    const q = value.trim()
    if (q.length < 2) {
      setHits([])
      setHint(null)
      setLoading(false)
      return
    }

    const my = ++seq.current
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setHint(null)

      // Prefer DB RPC / table when imported
      const { data, error } = await supabase.rpc('search_egyptian_drugs', { q, lim: 18 })
      if (my !== seq.current) return

      if (!error && Array.isArray(data) && data.length > 0) {
        setHits(data as EgyptianDrug[])
        setLoading(false)
        setOpen(true)
        return
      }

      // Fallback: live GitHub CSV search (no import required)
      try {
        const local = await searchEgyptianDrugsClient(q, 18)
        if (my !== seq.current) return
        setHits(local)
        if (error || (Array.isArray(data) && data.length === 0)) {
          setHint(t('drugs.usingRemote'))
        }
        setOpen(true)
      } catch {
        if (my !== seq.current) return
        setHits([])
        setHint(t('drugs.needImport'))
      } finally {
        if (my === seq.current) setLoading(false)
      }
    }, 220)

    return () => window.clearTimeout(timer)
  }, [value, t])

  function pick(drug: EgyptianDrug) {
    const label = formatDrugPickLabel(drug, lang)
    onChange(label)
    onPick?.(drug)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={`cf-drug-ac relative ${className}`}>
      <input
        className="cf-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          if (hits.length) setOpen(true)
        }}
      />
      {loading ? (
        <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-outline">
          <Icon name="progress_activity" className="animate-spin text-[18px]" />
        </span>
      ) : null}

      {open && (hits.length > 0 || hint) ? (
        <div
          id={listId}
          role="listbox"
          className="cf-drug-ac-menu absolute inset-inline-start-0 z-30 mt-1 max-h-64 w-full min-w-[16rem] overflow-auto rounded-xl border border-outline-variant bg-surface-container-lowest py-1 shadow-lg sm:min-w-[22rem]"
        >
          {hint ? (
            <p className="border-b border-outline-variant/60 px-3 py-1.5 text-[11px] text-on-surface-variant">
              {hint}
            </p>
          ) : null}
          {hits.map((drug) => (
            <button
              key={drug.id ?? `${drug.commercial_name_en}-${drug.manufacturer}`}
              type="button"
              role="option"
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-start hover:bg-primary-fixed/40"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(drug)}
            >
              <span className="text-sm font-semibold text-on-surface">
                {lang === 'ar' && drug.commercial_name_ar
                  ? drug.commercial_name_ar
                  : drug.commercial_name_en}
              </span>
              <span className="line-clamp-1 text-[11px] text-on-surface-variant">
                {drug.scientific_name ?? '—'}
                {drug.manufacturer ? ` · ${drug.manufacturer}` : ''}
                {drug.price_egp != null
                  ? ` · ${Number(drug.price_egp).toLocaleString()} ${t('secretary.currency')}`
                  : ''}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
