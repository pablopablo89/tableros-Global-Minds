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
// Sin key (ej. build local) NO falla: deja los snapshots ya commiteados.
if (!KEY) { console.warn('NODS_API_KEY ausente → uso snapshots existentes (sin refrescar).'); process.exit(0) }

const now = new Date()

async function get(ruta, params = {}) {
  const url = new URL(BASE + ruta)
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v)
  const r = await fetch(url, { headers: { 'X-API-Key': KEY, Accept: 'application/json' } })
  if (!r.ok) throw new Error(`${ruta} → ${r.status}`)
  const j = await r.json()
  return j.data || j
}

// Matrículas resiliente: si la llamada completa falla (la API de NODS a veces
// devuelve 500 cuando un mes tiene un registro roto), reintenta año por año y,
// si un año falla, mes por mes; concatena lo que sí devuelve (dedup por `clave`).
async function getMatriculas(c) {
  try { return await get(`/matriculas/${c}`) }
  catch (e) { console.warn(`  ⚠ /matriculas/${c} completo falló (${e.message}); reintento por año/mes`) }
  const Y = now.getFullYear()
  const out = []
  const seen = new Set()
  const push = (arr) => { for (const m of arr) { const k = m.clave || `${m.programa}|${m.correo}|${m.fecha_de_pago}`; if (!seen.has(k)) { seen.add(k); out.push(m) } } }
  for (const anio of [Y - 1, Y]) {
    try { push(await get(`/matriculas/${c}`, { anio })); continue } catch {}
    for (let mes = 1; mes <= 12; mes++) {
      try { push(await get(`/matriculas/${c}`, { anio, mes })) }
      catch { console.warn(`     · matrículas ${anio}-${String(mes).padStart(2, '0')} no disponibles (API 500)`) }
    }
  }
  return out
}

const outDir = path.join(__dirname, '..', 'public', 'snapshots')
fs.mkdirSync(outDir, { recursive: true })

for (const cfg of CUENTAS) {
 try {
  const c = cfg.cuenta
  console.log(`\n== ${cfg.nombre} (${c}) ==`)
  // matriculas y consulta_base: base COMPLETA (sin filtro) para totales exactos.
  // meta: acotado al mes en curso (es enorme) → cubre la inversión reciente.
  const [matriculas, consultaBase, objetivos, meta] = await Promise.all([
    getMatriculas(c),
    get(`/consulta_base/${c}`),
    get(`/objetivos/${c}`),
    get(`/meta/${c}`, { anio: now.getFullYear(), mes: now.getMonth() + 1 }).catch(() => []),
  ])
  console.log(`  matriculas=${matriculas.length} leads=${consultaBase.length} objetivos=${objetivos.length} meta=${meta.length}`)
  const model = aggregate({ matriculas, consultaBase, objetivos, meta }, cfg)
  model.actualizado = now.toISOString()
  const outPath = path.join(outDir, `${cfg.id}.json`)
  // Guardia anti-regresión: si las matrículas obtenidas caen respecto al snapshot
  // anterior (típico cuando la API no puede servir el mes en curso), NO piso los
  // datos buenos — dejo el snapshot previo y se auto-recupera cuando la API sane.
  let prev = null
  try { prev = JSON.parse(fs.readFileSync(outPath, 'utf8')) } catch {}
  if (prev && model.cobertura.matriculas < (prev.cobertura?.matriculas || 0) * 0.98) {
    console.warn(`  ⚠ matrículas bajarían de ${prev.cobertura.matriculas} a ${model.cobertura.matriculas} (la API no sirve el mes en curso) → mantengo snapshot anterior`)
  } else {
    fs.writeFileSync(outPath, JSON.stringify(model))
    console.log(`  ✓ snapshot: funnel ${model.funnel.leadsTotales} leads, ${model.funnel.matriculados} matrículas`)
  }
 } catch (e) {
  console.error(`  ✗ ${cfg.nombre}: ${e.message} → mantengo snapshot anterior`)
 }
}
console.log('\nListo.')
