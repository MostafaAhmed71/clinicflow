import type { Appointment } from '../types/clinic'

/** Distinct badge classes: waiting / with doctor / done must be visually different. */
export function appointmentStatusBadgeClass(status: Appointment['status']): string {
  switch (status) {
    case 'waiting':
      return 'cf-badge cf-badge-status-waiting'
    case 'with_doctor':
      return 'cf-badge cf-badge-status-doctor'
    case 'done':
      return 'cf-badge cf-badge-status-done'
    case 'no_show':
      return 'cf-badge cf-badge-danger'
    case 'cancelled':
      return 'cf-badge cf-badge-muted'
    default:
      return 'cf-badge cf-badge-muted'
  }
}
