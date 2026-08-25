// Genera public/snapshots/<cuenta>.json a partir de archivos crudos de la API.
// Uso: node scripts/gen-snapshot.mjs <cuentaId> <matriculas.json> <consulta_base.json> [meta.json] [objetivos.json]
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { CUENTAS } from '../src/cuentas.js'
import { aggregate } from '../src/agg/aggregate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const [cuentaId, matPath, cbPath, metaPath, objPath] = process.argv.slice(2)

const cfg = CUENTAS.find((c) => c.id === cuentaId)
if (!cfg) { console.error('cuenta desconocida:', cuentaId); process.exit(1) }

function load(p) {
  if (!p || !fs.existsSync(p)) return []
  let raw = fs.readFileSync(p, 'utf8')
  let j = JSON.parse(raw)
  // formato "persisted": [{ type:'text', text:'{...}' }]
  if (Array.isArray(j) && j[0] && j[0].type === 'text' && typeof j[0].text === 'string') {
    j = JSON.parse(j[0].text)
  }
  return j.data || j
}

const matriculas = load(matPath)
const consultaBase = load(cbPath)
const meta = load(metaPath)
const objetivos = load(objPath)

console.log(`[${cuentaId}] matriculas=${matriculas.length} leads=${consultaBase.length} meta=${meta.length} objetivos=${objetivos.length}`)

const model = aggregate({ matriculas, consultaBase, objetivos, meta }, cfg)

const outDir = path.join(__dirname, '..', 'public', 'snapshots')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, `${cuentaId}.json`)
fs.writeFileSync(outFile, JSON.stringify(model))
console.log('escrito:', outFile, '·', (fs.statSync(outFile).size / 1024).toFixed(1), 'KB')

// resumen de calibración
console.log('funnel:', JSON.stringify(model.funnel))
console.log('segmentos:', model.segmentos.map((s) => `${s.nombre}: leads ${s.leads}, mat ${s.matriculados}`).join(' | '))
console.log('programas:', model.programas.length, '· cohortes:', model.cohortes.join(', '))
console.log('ciudades top:', model.ciudades.slice(0, 5).map((c) => `${c.ciudad} ${c.matriculados}`).join(', '))
console.log('ticket:', model.ticket.map((t) => `${t.tipo} ${Math.round(t.valor)}`).join(', '))
console.log('metas:', JSON.stringify(model.metas.leads), JSON.stringify(model.metas.matriculas))
console.log('daily matriculas puntos:', model.daily.matriculas.length, '· leads puntos:', model.daily.leads.length)
