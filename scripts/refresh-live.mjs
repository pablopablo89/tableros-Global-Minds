// Refresco en vivo: trae los datos crudos de la API de NODS (Railway), los agrega
// y reescribe public/snapshots/<cuenta>.json. Pensado para correr en GitHub Actions
// (diario) o local. La API key va por env NODS_API_KEY (nunca en el repo).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { CUENTAS } from '../src/cuentas.js'
import { aggregate } from '../src/agg/aggregate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.env.NODS_API_BASE || 'https://apinods-production.up.railway.app').replace(/\/mcp\/?$/, '')
const KEY = process.env.NODS_API_KEY
if (!KEY) { console.error('Falta NODS_API_KEY'); process.exit(1) }

const now = new Date()

async function get(ruta, params = {}) {
  const url = new URL(BASE + ruta)
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v)
  const r = await fetch(url, { headers: { 'X-API-Key': KEY, Accept: 'application/json' } })
  if (!r.ok) throw new Error(`${ruta} → ${r.status}`)
  const j = await r.json()
  return j.data || j
}

const outDir = path.join(__dirname, '..', 'public', 'snapshots')
fs.mkdirSync(outDir, { recursive: true })

for (const cfg of CUENTAS) {
  const c = cfg.cuenta
  console.log(`\n== ${cfg.nombre} (${c}) ==`)
  // matriculas y consulta_base: base COMPLETA (sin filtro) para totales exactos.
  // meta: acotado al mes en curso (es enorme) → cubre la inversión reciente.
  const [matriculas, consultaBase, objetivos, meta] = await Promise.all([
    get(`/matriculas/${c}`),
    get(`/consulta_base/${c}`),
    get(`/objetivos/${c}`),
    get(`/meta/${c}`, { anio: now.getFullYear(), mes: now.getMonth() + 1 }).catch(() => []),
  ])
  console.log(`  matriculas=${matriculas.length} leads=${consultaBase.length} objetivos=${objetivos.length} meta=${meta.length}`)
  const model = aggregate({ matriculas, consultaBase, objetivos, meta }, cfg)
  model.actualizado = now.toISOString()
  fs.writeFileSync(path.join(outDir, `${cfg.id}.json`), JSON.stringify(model))
  console.log(`  ✓ snapshot: funnel ${model.funnel.leadsTotales} leads, ${model.funnel.matriculados} matrículas`)
}
console.log('\nListo.')
