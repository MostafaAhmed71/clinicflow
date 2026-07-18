import { useEffect, useId, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Reloads when appointments change for this tenant (insert/update/delete).
 * Falls back gracefully if Realtime is not enabled on the project yet.
 *
 * Uses a unique channel topic per hook instance so layout + page can both
 * subscribe without colliding on the same RealtimeChannel.
 */
export function useAppointmentsLive(tenantId: string | undefined, onChange: () => void) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const instanceId = useId().replace(/:/g, '')

  useEffect(() => {
    if (!tenantId) return

    const topic = `appointments-live-${tenantId}-${instanceId}`
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          onChangeRef.current()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [tenantId, instanceId])
}
