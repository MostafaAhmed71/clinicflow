import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { endOfLocalDay, isSameLocalDay, startOfLocalDay } from '../lib/clinicDay'
import { useAppointmentsLive } from './useAppointmentsLive'
import type { Appointment } from '../types/clinic'

export function useDeskCounts(tenantId: string | undefined) {
  const [waiting, setWaiting] = useState(0)
  const [unpaid, setUnpaid] = useState(0)

  const load = useCallback(async () => {
    if (!tenantId) {
      setWaiting(0)
      setUnpaid(0)
      return
    }
    const from = startOfLocalDay()
    from.setDate(from.getDate() - 1)
    const to = endOfLocalDay()

    const { data } = await supabase
      .from('appointments')
      .select('status, payment_status, scheduled_at, created_at')
      .eq('tenant_id', tenantId)
      .gte('scheduled_at', from.toISOString())
      .lte('scheduled_at', to.toISOString())

    const today = startOfLocalDay()
    const rows = ((data as Appointment[]) ?? []).filter(
      (a) => isSameLocalDay(a.scheduled_at, today) || isSameLocalDay(a.created_at, today),
    )

    setWaiting(rows.filter((a) => a.status === 'waiting').length)
    setUnpaid(
      rows.filter(
        (a) =>
          a.status === 'done' &&
          (a.payment_status ?? 'unpaid') !== 'paid' &&
          a.payment_status !== 'waived',
      ).length,
    )
  }, [tenantId])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30000)
    return () => window.clearInterval(timer)
  }, [load])

  useAppointmentsLive(tenantId, () => {
    void load()
  })

  return { waiting, unpaid, reload: load }
}
