// Vercel Serverless — modo "en vivo": trae los endpoints crudos de NODS, los
// AGREGA con el mismo módulo que los snapshots y devuelve el modelo compacto.
// Mantiene el token en el servidor y exige la clave de la app (x-app-key).
//
// Uso:  /api/nods?endpoint=agg&cuenta=anahuac_gm[&fecha_inicio=&fecha_fin=]
//
// Requiere env: NODS_API_BASE y (NODS_API_TOKEN | NODS_API_KEY) + APP_PASSWORD.
// Nota: consulta_base y meta son grandes; conviene acotar por fecha o cachear.

import { CUENTAS } from '../src/cuentas.js'
import { aggregate } from '../src/agg/aggregate.js'

const RUTA = {
  matriculas: (c) => `/matriculas/${c}`,
  consulta_base: (c) => `/consulta_base/${c}`,
  objetivos: (c) => `/objetivos/${c}`,
  meta: (c) => `/meta/${c}`,
}

export default async function handler(req, res) {
  const base = process.env.NODS_API_BASE
  const appPassword = process.env.APP_PASSWORD

  if (appPassword) {
    const key = req.headers['x-app-key']
    if (!key || key !== appPassword) return res.status(401).json({ error: 'No autorizado' })
  }
  if (!base) return res.status(500).json({ error: 'NODS_API_BASE no configurada en Vercel.' })

  const cuentaId = req.query.cuenta
  const cfg = CUENTAS.find((c) => c.cuenta === cuentaId || c.id === cuentaId)
  if (!cfg) return res.status(400).json({ error: `cuenta desconocida: ${cuentaId}` })

  const params = {}
  for (const p of ['anio', 'mes', 'fecha_inicio', 'fecha_fin']) if (req.query[p]) params[p] = req.query[p]

  try {
    const [matriculas, consultaBase, objetivos, meta] = await Promise.all([
      fetchNods(base, RUTA.matriculas(cfg.cuenta), params),
      fetchNods(base, RUTA.consulta_base(cfg.cuenta), params),
      fetchNods(base, RUTA.objetivos(cfg.cuenta), {}),
      fetchNods(base, RUTA.meta(cfg.cuenta), params),
    ])
    const model = aggregate({ matriculas, consultaBase, objetivos, meta }, cfg)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800')
    return res.status(200).send(JSON.stringify(model))
  } catch (err) {
    return res.status(502).json({ error: 'Fallo al agregar datos de NODS', detail: String(err) })
  }
}

async function fetchNods(base, ruta, params) {
  const url = new URL(base.replace(/\/$/, '') + ruta)
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') url.searchParams.set(k, v)
  const headers = { Accept: 'application/json' }
  if (process.env.NODS_API_TOKEN) headers.Authorization = `Bearer ${process.env.NODS_API_TOKEN}`
  if (process.env.NODS_API_KEY) headers['x-api-key'] = process.env.NODS_API_KEY
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`)
  const j = await r.json()
  return j.data || j
}
