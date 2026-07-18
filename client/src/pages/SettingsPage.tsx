import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import { StaffInvitesPanel } from '../components/StaffInvitesPanel'
import { Icon } from '../components/Icon'
import type { Tenant } from '../types/database'
import { SPECIALTY_IDS } from '../lib/specialtyPacks'

const DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const

type WorkingHours = Record<string, { open: string; close: string; closed: boolean }>

function defaultHours(): WorkingHours {
  return Object.fromEntries(
    DAYS.map((d) => [d, { open: '09:00', close: '17:00', closed: d === 'fri' }]),
  )
}

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { tenant, refreshProfile } = useAuth()
  const { canEdit } = usePermissions()
  const [form, setForm] = useState<Partial<Tenant>>({})
  const [hours, setHours] = useState<WorkingHours>(defaultHours())
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const editable = canEdit('settings')

  useEffect(() => {
    if (!tenant) return
    setForm(tenant)
    const wh = tenant.working_hours as WorkingHours | null
    if (wh && typeof wh === 'object' && Object.keys(wh).length) {
      setHours({ ...defaultHours(), ...wh })
    }
  }, [tenant])

  async function uploadBrandImage(file: File, kind: 'logo' | 'stamp' | 'signature') {
    if (!tenant) return
    setBusy(true)
    setError(null)
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${tenant.id}/${kind}.${ext}`
    const { error: upErr } = await supabase.storage.from('logos').upload(path, file, {
      upsert: true,
      contentType: file.type,
    })
    if (upErr) {
      setError(upErr.message)
      setBusy(false)
      return
    }
    const { data } = supabase.storage.from('logos').getPublicUrl(path)
    const url = `${data.publicUrl}?t=${Date.now()}`
    const column =
      kind === 'logo' ? 'logo_url' : kind === 'stamp' ? 'stamp_url' : 'doctor_signature_url'
    const { error: err } = await supabase
      .from('tenants')
      .update({ [column]: url })
      .eq('id', tenant.id)
    if (err) setError(err.message)
    else {
      setForm((f) => ({ ...f, [column]: url }))
      await refreshProfile()
      setMessage(t('settings.saved'))
    }
    setBusy(false)
  }

  async function uploadLogo(file: File) {
    await uploadBrandImage(file, 'logo')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!tenant || !editable) return
    setBusy(true)
    setError(null)
    setMessage(null)

    const desiredSpecialty = form.specialty ?? 'general'

    // Persist specialty first — never silently drop it on fallback
    {
      const { data: specialtyRow, error: specialtyErr } = await supabase
        .from('tenants')
        .update({ specialty: desiredSpecialty })
        .eq('id', tenant.id)
        .select('id, specialty')
        .maybeSingle()

      if (specialtyErr) {
        const msg = specialtyErr.message
        const needsMigration =
          /specialty/i.test(msg) || /schema cache/i.test(msg) || /column .* does not exist/i.test(msg)
        setError(needsMigration ? t('settings.specialtyMigrationRequired') : msg)
        setBusy(false)
        return
      }

      if (!specialtyRow) {
        setError(t('settings.saveBlocked'))
        setBusy(false)
        return
      }

      if ((specialtyRow.specialty ?? 'general') !== desiredSpecialty) {
        setError(t('settings.specialtyNotSaved'))
        setBusy(false)
        return
      }

      setForm((f) => ({ ...f, specialty: specialtyRow.specialty ?? desiredSpecialty }))
    }

    const payload: Record<string, unknown> = {
      name: form.name,
      phone: form.phone,
      address: form.address,
      logo_url: form.logo_url,
      working_hours: hours,
      default_language: form.default_language,
      print_format: form.print_format,
      consultation_fee: form.consultation_fee,
      follow_up_fee: form.follow_up_fee ?? 0,
      tax_rate: form.tax_rate,
      stamp_url: form.stamp_url ?? null,
      doctor_signature_url: form.doctor_signature_url ?? null,
    }

    let warnings: string[] = []
    let { data: saved, error: err } = await supabase
      .from('tenants')
      .update(payload)
      .eq('id', tenant.id)
      .select('*')
      .maybeSingle()

    // Peel optional columns from 008/011 if those migrations are missing
    if (err) {
      const optionalKeys = ['follow_up_fee', 'stamp_url', 'doctor_signature_url'] as const
      let remaining = { ...payload }
      for (const key of optionalKeys) {
        if (!err) break
        if (!(key in remaining)) continue
        if (!new RegExp(key, 'i').test(err.message) && !/schema cache|column/i.test(err.message)) {
          continue
        }
        delete remaining[key]
        warnings.push(key)
        const retry = await supabase
          .from('tenants')
          .update(remaining)
          .eq('id', tenant.id)
          .select('*')
          .maybeSingle()
        err = retry.error
        saved = retry.data
      }

      // Last resort: core fields only (specialty already saved above)
      if (err) {
        const {
          follow_up_fee: _f,
          stamp_url: _st,
          doctor_signature_url: _sig,
          ...basic
        } = payload
        const retry = await supabase
          .from('tenants')
          .update(basic)
          .eq('id', tenant.id)
          .select('*')
          .maybeSingle()
        err = retry.error
        saved = retry.data
        if (!err) warnings = ['follow_up_fee', 'stamp_url', 'doctor_signature_url']
      }
    }

    if (err) {
      setError(err.message)
    } else if (!saved) {
      setError(t('settings.saveBlocked'))
    } else {
      setForm((f) => ({
        ...f,
        ...saved,
        specialty: saved.specialty ?? desiredSpecialty,
      }))
      if (form.default_language) await i18n.changeLanguage(form.default_language)
      await refreshProfile()
      setMessage(
        warnings.length
          ? `${t('settings.saved')} — ${t('settings.migrationHint')}`
          : t('settings.saved'),
      )
    }
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-lg">
      <div className="flex flex-wrap items-start justify-between gap-md">
        <div>
          <h1 className="font-headline-md text-headline-md font-bold text-on-surface">{t('settings.title')}</h1>
          <p className="mt-xs font-body-md text-body-md text-on-surface-variant">{form.name ?? tenant?.name}</p>
        </div>
        <Link to="/settings/setup" className="cf-btn cf-btn-primary">
          <Icon name="checklist" />
          {t('clinicSetup.openButton')}
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-lg">
        {/* Branding — stitch 6 */}
        <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-primary">
          <Icon name="palette" className="text-primary" />
          {t('onboarding.steps.branding')}
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          {form.logo_url ? (
            <img
              src={form.logo_url}
              alt="logo"
              className="h-16 w-16 rounded-xl border border-outline-variant object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-outline-variant text-xs text-on-surface-variant">
              Logo
            </div>
          )}
          <label className="block">
            <span className="cf-label">{t('settings.logo')}</span>
            <input
              type="file"
              accept="image/*"
              disabled={!editable || busy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void uploadLogo(file)
              }}
            />
          </label>
        </div>
        <h2 className="flex items-center gap-2 pt-2 font-semibold text-primary">
          <Icon name="business" className="text-primary" />
          {t('onboarding.steps.profile')}
        </h2>

        <label className="block">
          <span className="cf-label">{t('onboarding.clinicName')}</span>
          <input
            className="cf-input"
            value={form.name ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            disabled={!editable}
          />
        </label>
        <label className="block">
          <span className="cf-label">{t('onboarding.phone')}</span>
          <input
            className="cf-input"
            value={form.phone ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            disabled={!editable}
          />
        </label>
        <label className="block">
          <span className="cf-label">{t('onboarding.address')}</span>
          <input
            className="cf-input"
            value={form.address ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            disabled={!editable}
          />
        </label>
        </section>

        {/* Working hours — stitch 10 */}
        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
          <h2 className="mb-md flex items-center gap-2 font-semibold text-primary">
            <Icon name="schedule" className="text-primary" />
            {t('settings.workingHours')}
          </h2>
          <div className="space-y-2">
            {DAYS.map((day) => (
              <div key={day} className="grid grid-cols-[4rem_1fr_1fr_auto] items-center gap-2 text-sm">
                <span>{t(`settings.days.${day}`)}</span>
                <input
                  type="time"
                  disabled={!editable || hours[day]?.closed}
                  className="cf-input px-2 py-1"
                  value={hours[day]?.open ?? '09:00'}
                  onChange={(e) =>
                    setHours((h) => ({ ...h, [day]: { ...h[day], open: e.target.value } }))
                  }
                />
                <input
                  type="time"
                  disabled={!editable || hours[day]?.closed}
                  className="cf-input px-2 py-1"
                  value={hours[day]?.close ?? '17:00'}
                  onChange={(e) =>
                    setHours((h) => ({ ...h, [day]: { ...h[day], close: e.target.value } }))
                  }
                />
                <label className="flex items-center gap-1 text-xs text-on-surface-variant">
                  <input
                    type="checkbox"
                    disabled={!editable}
                    checked={!!hours[day]?.closed}
                    onChange={(e) =>
                      setHours((h) => ({ ...h, [day]: { ...h[day], closed: e.target.checked } }))
                    }
                  />
                  {t('settings.closed')}
                </label>
              </div>
            ))}
          </div>
        </section>

        {/* Specialty + stamp */}
        <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold text-primary">
            <Icon name="stethoscope" className="text-primary" />
            {t('settings.specialtyTitle')}
          </h2>
          <p className="text-sm text-on-surface-variant">{t('settings.specialtyHint')}</p>
          <label className="block">
            <span className="cf-label">{t('settings.specialty')}</span>
            <select
              className="cf-input"
              value={form.specialty ?? 'general'}
              disabled={!editable}
              onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
            >
              {SPECIALTY_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(`specialty.${id}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="cf-label">{t('settings.stamp')}</span>
              {form.stamp_url ? (
                <img src={form.stamp_url} alt="" className="mb-2 h-16 object-contain" />
              ) : null}
              <input
                type="file"
                accept="image/*"
                disabled={!editable || busy}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadBrandImage(file, 'stamp')
                }}
              />
            </div>
            <div>
              <span className="cf-label">{t('settings.signature')}</span>
              {form.doctor_signature_url ? (
                <img src={form.doctor_signature_url} alt="" className="mb-2 h-14 object-contain" />
              ) : null}
              <input
                type="file"
                accept="image/*"
                disabled={!editable || busy}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadBrandImage(file, 'signature')
                }}
              />
            </div>
          </div>
        </section>

        {/* Solo clinic mode */}
        <section className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold text-primary">
            <Icon name="person" className="text-primary" />
            {t('settings.soloTitle')}
          </h2>
          <p className="text-sm text-on-surface-variant">{t('settings.soloHint')}</p>
          <Link to="/desk" className="cf-btn cf-btn-secondary inline-flex">
            <Icon name="support_agent" />
            {t('settings.openDeskMode')}
          </Link>
        </section>

        {/* Print & fees — stitch 11 */}
        <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-primary">
          <Icon name="print" className="text-primary" />
          {t('onboarding.steps.print')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="cf-label">{t('onboarding.language')}</span>
            <select
              className="cf-input"
              value={form.default_language ?? 'ar'}
              disabled={!editable}
              onChange={(e) =>
                setForm((f) => ({ ...f, default_language: e.target.value as 'ar' | 'en' }))
              }
            >
              <option value="ar">{t('common.arabic')}</option>
              <option value="en">{t('common.english')}</option>
            </select>
          </label>
          <label className="block">
            <span className="cf-label">{t('onboarding.printFormat')}</span>
            <select
              className="cf-input"
              value={form.print_format ?? 'a4'}
              disabled={!editable}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  print_format: e.target.value as 'a4' | 'thermal' | 'both',
                }))
              }
            >
              <option value="a4">{t('onboarding.printA4')}</option>
              <option value="thermal">{t('onboarding.printThermal')}</option>
              <option value="both">{t('onboarding.printBoth')}</option>
            </select>
          </label>
          <label className="block">
            <span className="cf-label">{t('settings.consultationFee')}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              disabled={!editable}
              className="cf-input"
              value={form.consultation_fee ?? 0}
              onChange={(e) =>
                setForm((f) => ({ ...f, consultation_fee: Number(e.target.value) }))
              }
            />
          </label>
          <label className="block">
            <span className="cf-label">{t('settings.followUpFee')}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              disabled={!editable}
              className="cf-input"
              value={form.follow_up_fee ?? 0}
              onChange={(e) =>
                setForm((f) => ({ ...f, follow_up_fee: Number(e.target.value) }))
              }
            />
          </label>
          <label className="block">
            <span className="cf-label">{t('settings.taxRate')}</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              disabled={!editable}
              className="cf-input"
              value={form.tax_rate ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, tax_rate: Number(e.target.value) }))}
            />
          </label>
        </div>
        </section>

        {error && <p className="text-sm text-error">{error}</p>}
        {message && <p className="text-sm text-primary">{message}</p>}

        <div className="flex flex-wrap gap-2">
          <Link to="/settings/setup" className="cf-btn cf-btn-secondary">
            <Icon name="checklist" />
            {t('clinicSetup.openButton')}
          </Link>
          <Link to="/permissions" className="cf-btn cf-btn-ghost">
            {t('permissions.title')}
          </Link>
          <Link to="/templates" className="cf-btn cf-btn-ghost">
            {t('templates.title')}
          </Link>
          {editable && (
            <button type="submit" disabled={busy} className="cf-btn cf-btn-primary">
              {busy ? t('common.loading') : t('patients.save')}
            </button>
          )}
        </div>
      </form>

      <StaffInvitesPanel />
    </div>
  )
}
