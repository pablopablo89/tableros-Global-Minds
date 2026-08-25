// Adaptador: transforma las respuestas crudas de la API de NODS al modelo del tablero.
//
// ⚠️ PENDIENTE: ajustar los nombres de campos cuando tengamos ejemplos reales de
// /matriculas, /objetivos, /meta, /tipificaciones, /consulta_base, /programas.
// La estructura de abajo es la esperada; cada `pick*` aísla el mapeo para que el
// cambio sea de una sola línea por campo.

import { lunesDe, domingoDe, rangosSemana, contarEnRango } from '../lib/weeks.js'

// Helpers tolerantes a nombres alternativos de campo.
const num = (v) => (v == null || v === '' ? 0 : Number(String(v).replace(/\./g, '').replace(',', '.')) || Number(v) || 0)
const first = (obj, keys, def = null) => {
  for (const k of keys) if (obj && obj[k] != null) return obj[k]
  return def
}

// raw = { matriculas, objetivos, meta, tipificaciones, consultaBase, programas }
export function construirModelo(raw, cuentaCfg) {
  const segIds = cuentaCfg.segmentos.map((s) => s.id)

  const programas = (raw.programas || raw.matriculas?.programas || []).map((p) => ({
    segmento: clasificarSegmento(first(p, ['programa', 'nombre', 'Nombre'], ''), cuentaCfg),
    nombre: first(p, ['programa', 'nombre', 'Nombre'], ''),
    cohorte: first(p, ['cohorte', 'Cohorte', 'cohort'], null),
    gestionados: num(first(p, ['gestionados', 'Gestionados'])),
    noUtil: num(first(p, ['no_util', 'noUtil', 'No Útil', 'noUtiles'])),
    potenciales: num(first(p, ['potenciales', 'Potenciales', 'potencial', 'Potencial'])),
    matriculados: num(first(p, ['matriculados', 'Matriculados'])),
    total: num(first(p, ['total', 'Total'])),
  }))

  const model = {
    fechaCorte: first(raw.matriculas || {}, ['fecha_corte', 'fecha'], new Date().toISOString()),
    funnel: mapFunnel(raw.matriculas),
    segmentos: mapSegmentos(raw.matriculas, cuentaCfg),
    programas,
    ciudades: mapCiudades(raw.matriculas),
    tipificaciones: mapTipificaciones(raw.tipificaciones, segIds),
    ticket: mapTicket(raw.matriculas),
    metas: mapMetas(raw.objetivos, raw.meta, cuentaCfg),
    leadsSemana: calcularLeadsSemana(raw.consultaBase, cuentaCfg),
  }
  return model
}

function clasificarSegmento(nombre, cfg) {
  const n = (nombre || '').toLowerCase()
  for (const s of cfg.segmentos) if (n.startsWith(s.prefijo.toLowerCase())) return s.id
  // fallback: primer segmento
  return cfg.segmentos[0].id
}

function mapFunnel(m = {}) {
  const f = m.funnel || m || {}
  return {
    leadsTotales: num(first(f, ['leads_totales', 'leadsTotales', 'leads'])),
    noUtiles: num(first(f, ['no_utiles', 'noUtiles'])),
    enGestion: num(first(f, ['en_gestion', 'enGestion'])),
    potenciales: num(first(f, ['potenciales'])),
    matriculados: num(first(f, ['matriculados'])),
    notas: f.notas || [],
  }
}

function mapSegmentos(m = {}, cfg) {
  const arr = m.segmentos || []
  if (arr.length) return arr
  return cfg.segmentos.map((s) => ({ id: s.id, nombre: s.nombre, leads: 0, contactoPct: 0, potenciales: 0, matriculados: 0 }))
}

function mapCiudades(m = {}) {
  return (m.ciudades || []).map((c) => ({
    ciudad: first(c, ['ciudad', 'Ciudad'], ''),
    matriculados: num(first(c, ['matriculados', 'Matriculados'])),
  }))
}

function mapTipificaciones(t = {}, segIds) {
  const out = {}
  for (const id of segIds) out[id] = (t?.[id] || []).map((x) => ({ motivo: first(x, ['tipificacion', 'motivo'], ''), leads: num(first(x, ['leads', 'cantidad'])) }))
  return out
}

function mapTicket(m = {}) {
  return (m.ticket || []).map((x) => ({ tipo: first(x, ['tipo', 'Tipo'], ''), valor: num(first(x, ['ticket_promedio', 'valor', 'Ticket Promedio'])) }))
}

function mapMetas(objetivos = {}, meta = {}, cfg) {
  // objetivos = metas de leads/matrículas; meta = inversión/leads de Meta Ads.
  return {
    leads: {
      meta: num(first(objetivos, ['leads_meta', 'leads'])),
      real: num(first(objetivos, ['leads_real'])),
      inversion: num(first(meta, ['inversion', 'spend', 'gasto'])),
    },
    matriculas: {
      meta: num(first(objetivos, ['matriculas_meta', 'matriculas'])),
      real: num(first(objetivos, ['matriculas_real'])),
      acumulado: num(first(objetivos, ['acumulado'])),
    },
    porSegmento: objetivos.porSegmento || {},
  }
}

// Calcula leads de la semana anterior (lun-dom) y la semana en curso, por segmento.
function calcularLeadsSemana(consultaBase = [], cfg) {
  const { actual, anterior } = rangosSemana()
  const out = { rango: { actual, anterior } }
  for (const s of cfg.segmentos) {
    const leadsSeg = (consultaBase || []).filter((l) => clasificarSegmento(first(l, ['programa', 'nombre'], ''), cfg) === s.id)
    out[s.id] = {
      ultima: contarEnRango(leadsSeg, anterior.inicio, anterior.fin, (x) => first(x, ['fecha', 'created_at', 'fecha_lead'])),
      actual: contarEnRango(leadsSeg, actual.inicio, actual.fin, (x) => first(x, ['fecha', 'created_at', 'fecha_lead'])),
    }
  }
  return out
}
