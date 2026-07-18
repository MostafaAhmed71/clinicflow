import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Icon } from '../components/Icon'

type SetupStep = {
  id: string
  done: boolean
  titleKey: string
  hintKey: string
  to: string
  icon: string
}

export function ClinicSetupPage() {
  const { t } = useTranslation()
  const { tenant } = useAuth()
  const [patientCount, setPatientCount] = useState(0)
  const [staffCount, setStaffCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!tenant) return
      const [{ count: patients }, { count: staff }] = await Promise.all([
        supabase
          .from('patients')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id),
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id),
      ])
      setPatientCount(patients ?? 0)
      setStaffCount(staff ?? 0)
      setLoading(false)
    }
    void load()
  }, [tenant])

  const steps: SetupStep[] = useMemo(() => {
    const hasLogo = Boolean(tenant?.logo_url)
    const hasHours =
      tenant?.working_hours != null &&
      typeof tenant.working_hours === 'object' &&
      Object.keys(tenant.working_hours).length > 0
    const hasFee = Number(tenant?.consultation_fee ?? 0) > 0
    const hasSpecialty = Boolean(tenant?.specialty && tenant.specialty !== 'general')
    const hasStamp = Boolean(tenant?.stamp_url || tenant?.doctor_signature_url)

    return [
      {
        id: 'profile',
        done: Boolean(tenant?.name && tenant?.phone),
        titleKey: 'clinicSetup.steps.profile',
        hintKey: 'clinicSetup.hints.profile',
        to: '/settings',
        icon: 'business',
      },
      {
        id: 'logo',
        done: hasLogo,
        titleKey: 'clinicSetup.steps.logo',
        hintKey: 'clinicSetup.hints.logo',
        to: '/settings',
        icon: 'palette',
      },
      {
        id: 'hours',
        done: hasHours,
        titleKey: 'clinicSetup.steps.hours',
        hintKey: 'clinicSetup.hints.hours',
        to: '/settings',
        icon: 'schedule',
      },
      {
        id: 'fee',
        done: hasFee,
        titleKey: 'clinicSetup.steps.fee',
        hintKey: 'clinicSetup.hints.fee',
        to: '/settings',
        icon: 'payments',
      },
      {
        id: 'specialty',
        done: hasSpecialty,
        titleKey: 'clinicSetup.steps.specialty',
        hintKey: 'clinicSetup.hints.specialty',
        to: '/settings',
        icon: 'stethoscope',
      },
      {
        id: 'stamp',
        done: hasStamp,
        titleKey: 'clinicSetup.steps.stamp',
        hintKey: 'clinicSetup.hints.stamp',
        to: '/settings',
        icon: 'draw',
      },
      {
        id: 'patients',
        done: patientCount > 0,
        titleKey: 'clinicSetup.steps.patients',
        hintKey: 'clinicSetup.hints.patients',
        to: '/patients/import',
        icon: 'upload_file',
      },
      {
        id: 'staff',
        done: staffCount > 1,
        titleKey: 'clinicSetup.steps.staff',
        hintKey: 'clinicSetup.hints.staff',
        to: '/settings',
        icon: 'group_add',
      },
      {
        id: 'try',
        done: false,
        titleKey: 'clinicSetup.steps.try',
        hintKey: 'clinicSetup.hints.try',
        to: '/consultation',
        icon: 'medical_services',
      },
    ]
  }, [tenant, patientCount, staffCount])

  const doneCount = steps.filter((s) => s.done).length
  const progress = Math.round((doneCount / steps.length) * 100)

  return (
    <div className="mx-auto max-w-3xl space-y-lg">
      <div className="flex flex-wrap items-start justify-between gap-md">
        <div>
          <Link to="/settings" className="mb-sm inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <Icon name="arrow_forward" className="text-base" />
            {t('nav.settings')}
          </Link>
          <h1 className="font-headline-md text-headline-md font-bold text-on-surface">
            {t('clinicSetup.title')}
          </h1>
          <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
            {t('clinicSetup.subtitle')}
          </p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest px-md py-sm text-center">
          <div className="text-2xl font-bold text-primary">{progress}%</div>
          <div className="text-xs text-outline">
            {doneCount}/{steps.length} {t('clinicSetup.done')}
          </div>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-surface-container">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>

      {loading ? (
        <p className="text-on-surface-variant">{t('common.loading')}</p>
      ) : (
        <ul className="space-y-sm">
          {steps.map((step, idx) => (
            <li key={step.id}>
              <Link
                to={step.to}
                className={`flex items-center gap-md rounded-xl border px-md py-md transition hover:border-primary ${
                  step.done
                    ? 'border-secondary/40 bg-secondary-container/20'
                    : 'border-outline-variant bg-surface-container-lowest'
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    step.done
                      ? 'bg-secondary text-on-secondary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {step.done ? <Icon name="check" /> : String(idx + 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-on-surface">{t(step.titleKey)}</div>
                  <div className="text-sm text-on-surface-variant">{t(step.hintKey)}</div>
                </div>
                <Icon name={step.icon} className="text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
