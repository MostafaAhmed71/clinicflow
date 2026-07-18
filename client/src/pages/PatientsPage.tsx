import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { writeAuditLog } from '../lib/audit'
import { useAuth } from '../hooks/useAuth'
import { BirthDateFields } from '../components/BirthDateFields'
import { Icon } from '../components/Icon'
import type { Patient } from '../types/database'

const emptyForm = {
  full_name: '',
  phone: '',
  national_id: '',
  birth_date: '',
  gender: '' as '' | 'male' | 'female' | 'other',
  occupation: '',
  address: '',
  marital_status: '',
  blood_type: '',
  insurance_provider: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
}

export function PatientsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { tenant } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [patients, setPatients] = useState<Patient[]>([])
  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(searchParams.get('new') === '1')
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowForm(true)
    const qParam = searchParams.get('q')
    if (qParam) {
      setQ(qParam)
      void load(qParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  async function load(search = q) {
    if (!tenant) return
    setLoading(true)
    setError(null)

    let query = supabase
      .from('patients')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(100)

    const term = search.trim()
    if (term) {
      const asNumber = Number(term)
      if (!Number.isNaN(asNumber) && /^\d+$/.test(term)) {
        query = query.or(
          `full_name.ilike.%${term}%,phone.ilike.%${term}%,national_id.ilike.%${term}%,file_number.eq.${asNumber}`,
        )
      } else {
        query = query.or(
          `full_name.ilike.%${term}%,phone.ilike.%${term}%,national_id.ilike.%${term}%`,
        )
      }
    }

    const { data, error: err } = await query
    if (err) setError(err.message)
    else {
      setPatients((data as Patient[]) ?? [])
      await writeAuditLog('read', 'patients', null, { search: term || null, count: data?.length ?? 0 })
    }
    setLoading(false)
  }

  useEffect(() => {
    void load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!tenant) return
    setBusy(true)
    setError(null)

    const payload = {
      tenant_id: tenant.id,
      full_name: form.full_name,
      phone: form.phone || null,
      national_id: form.national_id || null,
      birth_date: form.birth_date || null,
      gender: form.gender || null,
      occupation: form.occupation || null,
      address: form.address || null,
      marital_status: form.marital_status || null,
      blood_type: form.blood_type || null,
      insurance_provider: form.insurance_provider || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
    }

    const { data, error: err } = await supabase.from('patients').insert(payload).select('*').single()
    if (err) {
      setError(err.message)
      setBusy(false)
      return
    }

    await supabase.from('medical_history').insert({
      patient_id: data.id,
      tenant_id: tenant.id,
    })

    setForm(emptyForm)
    setShowForm(false)
    setBusy(false)
    await load()
  }

  return (
    <div className="space-y-lg">
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest px-md py-md">
        <h1 className="font-headline-md text-headline-md font-bold text-on-surface">{t('patients.title')}</h1>
        <p className="mt-xs text-sm text-on-surface-variant">{t('patients.fileHint')}</p>
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-sm">
          <p className="font-label-md text-label-md text-outline">{t('patients.title')}</p>
          <h3 className="text-2xl font-bold">{loading ? '—' : patients.length}</h3>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-sm">
          <p className="font-label-md text-label-md text-outline">{t('patients.add')}</p>
          <button type="button" onClick={() => setShowForm(true)} className="mt-sm cf-btn cf-btn-primary py-sm">
            <Icon name="person_add" />
            {t('patients.add')}
          </button>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-md shadow-sm sm:col-span-2">
          <form
            className="flex gap-sm"
            onSubmit={(e) => {
              e.preventDefault()
              void load(q)
            }}
          >
            <div className="relative flex-1">
              <Icon name="search" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-outline" />
              <input
                className="w-full rounded-full border-none bg-surface-container-low py-sm pe-md ps-10 font-label-md text-label-md outline-none focus:ring-2 focus:ring-primary/20"
                placeholder={t('patients.search')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <button type="submit" className="cf-btn cf-btn-secondary rounded-full">
              <Icon name="search" />
            </button>
            <Link to="/patients/import" className="cf-btn cf-btn-ghost rounded-full">
              <Icon name="upload_file" />
            </Link>
          </form>
        </div>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="grid gap-md rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm sm:grid-cols-2">
          <div className="flex items-center justify-between sm:col-span-2">
            <h2 className="font-title-lg text-title-lg font-bold">{t('patients.add')}</h2>
            <button
              type="button"
              className="cf-btn cf-btn-ghost"
              onClick={() => {
                setShowForm(false)
                searchParams.delete('new')
                setSearchParams(searchParams)
              }}
            >
              {t('patients.cancel')}
            </button>
          </div>
          {(
            [
              ['full_name', t('patients.fullName'), true],
              ['phone', t('patients.phone'), false],
              ['national_id', t('patients.nationalId'), false],
              ['occupation', t('patients.occupation'), false],
              ['address', t('patients.address'), false],
              ['marital_status', t('patients.maritalStatus'), false],
              ['blood_type', t('patients.bloodType'), false],
              ['insurance_provider', t('patients.insurance'), false],
              ['emergency_contact_name', t('patients.emergencyName'), false],
              ['emergency_contact_phone', t('patients.emergencyPhone'), false],
            ] as const
          ).map(([key, label, required]) => (
            <label key={key} className="block">
              <span className="cf-label">{label}</span>
              <input
                type="text"
                required={required}
                className="cf-input"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
          <div className="block">
            <span className="cf-label">{t('patients.birthDate')}</span>
            <BirthDateFields
              value={form.birth_date}
              onChange={(iso) => setForm((f) => ({ ...f, birth_date: iso }))}
            />
          </div>
          <label className="block">
            <span className="cf-label">{t('patients.gender')}</span>
            <select
              className="cf-input"
              value={form.gender}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  gender: e.target.value as '' | 'male' | 'female' | 'other',
                }))
              }
            >
              <option value="">—</option>
              <option value="male">{t('patients.male')}</option>
              <option value="female">{t('patients.female')}</option>
              <option value="other">{t('patients.other')}</option>
            </select>
          </label>
          <div className="flex items-end gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="cf-btn cf-btn-primary">
              {t('patients.save')}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="cf-btn cf-btn-ghost">
              {t('patients.cancel')}
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-low/50 px-md py-md">
          <h2 className="font-title-lg text-title-lg font-bold">{t('patients.title')}</h2>
          <span className="cf-badge cf-badge-info">{patients.length}</span>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-surface-container-low">
            <tr className="text-start font-label-md text-label-md text-on-surface-variant">
              <th className="px-md py-sm font-semibold">{t('patients.fileNumber')}</th>
              <th className="px-md py-sm font-semibold">{t('patients.fullName')}</th>
              <th className="px-md py-sm font-semibold">{t('patients.phone')}</th>
              <th className="px-md py-sm font-semibold">{t('patients.nationalId')}</th>
              <th className="px-md py-sm font-semibold">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-md py-xl text-center text-on-surface-variant">
                  {t('common.loading')}
                </td>
              </tr>
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-md py-xl text-center text-on-surface-variant">
                  {t('patients.empty')}
                </td>
              </tr>
            ) : (
              patients.map((p) => (
                <tr
                  key={p.id}
                  className="table-row-hover cursor-pointer border-t border-outline-variant"
                  onClick={() => navigate(`/patients/${p.id}`)}
                >
                  <td className="px-md py-md text-on-surface-variant">{p.file_number}</td>
                  <td className="px-md py-md">
                    <div className="flex items-center gap-sm">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed font-bold text-primary">
                        {p.full_name.charAt(0)}
                      </div>
                      <span className="font-medium">{p.full_name}</span>
                    </div>
                  </td>
                  <td className="px-md py-md">{p.phone ?? '—'}</td>
                  <td className="px-md py-md">{p.national_id ?? '—'}</td>
                  <td className="px-md py-md" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1">
                      <Link
                        className="cf-btn cf-btn-primary px-2 py-1 text-xs !text-white"
                        to={`/patients/${p.id}`}
                      >
                        <Icon name="folder_open" className="text-[16px]" />
                        {t('patients.openFile')}
                      </Link>
                      <Link
                        className="cf-btn cf-btn-secondary px-2 py-1 text-xs"
                        to={`/consultation?patientId=${p.id}`}
                      >
                        <Icon name="medical_services" className="text-[16px]" />
                        {t('consultation.start')}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
