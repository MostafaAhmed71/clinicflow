import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { printRequestList } from '../lib/print'
import { Icon } from '../components/Icon'
import { SPECIALTY_IDS, getSpecialtyPack, type ClinicSpecialty } from '../lib/specialtyPacks'
import {
  getBuiltinInstructionTemplates,
  listSpecialtyInstructionPacks,
} from '../lib/specialtyInstructionTemplates'

type RequestTemplate = {
  id: string
  tenant_id: string
  type: 'lab' | 'radiology'
  name: string
  items: string[]
  created_at: string
}

type InstructionTemplate = {
  id: string
  tenant_id: string
  name: string
  body: string
  created_at: string
}

type Tab = 'requests' | 'instructions'

export function TemplatesPage() {
  const { t } = useTranslation()
  const { tenant } = useAuth()
  const [tab, setTab] = useState<Tab>('instructions')
  const [templates, setTemplates] = useState<RequestTemplate[]>([])
  const [instructions, setInstructions] = useState<InstructionTemplate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState({
    type: 'lab' as 'lab' | 'radiology',
    name: '',
    items: '',
  })
  const [instForm, setInstForm] = useState({ name: '', body: '' })
  const [packSpecialty, setPackSpecialty] = useState<ClinicSpecialty>('general')
  const [importBusy, setImportBusy] = useState(false)

  const clinicSpecialty = getSpecialtyPack(tenant?.specialty).id

  useEffect(() => {
    setPackSpecialty(clinicSpecialty)
  }, [clinicSpecialty])

  const packTemplates = useMemo(
    () => getBuiltinInstructionTemplates(packSpecialty),
    [packSpecialty],
  )

  const allPacksCount = useMemo(
    () =>
      listSpecialtyInstructionPacks().reduce((n, p) => n + p.templates.length, 0) +
      getBuiltinInstructionTemplates('general').filter((t) => t.specialty === 'common').length,
    [],
  )

  async function loadRequests() {
    if (!tenant) return
    const { data, error: err } = await supabase
      .from('request_templates')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    setTemplates((data as RequestTemplate[]) ?? [])
  }

  async function loadInstructions() {
    if (!tenant) return
    const { data, error: err } = await supabase
      .from('instruction_templates')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
    if (err) {
      // Migration 009 not applied yet
      if (err.message.toLowerCase().includes('instruction_templates')) {
        setError(t('templates.needMigration'))
      } else {
        setError(err.message)
      }
      setInstructions([])
      return
    }
    setInstructions((data as InstructionTemplate[]) ?? [])
  }

  useEffect(() => {
    void loadRequests()
    void loadInstructions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id])

  async function onSubmitRequest(e: FormEvent) {
    e.preventDefault()
    if (!tenant) return
    setError(null)
    const items = form.items
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
    const { error: err } = await supabase.from('request_templates').insert({
      tenant_id: tenant.id,
      type: form.type,
      name: form.name,
      items,
    })
    if (err) setError(err.message)
    else {
      setForm({ type: 'lab', name: '', items: '' })
      setMessage(t('settings.saved'))
      await loadRequests()
    }
  }

  async function onSubmitInstruction(e: FormEvent) {
    e.preventDefault()
    if (!tenant) return
    setError(null)
    setMessage(null)
    const { error: err } = await supabase.from('instruction_templates').insert({
      tenant_id: tenant.id,
      name: instForm.name.trim(),
      body: instForm.body.trim(),
    })
    if (err) setError(err.message)
    else {
      setInstForm({ name: '', body: '' })
      setMessage(t('settings.saved'))
      await loadInstructions()
    }
  }

  async function removeRequest(id: string) {
    const { error: err } = await supabase.from('request_templates').delete().eq('id', id)
    if (err) setError(err.message)
    else await loadRequests()
  }

  async function removeInstruction(id: string) {
    const { error: err } = await supabase.from('instruction_templates').delete().eq('id', id)
    if (err) setError(err.message)
    else await loadInstructions()
  }

  async function importSpecialtyPack(specialty: ClinicSpecialty) {
    if (!tenant) return
    setImportBusy(true)
    setError(null)
    setMessage(null)
    const pack = getBuiltinInstructionTemplates(specialty)
    const existingNames = new Set(instructions.map((i) => i.name.trim()))
    const rows = pack
      .filter((t) => !existingNames.has(t.name.trim()))
      .map((t) => ({
        tenant_id: tenant.id,
        name: t.name,
        body: t.body,
      }))
    if (!rows.length) {
      setMessage(t('templates.importAlreadyHave'))
      setImportBusy(false)
      return
    }
    const { error: err } = await supabase.from('instruction_templates').insert(rows)
    if (err) setError(err.message)
    else {
      setMessage(t('templates.importDone', { count: rows.length }))
      await loadInstructions()
    }
    setImportBusy(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-lg">
      <div>
        <h1 className="font-headline-md text-headline-md font-bold text-on-surface">{t('templates.title')}</h1>
        <p className="mt-xs text-sm text-on-surface-variant">{t('templates.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-sm">
        <button
          type="button"
          className={`cf-btn text-sm ${tab === 'instructions' ? 'cf-btn-primary' : 'cf-btn-ghost'}`}
          onClick={() => setTab('instructions')}
        >
          <Icon name="description" />
          {t('templates.instructionsTab')}
        </button>
        <button
          type="button"
          className={`cf-btn text-sm ${tab === 'requests' ? 'cf-btn-primary' : 'cf-btn-ghost'}`}
          onClick={() => setTab('requests')}
        >
          <Icon name="science" />
          {t('templates.requestsTab')}
        </button>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}
      {message && <p className="text-sm text-primary">{message}</p>}

      {tab === 'instructions' && (
        <>
          <section className="cf-card space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-primary">{t('templates.specialtyPacksTitle')}</h2>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {t('templates.specialtyPacksHint', {
                    specialty: t(`specialty.${clinicSpecialty}`),
                    count: allPacksCount,
                  })}
                </p>
              </div>
              <button
                type="button"
                disabled={importBusy || !tenant}
                className="cf-btn cf-btn-primary text-sm"
                onClick={() => void importSpecialtyPack(clinicSpecialty)}
              >
                <Icon name="add" />
                {t('templates.importMySpecialty')}
              </button>
            </div>

            <label className="block text-sm">
              <span className="cf-label">{t('templates.browseSpecialty')}</span>
              <select
                className="cf-input"
                value={packSpecialty}
                onChange={(e) => setPackSpecialty(e.target.value as ClinicSpecialty)}
              >
                {SPECIALTY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {t(`specialty.${id}`)}
                    {id === clinicSpecialty ? ` — ${t('templates.clinicSpecialty')}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              {packTemplates.map((tpl) => (
                <details
                  key={tpl.id}
                  className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2"
                >
                  <summary className="cursor-pointer text-sm font-semibold text-on-surface">
                    {tpl.name}
                    <span className="ms-2 text-[11px] font-medium text-outline">
                      {tpl.specialty === 'common'
                        ? t('templates.commonPack')
                        : t(`specialty.${tpl.specialty}`)}
                    </span>
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap border-t border-outline-variant/60 pt-2 font-sans text-xs text-on-surface-variant">
                    {tpl.body}
                  </pre>
                </details>
              ))}
            </div>

            {packSpecialty !== clinicSpecialty ? (
              <button
                type="button"
                disabled={importBusy || !tenant}
                className="cf-btn cf-btn-secondary text-sm"
                onClick={() => void importSpecialtyPack(packSpecialty)}
              >
                {t('templates.importSelectedSpecialty', {
                  specialty: t(`specialty.${packSpecialty}`),
                })}
              </button>
            ) : null}
          </section>

          <form onSubmit={onSubmitInstruction} className="cf-card space-y-3 p-4">
            <h2 className="font-semibold text-primary">{t('templates.addInstruction')}</h2>
            <p className="text-xs text-on-surface-variant">{t('templates.instructionHint')}</p>
            <label className="block text-sm">
              <span className="cf-label">{t('templates.name')}</span>
              <input
                required
                className="cf-input"
                placeholder={t('templates.instructionNamePh')}
                value={instForm.name}
                onChange={(e) => setInstForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              <span className="cf-label">{t('templates.instructionBody')}</span>
              <textarea
                required
                rows={6}
                className="cf-input"
                placeholder={t('templates.instructionBodyPh')}
                value={instForm.body}
                onChange={(e) => setInstForm((f) => ({ ...f, body: e.target.value }))}
              />
            </label>
            <button type="submit" className="cf-btn cf-btn-primary">
              {t('templates.saveInstruction')}
            </button>
          </form>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-on-surface">{t('templates.savedCustom')}</h2>
            {instructions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-outline-variant p-lg text-center text-sm text-on-surface-variant">
                {t('templates.noInstructions')}
              </p>
            ) : (
              instructions.map((tpl) => (
                <div key={tpl.id} className="cf-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{tpl.name}</div>
                      <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-on-surface-variant">
                        {tpl.body}
                      </pre>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-error underline"
                      onClick={() => void removeInstruction(tpl.id)}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === 'requests' && (
        <>
          <form onSubmit={onSubmitRequest} className="cf-card space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-on-surface-variant">{t('templates.type')}</span>
                <select
                  className="cf-input"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'lab' | 'radiology' }))}
                >
                  <option value="lab">{t('consultation.labs')}</option>
                  <option value="radiology">{t('consultation.radiology')}</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-on-surface-variant">{t('templates.name')}</span>
                <input
                  required
                  className="cf-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-on-surface-variant">{t('consultation.onePerLine')}</span>
              <textarea
                required
                rows={5}
                className="cf-input"
                value={form.items}
                onChange={(e) => setForm((f) => ({ ...f, items: e.target.value }))}
              />
            </label>
            <button type="submit" className="cf-btn cf-btn-primary">
              {t('patients.save')}
            </button>
          </form>

          <div className="space-y-2">
            {templates.map((tpl) => (
              <div key={tpl.id} className="cf-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {tpl.name}{' '}
                      <span className="text-xs text-on-surface-variant">
                        ({tpl.type === 'lab' ? t('consultation.labs') : t('consultation.radiology')})
                      </span>
                    </div>
                    <ul className="mt-1 list-inside list-disc text-sm text-on-surface-variant">
                      {(Array.isArray(tpl.items) ? tpl.items : []).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-sm text-primary underline"
                      onClick={() =>
                        printRequestList({
                          clinicName: tenant?.name ?? 'ClinicFlow',
                          logoUrl: tenant?.logo_url,
                          clinicPhone: tenant?.phone,
                          clinicAddress: tenant?.address,
                          kind: tpl.type === 'lab' ? 'lab' : 'radiology',
                          title:
                            tpl.type === 'lab' ? t('consultation.labs') : t('consultation.radiology'),
                          items: Array.isArray(tpl.items) ? tpl.items : [],
                          format: tenant?.print_format === 'thermal' ? 'thermal' : 'a4',
                        })
                      }
                    >
                      {t('billing.print')}
                    </button>
                    <button
                      type="button"
                      className="text-sm text-error underline"
                      onClick={() => void removeRequest(tpl.id)}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
