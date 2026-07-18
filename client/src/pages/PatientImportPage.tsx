import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { writeAuditLog } from '../lib/audit'
import { useAuth } from '../hooks/useAuth'

const TARGET_FIELDS = [
  'full_name',
  'phone',
  'national_id',
  'birth_date',
  'gender',
  'occupation',
  'address',
  'marital_status',
  'blood_type',
  'insurance_provider',
  'emergency_contact_name',
  'emergency_contact_phone',
] as const

type TargetField = (typeof TARGET_FIELDS)[number]
type Step = 'upload' | 'map' | 'preview' | 'done'

export function PatientImportPage() {
  const { t } = useTranslation()
  const { tenant } = useAuth()
  const [step, setStep] = useState<Step>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = useState<Record<TargetField, string>>(() =>
    Object.fromEntries(TARGET_FIELDS.map((f) => [f, ''])) as Record<TargetField, string>,
  )
  const [result, setResult] = useState<{ imported: number; failed: { row: number; error: string }[] } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const previewRows = useMemo(() => rows.slice(0, 5), [rows])

  function onFile(file: File) {
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target?.result
      if (!data) return
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      if (!json.length) {
        setError('Empty file')
        return
      }
      const cols = Object.keys(json[0])
      setHeaders(cols)
      setRows(json)
      const auto: Record<TargetField, string> = { ...mapping }
      for (const field of TARGET_FIELDS) {
        const hit = cols.find((c) => c.toLowerCase().replace(/\s+/g, '_') === field)
        auto[field] = hit ?? ''
      }
      if (!auto.full_name) {
        const nameCol = cols.find((c) => /name|اسم/i.test(c))
        if (nameCol) auto.full_name = nameCol
      }
      setMapping(auto)
      setStep('map')
    }
    reader.readAsArrayBuffer(file)
  }

  function mappedRow(raw: Record<string, unknown>) {
    const out: Record<string, unknown> = {}
    for (const field of TARGET_FIELDS) {
      const source = mapping[field]
      if (source && raw[source] !== undefined && raw[source] !== '') {
        out[field] = String(raw[source]).trim()
      }
    }
    return out
  }

  async function runImport() {
    if (!tenant) return
    setBusy(true)
    setError(null)
    const failed: { row: number; error: string }[] = []
    let imported = 0

    for (let i = 0; i < rows.length; i++) {
      const mapped = mappedRow(rows[i])
      if (!mapped.full_name || typeof mapped.full_name !== 'string') {
        failed.push({ row: i + 1, error: 'Missing full_name' })
        continue
      }

      const gender =
        mapped.gender === 'male' || mapped.gender === 'female' || mapped.gender === 'other'
          ? mapped.gender
          : null

      const { data, error: err } = await supabase
        .from('patients')
        .insert({
          tenant_id: tenant.id,
          full_name: mapped.full_name as string,
          phone: (mapped.phone as string) || null,
          national_id: (mapped.national_id as string) || null,
          birth_date: (mapped.birth_date as string) || null,
          gender,
          occupation: (mapped.occupation as string) || null,
          address: (mapped.address as string) || null,
          marital_status: (mapped.marital_status as string) || null,
          blood_type: (mapped.blood_type as string) || null,
          insurance_provider: (mapped.insurance_provider as string) || null,
          emergency_contact_name: (mapped.emergency_contact_name as string) || null,
          emergency_contact_phone: (mapped.emergency_contact_phone as string) || null,
        })
        .select('id')
        .single()

      if (err || !data) {
        failed.push({ row: i + 1, error: err?.message ?? 'Insert failed' })
        continue
      }

      await supabase.from('medical_history').insert({
        patient_id: data.id,
        tenant_id: tenant.id,
      })
      imported += 1
    }

    await writeAuditLog('import', 'patients', null, { imported, failed: failed.length })
    setResult({ imported, failed })
    setStep('done')
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/patients" className="text-sm text-primary underline">
        ← {t('patients.title')}
      </Link>
      <h1 className="cf-page-title">{t('import.title')}</h1>

      {error && <p className="text-sm text-error">{error}</p>}

      {step === 'upload' && (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant bg-white px-6 py-12">
          <span className="mb-2 text-on-surface-variant">{t('import.upload')}</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onFile(file)
            }}
          />
        </label>
      )}

      {step === 'map' && (
        <div className="cf-card space-y-3 p-4">
          <h2 className="font-medium">{t('import.mapColumns')}</h2>
          {TARGET_FIELDS.map((field) => (
            <label key={field} className="grid grid-cols-2 items-center gap-2 text-sm">
              <span>{field === 'full_name' ? `${field} *` : field}</span>
              <select
                className="rounded-lg border border-outline-variant px-2 py-1.5"
                value={mapping[field]}
                onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
              >
                <option value="">{t('import.skip')}</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            type="button"
            className="cf-btn cf-btn-primary"
            onClick={() => setStep('preview')}
            disabled={!mapping.full_name}
          >
            {t('import.preview')}
          </button>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-3">
          <div className="cf-card overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  {TARGET_FIELDS.filter((f) => mapping[f]).map((f) => (
                    <th key={f} className="px-2 py-2 text-start">
                      {f}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => {
                  const mapped = mappedRow(row)
                  return (
                    <tr key={idx} className="border-t border-outline-variant">
                      {TARGET_FIELDS.filter((f) => mapping[f]).map((f) => (
                        <td key={f} className="px-2 py-2">
                          {String(mapped[f] ?? '')}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-outline-variant px-4 py-2"
              onClick={() => setStep('map')}
            >
              {t('import.back')}
            </button>
            <button
              type="button"
              disabled={busy}
              className="cf-btn cf-btn-primary"
              onClick={() => void runImport()}
            >
              {busy ? t('common.loading') : t('import.run')}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="cf-card p-6">
          <p className="text-primary">{t('import.success', { count: result.imported })}</p>
          <p className="text-error">{t('import.failed', { count: result.failed.length })}</p>
          {result.failed.length > 0 && (
            <ul className="mt-3 max-h-48 overflow-auto text-sm text-on-surface-variant">
              {result.failed.slice(0, 50).map((f) => (
                <li key={f.row}>
                  Row {f.row}: {f.error}
                </li>
              ))}
            </ul>
          )}
          <Link to="/patients" className="mt-4 inline-block text-primary underline">
            {t('patients.title')}
          </Link>
        </div>
      )}
    </div>
  )
}
