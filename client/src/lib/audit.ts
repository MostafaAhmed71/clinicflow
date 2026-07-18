import { supabase } from './supabase'

export async function writeAuditLog(
  action: string,
  entityType: string,
  entityId?: string | null,
  meta: Record<string, unknown> = {},
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.tenant_id) return

  await supabase.from('audit_log').insert({
    tenant_id: profile.tenant_id,
    user_id: user.id,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    meta,
  })
}
