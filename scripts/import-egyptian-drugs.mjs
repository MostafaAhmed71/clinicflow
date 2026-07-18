/**
 * Import Egyptian drug database into Supabase.
 * Source (CC0): https://github.com/karem505/egyptian-drug-database
 *
 * Usage:
 *   set SUPABASE_URL=https://xxxx.supabase.co
 *   set SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   node scripts/import-egyptian-drugs.mjs
 *
 * Optional:
 *   set DRUGS_CSV_URL=...   (override CSV URL)
 *   set DRUGS_BATCH=500
 */

import { createClient } from '../client/node_modules/@supabase/supabase-js/dist/index.mjs'
import { createReadStream, existsSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CSV_URL =
  process.env.DRUGS_CSV_URL ??
  'https://raw.githubusercontent.com/karem505/egyptian-drug-database/main/data/egyptian-drugs.csv'

const BATCH = Number(process.env.DRUGS_BATCH ?? 400)
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

function parseCsvLine(line) {
  const out = []
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

function toPrice(v) {
  if (v == null || v === '' || v === '—') return null
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

async function downloadCsv() {
  const local = join(tmpdir(), 'egyptian-drugs.csv')
  console.log('Downloading', CSV_URL)
  const res = await fetch(CSV_URL)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  const text = await res.text()
  writeFileSync(local, text, 'utf8')
  console.log('Saved', local, `(${(text.length / 1024 / 1024).toFixed(2)} MB)`)
  return local
}

async function importFile(path) {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity })
  let header = null
  let batch = []
  let total = 0
  let skipped = 0

  async function flush() {
    if (!batch.length) return
    const { error } = await supabase.from('egyptian_drugs').insert(batch)
    if (error) throw new Error(error.message)
    total += batch.length
    process.stdout.write(`\rImported ${total}…`)
    batch = []
  }

  for await (const line of rl) {
    if (!line.trim()) continue
    if (!header) {
      header = parseCsvLine(line).map((h) => h.trim())
      continue
    }
    const cols = parseCsvLine(line)
    const row = Object.fromEntries(header.map((h, i) => [h, cols[i] ?? '']))
    const commercial_name_en = (row.commercial_name_en ?? '').trim()
    if (!commercial_name_en) {
      skipped++
      continue
    }
    batch.push({
      commercial_name_en,
      commercial_name_ar: (row.commercial_name_ar ?? '').trim() || null,
      scientific_name: (row.scientific_name ?? '').trim() || null,
      manufacturer: (row.manufacturer ?? '').trim() || null,
      drug_class: (row.drug_class ?? '').trim() || null,
      route: (row.route ?? '').trim() || null,
      price_egp: toPrice(row.price_egp),
    })
    if (batch.length >= BATCH) await flush()
  }
  await flush()
  console.log(`\nDone. Imported ${total} drugs (skipped ${skipped}).`)
}

async function main() {
  const { count, error } = await supabase
    .from('egyptian_drugs')
    .select('*', { count: 'exact', head: true })
  if (error) {
    console.error('Table check failed — run migration 014_egyptian_drugs.sql first.')
    console.error(error.message)
    process.exit(1)
  }
  if ((count ?? 0) > 0) {
    console.log(`Table already has ${count} rows. Truncating before re-import…`)
    const { error: delErr } = await supabase.from('egyptian_drugs').delete().neq('id', 0)
    if (delErr) {
      console.error('Could not clear table:', delErr.message)
      console.error('Clear manually in SQL: truncate public.egyptian_drugs restart identity;')
      process.exit(1)
    }
  }

  const path = existsSync(process.env.DRUGS_CSV_PATH ?? '')
    ? process.env.DRUGS_CSV_PATH
    : await downloadCsv()
  await importFile(path)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
