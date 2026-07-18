import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { UserProfile } from '../types/database'

const MODULES = [
  'patients',
  'appointments',
  'consultation',
  'billing',
  'reports',
  'settings',
  'templates',
] as const

type ModuleKey = (typeof MODULES)[number]

type PermissionRow = {
  id?: string
  user_id: string
  module: ModuleKey
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
}

export function PermissionsPage() {
  const { t } = useTranslation()
  const { tenant, user } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [rows, setRows] = useState<PermissionRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canManage =
    user?.role === 'doctor' || user?.role === 'clinic_manager' || user?.role === 'super_admin'

  useEffect(() => {
    async function loadUsers() {
      if (!tenant) return
      const { data, error: err } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('full_name')
      if (err) setError(err.message)
      const list = (data as UserProfile[]) ?? []
      setUsers(list)
      if (!selectedUserId && list[0]) setSelectedUserId(list[0].id)
    }
    void loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id])

  useEffect(() => {
    async function loadPerms() {
      if (!tenant || !selectedUserId) return
      const { data, error: err } = await supabase
        .from('permissions')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('user_id', selectedUserId)
      if (err) {
        setError(err.message)
        return
      }
      const existing = (data as PermissionRow[]) ?? []
      const byModule = new Map(existing.map((r) => [r.module, r]))
      setRows(
        MODULES.map((module) => {
          const found = byModule.get(module)
          return (
            found ?? {
              user_id: selectedUserId,
              module,
              can_view: true,
              can_edit: module !== 'reports' && module !== 'billing',
              can_delete: false,
            }
          )
        }),
      )
    }
    void loadPerms()
  }, [tenant?.id, selectedUserId])

  async function save() {
    if (!tenant || !selectedUserId || !canManage) return
    setBusy(true)
    setError(null)
    setMessage(null)

    const payload = rows.map((r) => ({
      tenant_id: tenant.id,
      user_id: selectedUserId,
      module: r.module,
      can_view: r.can_view,
      can_edit: r.can_edit,
      can_delete: r.can_delete,
    }))

    const { error: err } = await supabase.from('permissions').upsert(payload, {
      onConflict: 'user_id,module',
    })
    if (err) setError(err.message)
    else setMessage(t('settings.saved'))
    setBusy(false)
  }

  if (!canManage) {
    return <p className="text-on-surface-variant">{t('permissions.forbidden')}</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('permissions.title')}</h1>

      <label className="block max-w-md text-sm">
        <span className="mb-1 block text-on-surface-variant">{t('permissions.user')}</span>
        <select
          className="cf-input"
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name} ({u.role})
            </option>
          ))}
        </select>
      </label>

      {error && <p className="text-sm text-error">{error}</p>}
      {message && <p className="text-sm text-primary">{message}</p>}

      <div className="cf-card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-primary-fixed text-primary">
            <tr>
              <th className="px-3 py-2 text-start">{t('permissions.module')}</th>
              <th className="px-3 py-2 text-start">{t('permissions.view')}</th>
              <th className="px-3 py-2 text-start">{t('permissions.edit')}</th>
              <th className="px-3 py-2 text-start">{t('permissions.delete')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.module} className="border-t border-outline-variant">
                <td className="px-3 py-2">{t(`permissions.modules.${row.module}`)}</td>
                {(['can_view', 'can_edit', 'can_delete'] as const).map((field) => (
                  <td key={field} className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={row[field]}
                      onChange={(e) =>
                        setRows((list) =>
                          list.map((r, i) => (i === idx ? { ...r, [field]: e.target.checked } : r)),
                        )
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="cf-btn cf-btn-primary"
      >
        {busy ? t('common.loading') : t('patients.save')}
      </button>
    </div>
  )
}
