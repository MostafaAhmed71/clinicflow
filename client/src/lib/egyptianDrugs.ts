/**
 * Egyptian drug catalog helpers.
 * Dataset: https://github.com/karem505/egyptian-drug-database (CC0)
 */

export type EgyptianDrug = {
  id?: number
  commercial_name_en: string
  commercial_name_ar: string | null
  scientific_name: string | null
  manufacturer: string | null
  drug_class: string | null
  route: string | null
  price_egp: number | null
}

const CSV_URL =
  'https://raw.githubusercontent.com/karem505/egyptian-drug-database/main/data/egyptian-drugs.csv'

let cache: EgyptianDrug[] | null = null
let loading: Promise<EgyptianDrug[]> | null = null

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

function toPrice(v: string | undefined): number | null {
  if (v == null || v === '' || v === '—') return null
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

async function loadRemoteCatalog(): Promise<EgyptianDrug[]> {
  if (cache) return cache
  if (loading) return loading
  loading = (async () => {
    const res = await fetch(CSV_URL)
    if (!res.ok) throw new Error(`Drug catalog HTTP ${res.status}`)
    const text = await res.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    const header = parseCsvLine(lines[0] ?? '').map((h) => h.trim())
    const rows: EgyptianDrug[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]!)
      const row = Object.fromEntries(header.map((h, idx) => [h, cols[idx] ?? '']))
      const commercial_name_en = (row.commercial_name_en ?? '').trim()
      if (!commercial_name_en) continue
      rows.push({
        commercial_name_en,
        commercial_name_ar: (row.commercial_name_ar ?? '').trim() || null,
        scientific_name: (row.scientific_name ?? '').trim() || null,
        manufacturer: (row.manufacturer ?? '').trim() || null,
        drug_class: (row.drug_class ?? '').trim() || null,
        route: (row.route ?? '').trim() || null,
        price_egp: toPrice(row.price_egp),
      })
    }
    cache = rows
    return rows
  })()
  try {
    return await loading
  } finally {
    loading = null
  }
}

export async function searchEgyptianDrugsClient(query: string, limit = 20): Promise<EgyptianDrug[]> {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const all = await loadRemoteCatalog()
  const scored: { drug: EgyptianDrug; score: number }[] = []
  for (const drug of all) {
    const en = drug.commercial_name_en.toLowerCase()
    const ar = (drug.commercial_name_ar ?? '').toLowerCase()
    const sci = (drug.scientific_name ?? '').toLowerCase()
    let score = -1
    if (en.startsWith(q) || ar.startsWith(q)) score = 0
    else if (sci.startsWith(q)) score = 1
    else if (en.includes(q) || ar.includes(q) || sci.includes(q)) score = 2
    if (score >= 0) scored.push({ drug, score })
  }
  scored.sort((a, b) => a.score - b.score || a.drug.commercial_name_en.localeCompare(b.drug.commercial_name_en))
  return scored.slice(0, limit).map((s) => s.drug)
}

export function formatDrugPickLabel(drug: EgyptianDrug, lang: 'ar' | 'en'): string {
  if (lang === 'ar' && drug.commercial_name_ar) {
    return drug.commercial_name_ar
  }
  return drug.commercial_name_en
}
