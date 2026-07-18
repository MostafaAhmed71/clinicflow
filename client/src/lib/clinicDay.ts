/** Local clinic calendar helpers (avoid UTC date-shift bugs in Egypt UTC+3). */

export function startOfLocalDay(d = new Date()) {
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  return start
}

export function endOfLocalDay(d = new Date()) {
  const end = new Date(d)
  end.setHours(23, 59, 59, 999)
  return end
}

export function localDateStr(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isSameLocalDay(iso: string | Date, day = new Date()) {
  return localDateStr(new Date(iso)) === localDateStr(day)
}

/** Parse datetime-local value as local wall time → ISO UTC. */
export function localInputToIso(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return new Date().toISOString()
  return d.toISOString()
}
