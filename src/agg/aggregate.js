// Agregación NODS: convierte los endpoints crudos (matriculas, consulta_base,
// objetivos, meta) en el modelo compacto del tablero. Puro, sin dependencias:
// se usa igual en el generador de snapshots (Node) y en la función serverless.
import { clasificarCanal, fuenteLabel } from '../lib/canales.js'

// "No Útil" = MOTIVO terminal de no-compra. Lista blanca calibrada contra los
// reportes de NODS (la columna "No Útil" = total de la tabla de motivos). Excluye
// estados de gestión/nurture ("Dejo de responder", "Analizando", dialer, etc.).
const NO_UTIL = new Set([
  'Teléfono erróneo o fuera de servicio',
  'Duplicado',
  'Spam - Desconoce haber solicitado información',
  'Cierre de lead por no contacto',
  'Le parece caro',
  'No le interesa',
  'Siguiente cohorte',
  'Inscripto en otra universidad',
  'No es la oferta buscada',
  'No indica motivo',
  'Modalidad de cursado',
  'Pide no ser llamado',
  'No acepta por duración del programa',
])
// Motivo si está en NO_UTIL o empieza con "Busca " (maestría/posgrado/pregrado/curso corto).
const esNoUtilSub = (sub) => NO_UTIL.has(sub) || /^busca /i.test(sub || '')

// Tasa de CONTACTO: se cuentan como NO contactados sólo los estados donde nunca
// se llegó a hablar con la persona. El resto (respondió, dio info, declinó, etc.)
// cuenta como contacto. Coincide con el flag "contactado" del catálogo de NODS (~40-45%).
const NO_CONTACTO = new Set([
  'No contesta', 'Buzon de voz', 'Volver a llamar', 'Teléfono erróneo o fuera de servicio',
  'Cierre de lead por no contacto', 'Duplicado', 'Imposible contactar', 'NotProcessed',
  'TimeoutCategorization', 'NoAnswerDialer', 'RejectedDialer', 'CongestionDialer',
  'AnswerRingingDialer', 'AnswerQueueDialer', 'WithoutPhones', 'Agenda telefonica',
])
const esContactado = (sub) => !!sub && !NO_CONTACTO.has(sub)
// Tipificaciones "potencial" (en proceso de pago).
const POTENCIAL = new Set(['En proceso de pago', 'En proceso de pago - No contesta'])

const norm = (s) => (s == null ? '' : String(s).trim())
const money = (v) => (v == null || v === '' ? 0 : Number(v) || 0)

// El campo descuento_aplicado viene MUY sucio y mezclado entre cuentas:
//   UEES: fracciones ("0.4") y enteros ("40") = ambos 40%; typos ("3O%").
//   Anáhuac: con signo ("25%","30%","90%","100%").
// Normaliza todo a porcentaje 0–100 (null si no se puede interpretar).
function parseDescuento(raw) {
  if (raw == null) return null
  let s = String(raw).trim().toLowerCase().replace(/o/g, '0').replace(',', '.').replace(/[^0-9.]/g, '')
  if (s === '' || s === '.') return null
  let v = Number(s)
  if (isNaN(v) || v < 0) return null
  if (v > 0 && v <= 1) v = v * 100 // fracción → porcentaje
  if (v > 100) v = 100
  return v
}

// El "creativo" de un lead/matrícula/ad se codifica en utm_content / content / ad_name
// como {TIPO}_{Programa}_{FORMATO}_{Ángulo} (con mucha variación entre cuentas y typos).
// Extraemos dos dimensiones robustas y comparables entre las tres fuentes:
//   · formato: Video / Imagen / GIF / Carrusel / Sin dato
//   · ángulo (perfil del anuncio): Especialista / Desbravador / Ambicioso / Estudioso /
//     Docente / Testimonial / Texto / Genérico   (igual que el "Perfil del anuncio" de NODS)
// baja + sin acentos + separadores (_ . - etc.) a espacios, para que \b funcione.
const _cnorm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ')
const PERSONAS = [
  [/especialist/, 'Especialista'],
  [/desbravad/, 'Desbravador'],
  [/ambicios/, 'Ambicioso'],
  [/estudios|estudiant/, 'Estudioso'],
  [/docent/, 'Docente'],
  [/testimoni/, 'Testimonial'],
  [/\btexto\b|kvv texto/, 'Texto'],
]
function parseCreativo(raw) {
  const s = _cnorm(raw).trim()
  if (!s) return null
  let formato = 'Sin dato'
  if (/\b(video|reel|vid)\b/.test(s)) formato = 'Video'
  else if (/\b(img|imagen|imagenes|estatic|static|foto)\b/.test(s)) formato = 'Imagen'
  else if (/\bgif\b/.test(s)) formato = 'GIF'
  else if (/\b(carrusel|carousel)\b/.test(s)) formato = 'Carrusel'
  let angulo = 'Genérico'
  for (const [re, label] of PERSONAS) if (re.test(s)) { angulo = label; break }
  return { formato, angulo }
}
const FORMATO_ORDEN = { Video: 0, Imagen: 1, GIF: 2, Carrusel: 3, 'Sin dato': 9 }

// Clave normalizada para fusionar el MISMO programa escrito distinto en
// consulta_base vs matriculas (acentos, mayúsculas, espacios dobles).
const STOP = new Set(['y', 'e', 'o', 'u', 'de', 'del', 'la', 'el', 'los', 'las', 'en', 'con', 'para', 'por', 'a', 'al', 'un', 'una', 'the'])
const normKey = (s) =>
  norm(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/(.)\1+/g, '$1') // colapsa letras repetidas (Mindfullness→Mindfulness)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ').filter((w) => w && !STOP.has(w)).join(' ') // quita conectores ("TEA, TDAH" == "TEA y TDAH")
    .trim()

function segmentoDe(nombrePrograma, cfg) {
  const n = norm(nombrePrograma).toLowerCase()
  for (const s of cfg.segmentos) {
    const pref = s.prefijo.toLowerCase()
    if (n.startsWith(pref)) return s.id
  }
  return null
}

// Normaliza la cohorte a una etiqueta legible.
function cohorteLabel(raw) {
  const c = norm(raw)
  if (!c) return null
  // "Diplomados 2026_1" -> "2026 · C1"; "2026-02"/"2026.2"/"2026-2" -> "2026 · C2"
  let m = c.match(/(\d{4})[ _\-.](\d{1,2})$/)
  if (m) return `${m[1]} · C${Number(m[2])}`
  return c
}

export function aggregate({ matriculas = [], consultaBase = [], objetivos = [], meta = [] }, cfg) {
  const segIds = cfg.segmentos.map((s) => s.id)
  const idxSeg = (id) => cfg.segmentos.find((s) => s.id === id)

  // Índice de leads por email/teléfono, para recuperar el canal de una matrícula
  // cuyo UTM propio vino vacío (backfill desde el lead de origen). El email/teléfono
  // NUNCA sale de esta función: sólo se usa para el join; el snapshot es agregado.
  const nMail = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9@.]/g, '')
  const nTel = (s) => String(s == null ? '' : s).replace(/\D/g, '').slice(-9)
  const idxMail = new Map(), idxTel = new Map()
  for (const l of consultaBase) {
    const e = nMail(l.emlmail); if (e.includes('@')) idxMail.set(e, l)
    for (const t of [nTel(l.teltelefono), nTel(l.telwhatsapp)]) if (t.length >= 7 && !idxTel.has(t)) idxTel.set(t, l)
  }
  const vacioCanal = (v) => { const x = norm(v).toLowerCase(); return x === '' || x === '(null)' || x === 'null' }

  // ---------- Leads (consulta_base) ----------
  const leads = consultaBase.map((l) => {
    const ch = clasificarCanal(l.utm_source, l.utm_medium)
    const cr = parseCreativo(l.utm_content)
    return {
      seg: segmentoDe(l.txtprogramainteres, cfg),
      programa: norm(l.txtprogramainteres),
      sub: norm(l.descripcion_sub),
      gestionado: norm(l.gestionado_neotel) === 'S',
      cohorte: cohorteLabel(l.descripcion_db),
      ciudad: norm(l.ciudad),
      fecha: l.fecha_insercion || l.ts,
      macro: ch.macro, canal: ch.canal, fuente: fuenteLabel(l.utm_source, l.utm_medium),
      srcRaw: norm(l.utm_source), medRaw: norm(l.utm_medium),
      creaFormato: cr ? cr.formato : null, creaAngulo: cr ? cr.angulo : null,
    }
  })

  // ---------- Matrículas ----------
  const mats = matriculas.map((m) => {
    let src = m.source, med = m.medium, cont = m.content
    if ((vacioCanal(src) && vacioCanal(med)) || vacioCanal(cont)) {
      const hit = idxMail.get(nMail(m.correo)) || idxTel.get(nTel(m.telefono))
      if (hit) {
        if (vacioCanal(src) && vacioCanal(med)) { src = hit.utm_source; med = hit.utm_medium }
        if (vacioCanal(cont)) cont = hit.utm_content
      }
    }
    const ch = clasificarCanal(src, med)
    const cr = parseCreativo(cont)
    return {
      creaFormato: cr ? cr.formato : null, creaAngulo: cr ? cr.angulo : null,
      seg: segmentoDe(m.programa, cfg),
      programa: norm(m.programa),
      tipo: norm(m.tipo_programa),
      cohorte: cohorteLabel(m.cohorte),
      ciudad: norm(m.ciudad),
      fechaPago: m.fecha_de_pago,
      precio: money(m.precio_con_descuento) || money(m.precio_full),
      descuento: parseDescuento(m.descuento_aplicado),
      macro: ch.macro, canal: ch.canal, fuente: fuenteLabel(src, med),
      srcRaw: norm(src), medRaw: norm(med),
    }
  })

  // ---------- Núcleo (funnel/segmentos/programas/ciudades/tipificaciones/ticket/ingresos) ----------
  const { funnel, segmentos, programas, programasDetalle, ciudades, tipificaciones, ticket, descuento, ingresos, creativos } = nucleo(leads, mats, cfg)

  // ---------- Metas / inversión (objetivos + meta) ----------
  const metaU = dedupeMeta(meta) // quita filas repetidas por el fetch mes-a-mes
  const metas = construirMetas(objetivos, metaU, mats, leads, cfg)

  // ---------- Leads por semana ----------
  const leadsSemana = construirLeadsSemana(leads, cfg)

  // ---------- Evolución SEMANAL (neto + acumulado) vs objetivo, acotada al ciclo ----------
  const daily = construirDaily(leads, mats, objetivos, cfg)

  // cohortes disponibles (para el filtro)
  const cohortes = [...new Set(programas.filter((p) => p.cohorte).map((p) => p.cohorte))].sort()

  // ---------- Desglose por SEMANA y por MES (para los filtros, sin re-consultar la API) ----------
  const semanal = construirSemanal(leads, mats, cfg)
  const mensual = construirMensual(leads, mats, cfg)

  // ---------- Ventas (matrículas) del mes en curso, por segmento ----------
  const ventasMes = construirVentasMes(mats, cfg)

  // ---------- Alcance orgánico (canal de adquisición) ----------
  const organico = construirOrganico(leads, mats, cfg)

  // ---------- Performance (ads: inversión/alcance/CPL + cumplimiento de objetivos) ----------
  const performance = construirPerformance(metaU, metas, cfg)

  return {
    fechaCorte: new Date().toISOString().slice(0, 10),
    cuenta: cfg.id,
    moneda: cfg.moneda,
    funnel, segmentos, programas, programasDetalle, ciudades, tipificaciones, ticket, descuento, ingresos, creativos, metas, leadsSemana, daily, cohortes, semanal, mensual, ventasMes, organico, performance,
    cobertura: { leads: leads.length, matriculas: mats.length },
  }
}

// Analítica de canal de adquisición, con foco en el alcance ORGÁNICO.
// Reparte leads y matrículas en macro-categorías (orgánico / pauta / bases / sin),
// compara eficiencia (conversión lead→matrícula) y desglosa el orgánico por canal,
// fuente, segmento, programa, ciudad y mes.
function construirOrganico(leads, mats, cfg) {
  const MAC = ['organico', 'pauta', 'sin']
  const LBL = { organico: 'Orgánico', pauta: 'Pauta (Ads)', sin: 'Sin clasificar' }
  const totalLeads = leads.length, totalMats = mats.length

  const macros = MAC.map((mm) => {
    const L = leads.filter((l) => l.macro === mm)
    const M = mats.filter((m) => m.macro === mm)
    const cont = L.filter((l) => esContactado(l.sub)).length
    return {
      macro: mm, label: LBL[mm], leads: L.length, matriculados: M.length,
      convPct: L.length ? (M.length / L.length) * 100 : 0,
      contactoPct: L.length ? (cont / L.length) * 100 : 0,
      potenciales: L.filter((l) => POTENCIAL.has(l.sub)).length,
      leadShare: totalLeads ? (L.length / totalLeads) * 100 : 0,
      matShare: totalMats ? (M.length / totalMats) * 100 : 0,
    }
  })

  const orgL = leads.filter((l) => l.macro === 'organico')
  const orgM = mats.filter((m) => m.macro === 'organico')

  // Canales orgánicos (sub-canales) con embudo.
  const cMap = new Map()
  const canalRow = (k) => { if (!cMap.has(k)) cMap.set(k, { canal: k, leads: 0, contacto: 0, potenciales: 0, matriculados: 0 }); return cMap.get(k) }
  for (const l of orgL) { const r = canalRow(l.canal); r.leads++; if (esContactado(l.sub)) r.contacto++; if (POTENCIAL.has(l.sub)) r.potenciales++ }
  for (const m of orgM) canalRow(m.canal).matriculados++
  const canales = [...cMap.values()]
    .map((c) => ({ ...c, contactoPct: c.leads ? (c.contacto / c.leads) * 100 : 0, convPct: c.leads ? (c.matriculados / c.leads) * 100 : 0 }))
    .sort((a, b) => b.leads - a.leads)

  // Fuentes orgánicas (de dónde viene, valor crudo agrupado).
  const fMap = new Map()
  const fRow = (k) => { if (!fMap.has(k)) fMap.set(k, { fuente: k, leads: 0, matriculados: 0 }); return fMap.get(k) }
  for (const l of orgL) fRow(l.fuente).leads++
  for (const m of orgM) fRow(m.fuente).matriculados++
  const fuentes = [...fMap.values()].sort((a, b) => b.leads - a.leads || b.matriculados - a.matriculados)

  // Programas con más orgánico (consolidando el mismo nombre escrito distinto).
  const pMap = new Map()
  const pRow = (seg, nombre) => {
    const k = `${seg}||${normKey(nombre)}`
    if (!pMap.has(k)) pMap.set(k, { segmento: seg, nombre, leads: 0, matriculados: 0 })
    return pMap.get(k)
  }
  for (const l of orgL) { if (l.seg) pRow(l.seg, l.programa).leads++ }
  for (const m of orgM) { if (m.seg) pRow(m.seg, m.programa).matriculados++ }
  const programas = [...pMap.values()]
    .map((p) => ({ ...p, convPct: p.leads ? (p.matriculados / p.leads) * 100 : 0 }))
    .sort((a, b) => b.matriculados - a.matriculados || b.leads - a.leads)

  // Segmentos (orgánico).
  const segmentos = cfg.segmentos.map((s) => {
    const L = orgL.filter((l) => l.seg === s.id).length
    const M = orgM.filter((m) => m.seg === s.id).length
    return { id: s.id, nombre: s.nombre, leads: L, matriculados: M, convPct: L ? (M / L) * 100 : 0 }
  })

  // Ciudades (matrículas orgánicas).
  const ciuMap = new Map()
  for (const m of orgM) { const c = m.ciudad || 'Sin especificar'; ciuMap.set(c, (ciuMap.get(c) || 0) + 1) }
  const ciudades = [...ciuMap.entries()].map(([ciudad, matriculados]) => ({ ciudad, matriculados })).sort((a, b) => b.matriculados - a.matriculados)

  // Evolución mensual (orgánico) acotada al año del ciclo.
  const anios = mats.map((m) => (String(m.fechaPago).match(/^(\d{4})/) || [])[1]).filter(Boolean)
  const cycleYear = anios.length ? moda(anios) : String(new Date().getFullYear())
  const enCiclo = (f) => f && String(f).slice(0, 4) === cycleYear
  const mesDe = (f) => String(f).slice(0, 7)
  const mMap = new Map()
  const mRow = (k) => { if (!mMap.has(k)) mMap.set(k, { mes: k, leads: 0, matriculados: 0 }); return mMap.get(k) }
  for (const l of orgL) if (enCiclo(l.fecha)) mRow(mesDe(l.fecha)).leads++
  for (const m of orgM) if (enCiclo(m.fechaPago)) mRow(mesDe(m.fechaPago)).matriculados++
  const mensual = [...mMap.values()].filter((x) => /^\d{4}-\d{2}$/.test(x.mes)).sort((a, b) => a.mes.localeCompare(b.mes))

  // Detalle del bucket "Sin clasificar": qué combinaciones crudas de source/medium
  // lo componen (para explicar de qué se trata en el tablero).
  const sinL = leads.filter((l) => l.macro === 'sin')
  const sinMats = mats.filter((m) => m.macro === 'sin')
  const dMap = new Map()
  const etiqueta = (v) => (v && v.toLowerCase() !== '(null)' && v.toLowerCase() !== 'null' ? v : '∅ (vacío)')
  const dRow = (k) => { if (!dMap.has(k)) dMap.set(k, { combo: k, leads: 0, matriculados: 0 }); return dMap.get(k) }
  for (const l of sinL) dRow(`${etiqueta(l.srcRaw)}  ·  ${etiqueta(l.medRaw)}`).leads++
  for (const m of sinMats) dRow(`${etiqueta(m.srcRaw)}  ·  ${etiqueta(m.medRaw)}`).matriculados++
  const sinDetalle = [...dMap.values()].sort((a, b) => b.leads - a.leads).slice(0, 8)

  const cv = (mm) => macros.find((x) => x.macro === mm)?.convPct || 0
  return {
    totalLeads, totalMats, macros, canales, fuentes, programas, segmentos, ciudades, mensual, sinDetalle,
    conv: { organico: cv('organico'), pauta: cv('pauta') },
  }
}

// Un slice de `nucleo` por cada MES del ciclo (leads por fecha_insercion, matrículas por fecha_de_pago).
function construirMensual(leads, mats, cfg) {
  const anios = mats.map((m) => (String(m.fechaPago).match(/^(\d{4})/) || [])[1]).filter(Boolean)
  const cycleYear = anios.length ? moda(anios) : String(new Date().getFullYear())
  const enCiclo = (f) => f && String(f).slice(0, 4) === cycleYear
  const mesDe = (f) => String(f).slice(0, 7)

  const meses = new Map()
  const bucket = (k) => { if (!meses.has(k)) meses.set(k, { leads: [], mats: [] }); return meses.get(k) }
  for (const l of leads) if (enCiclo(l.fecha)) bucket(mesDe(l.fecha)).leads.push(l)
  for (const m of mats) if (enCiclo(m.fechaPago)) bucket(mesDe(m.fechaPago)).mats.push(m)

  return [...meses.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([mes, { leads: ls, mats: ms }]) => ({ mes, ...nucleo(ls, ms, cfg), organico: construirOrganico(ls, ms, cfg) }))
}

// Matrículas del mes más reciente con ventas (mes en curso), por segmento.
function construirVentasMes(mats, cfg) {
  const meses = mats.map((m) => String(m.fechaPago || '').slice(0, 7)).filter((x) => /^\d{4}-\d{2}$/.test(x))
  if (!meses.length) return null
  const mes = meses.sort().at(-1)
  const delMes = mats.filter((m) => String(m.fechaPago || '').slice(0, 7) === mes)
  const porSegmento = {}
  for (const s of cfg.segmentos) porSegmento[s.id] = delMes.filter((m) => m.seg === s.id).length
  return { mes, total: delMes.length, porSegmento }
}

// Cálculo central sobre subconjuntos de leads/matrículas ya mapeados.
function nucleo(leads, mats, cfg) {
  const esNoUtil = esNoUtilSub
  const esPotencial = (sub) => POTENCIAL.has(sub)

  // "Reciente" = ingresó hace ≤ 10 días (potenciales frescos/accionables).
  const ahora = Date.now()
  const DIEZ_DIAS = 10 * 864e5
  const esReciente = (f) => { if (!f) return false; const t = +new Date(f); return t >= ahora - DIEZ_DIAS && t <= ahora }

  const noUtiles = leads.filter((l) => esNoUtil(l.sub)).length
  const funnel = {
    leadsTotales: leads.length,
    noUtiles,
    utiles: leads.length - noUtiles, // en gestión = total − no útiles (embudo que resta)
    gestionadosFlag: leads.filter((l) => l.gestionado).length, // flag neotel (~99%), informativo
    enGestion: leads.length - noUtiles, // "en gestión" del embudo = útiles
    potenciales: leads.filter((l) => esPotencial(l.sub)).length,
    potencialesRecientes: leads.filter((l) => esPotencial(l.sub) && esReciente(l.fecha)).length,
    matriculados: mats.length,
    notas: [],
  }

  const segmentos = cfg.segmentos.map((s) => {
    const ls = leads.filter((l) => l.seg === s.id)
    const gest = ls.filter((l) => l.gestionado).length
    const cont = ls.filter((l) => esContactado(l.sub)).length
    return {
      id: s.id, nombre: s.nombre, leads: ls.length, gestionados: gest,
      contactoPct: ls.length ? (cont / ls.length) * 100 : 0, // tasa de contacto real
      potenciales: ls.filter((l) => esPotencial(l.sub)).length,
      matriculados: mats.filter((m) => m.seg === s.id).length,
    }
  })

  const progMap = new Map()
  const keyP = (seg, nombre, cohorte) => `${seg}||${normKey(nombre)}||${cohorte || ''}`
  for (const l of leads) {
    if (!l.seg) continue
    const co = l.seg === 'dip' ? l.cohorte : null
    const k = keyP(l.seg, l.programa, co)
    if (!progMap.has(k)) progMap.set(k, { segmento: l.seg, nombre: l.programa, cohorte: co, gestionados: 0, noUtil: 0, potenciales: 0, matriculados: 0, total: 0 })
    const p = progMap.get(k)
    p.total++
    if (l.gestionado) p.gestionados++
    if (esNoUtil(l.sub)) p.noUtil++
    if (esPotencial(l.sub)) p.potenciales++
  }
  for (const m of mats) {
    if (!m.seg) continue
    const co = m.seg === 'dip' ? m.cohorte : null
    let k = keyP(m.seg, m.programa, co)
    if (!progMap.has(k) && m.seg === 'dip' && !co) {
      const alt = [...progMap.keys()].find((kk) => kk.startsWith(`${m.seg}||${normKey(m.programa)}||`))
      if (alt) k = alt
    }
    if (!progMap.has(k)) progMap.set(k, { segmento: m.seg, nombre: m.programa, cohorte: co, gestionados: 0, noUtil: 0, potenciales: 0, matriculados: 0, total: 0 })
    progMap.get(k).matriculados++
  }
  const programas = [...progMap.values()]

  // Detalle por programa (consolidado por nombre, sin cohorte) para la vista Performance:
  // contactabilidad, conversiones, descuento promedio y motivos de cierre.
  const detMap = new Map()
  const det = (seg, nombre) => {
    const k = `${seg}||${normKey(nombre)}`
    if (!detMap.has(k)) detMap.set(k, { segmento: seg, nombre, total: 0, gestionados: 0, contacto: 0, potenciales: 0, noUtil: 0, matriculados: 0, descSum: 0, descN: 0, _mot: new Map() })
    return detMap.get(k)
  }
  for (const l of leads) {
    if (!l.seg) continue
    const p = det(l.seg, l.programa)
    p.total++
    if (l.gestionado) p.gestionados++
    if (esContactado(l.sub)) p.contacto++
    if (esPotencial(l.sub)) p.potenciales++
    if (esNoUtil(l.sub)) { p.noUtil++; p._mot.set(l.sub, (p._mot.get(l.sub) || 0) + 1) }
  }
  for (const m of mats) {
    if (!m.seg) continue
    const p = det(m.seg, m.programa)
    p.matriculados++
    if (m.descuento != null) { p.descSum += m.descuento; p.descN++ }
  }
  const programasDetalle = fusionarDetalle([...detMap.values()]).map((p) => ({
    segmento: p.segmento, nombre: p.nombre, key: normKey(p.nombre), total: p.total, gestionados: p.gestionados,
    contacto: p.contacto, potenciales: p.potenciales, noUtil: p.noUtil, matriculados: p.matriculados,
    contactoPct: p.total ? (p.contacto / p.total) * 100 : 0,
    convLead: p.total ? (p.matriculados / p.total) * 100 : 0,
    convContacto: p.contacto ? (p.matriculados / p.contacto) * 100 : 0,
    descuento: p.descN ? p.descSum / p.descN : null,
    motivos: [...p._mot.entries()].map(([motivo, leads]) => ({ motivo, leads })).sort((a, b) => b.leads - a.leads).slice(0, 6),
  })).sort((a, b) => b.matriculados - a.matriculados || b.total - a.total)

  const ciuMap = new Map()
  for (const m of mats) { const c = m.ciudad || 'Sin especificar'; ciuMap.set(c, (ciuMap.get(c) || 0) + 1) }
  const ciudades = [...ciuMap.entries()].map(([ciudad, matriculados]) => ({ ciudad, matriculados })).sort((a, b) => b.matriculados - a.matriculados)

  const tipificaciones = {}
  for (const s of cfg.segmentos) {
    const m = new Map()
    for (const l of leads) { if (l.seg !== s.id) continue; if (!esNoUtilSub(l.sub)) continue; m.set(l.sub, (m.get(l.sub) || 0) + 1) }
    tipificaciones[s.id] = [...m.entries()].map(([motivo, lds]) => ({ motivo, leads: lds })).sort((a, b) => b.leads - a.leads)
  }

  const ticket = ticketPromedio(mats, cfg)
  const descuento = descuentoPromedio(mats, cfg)
  const ingresos = { total: mats.reduce((a, m) => a + m.precio, 0), porSegmento: {} }
  for (const s of cfg.segmentos) ingresos.porSegmento[s.id] = mats.filter((m) => m.seg === s.id).reduce((a, m) => a + m.precio, 0)

  const creativos = construirCreativos(leads, mats)

  return { funnel, segmentos, programas, programasDetalle, ciudades, tipificaciones, ticket, descuento, ingresos, creativos, cobertura: { leads: leads.length, matriculas: mats.length } }
}

// Cruce CREATIVOS → VENTAS (sólo CRM: completo y sin ventana). Reparte los leads y
// las matrículas que traen creativo (utm_content / content) por FORMATO y por ÁNGULO
// (perfil del anuncio), y mide la conversión lead→matrícula de cada uno. Responde bien
// a la pregunta "qué creativo VENDE, no sólo cuál trae leads".
function construirCreativos(leads, mats) {
  const conL = leads.filter((l) => l.creaFormato)
  const conM = mats.filter((m) => m.creaFormato)
  const grupo = (arrL, arrM, campo) => {
    const map = new Map()
    const row = (k) => { if (!map.has(k)) map.set(k, { clave: k, leads: 0, contacto: 0, potenciales: 0, matriculados: 0 }); return map.get(k) }
    for (const l of arrL) { const r = row(l[campo]); r.leads++; if (esContactado(l.sub)) r.contacto++; if (POTENCIAL.has(l.sub)) r.potenciales++ }
    for (const m of arrM) row(m[campo]).matriculados++
    return [...map.values()].map((r) => ({
      ...r,
      contactoPct: r.leads ? (r.contacto / r.leads) * 100 : 0,
      convPct: r.leads ? (r.matriculados / r.leads) * 100 : 0,
    }))
  }
  const formatos = grupo(conL, conM, 'creaFormato')
    .map((r) => ({ formato: r.clave, ...r }))
    .sort((a, b) => (FORMATO_ORDEN[a.formato] ?? 8) - (FORMATO_ORDEN[b.formato] ?? 8))
  const angulos = grupo(conL, conM, 'creaAngulo')
    .map((r) => ({ angulo: r.clave, ...r }))
    .sort((a, b) => b.matriculados - a.matriculados || b.leads - a.leads)
  // Matriz formato × ángulo (celdas con al menos 1 matrícula o buen volumen de leads).
  const cMap = new Map()
  const cRow = (f, a) => { const k = f + '||' + a; if (!cMap.has(k)) cMap.set(k, { formato: f, angulo: a, leads: 0, matriculados: 0 }); return cMap.get(k) }
  for (const l of conL) cRow(l.creaFormato, l.creaAngulo).leads++
  for (const m of conM) cRow(m.creaFormato, m.creaAngulo).matriculados++
  const combos = [...cMap.values()]
    .map((c) => ({ ...c, convPct: c.leads ? (c.matriculados / c.leads) * 100 : 0 }))
    .sort((a, b) => b.matriculados - a.matriculados || b.leads - a.leads)
  return {
    formatos, angulos, combos,
    cobertura: { leadsConDato: conL.length, leadsTotal: leads.length, matsConDato: conM.length, matsTotal: mats.length },
  }
}

// Un slice de `nucleo` por cada semana (lun-dom) del ciclo, para el filtro semanal.
function construirSemanal(leads, mats, cfg) {
  const anios = mats.map((m) => (String(m.fechaPago).match(/^(\d{4})/) || [])[1]).filter(Boolean)
  const cycleYear = anios.length ? moda(anios) : String(new Date().getFullYear())
  const desde = `${cycleYear}-01-01`
  const enCiclo = (f) => f && String(f).slice(0, 10) >= desde

  const semanas = new Map() // lunesISO -> { leads:[], mats:[] }
  const bucket = (k) => { if (!semanas.has(k)) semanas.set(k, { leads: [], mats: [] }); return semanas.get(k) }
  for (const l of leads) if (enCiclo(l.fecha)) bucket(lunesISO(l.fecha)).leads.push(l)
  for (const m of mats) if (enCiclo(m.fechaPago)) bucket(lunesISO(m.fechaPago)).mats.push(m)

  return [...semanas.entries()]
    .sort((a, b) => b[0].localeCompare(a[0])) // más reciente primero
    .map(([semana, { leads: ls, mats: ms }]) => {
      const fin = new Date(semana + 'T00:00:00'); fin.setDate(fin.getDate() + 6)
      return { semana, fin: fin.toISOString().slice(0, 10), ...nucleo(ls, ms, cfg), organico: construirOrganico(ls, ms, cfg) }
    })
}

function ticketPromedio(mats, cfg) {
  const out = []
  for (const s of cfg.segmentos) {
    const conPrecio = mats.filter((m) => m.seg === s.id && m.precio > 0)
    if (conPrecio.length) out.push({ tipo: s.nombre, valor: conPrecio.reduce((a, m) => a + m.precio, 0) / conPrecio.length })
  }
  const todos = mats.filter((m) => m.precio > 0)
  if (todos.length) out.push({ tipo: 'Total', valor: todos.reduce((a, m) => a + m.precio, 0) / todos.length })
  return out
}

// Descuento promedio aplicado (%) sobre las matrículas con valor válido, por segmento y total.
// Incluye "conPct" = qué porción de las matrículas tuvo algún descuento (>0).
function descuentoPromedio(mats, cfg) {
  const prom = (arr) => (arr.length ? arr.reduce((a, m) => a + m.descuento, 0) / arr.length : null)
  const porSegmento = {}
  for (const s of cfg.segmentos) porSegmento[s.id] = prom(mats.filter((m) => m.seg === s.id && m.descuento != null))
  const con = mats.filter((m) => m.descuento != null)
  // Distribución: cuántas matrículas usaron cada nivel de descuento (redondeado a %).
  const distMap = new Map()
  for (const m of con) { const k = Math.round(m.descuento); distMap.set(k, (distMap.get(k) || 0) + 1) }
  const distribucion = [...distMap.entries()]
    .map(([descuento, matriculas]) => ({ descuento, matriculas, uso: con.length ? (matriculas / con.length) * 100 : 0 }))
    .sort((a, b) => b.descuento - a.descuento)
  return {
    promedio: prom(con),
    porSegmento,
    muestra: con.length,
    conDescuentoPct: con.length ? (con.filter((m) => m.descuento > 0).length / con.length) * 100 : null,
    distribucion,
  }
}

// Series ANUALES de pauta (Meta, todos los meses del ciclo, una sola descomposición):
//  · serie: inversión / leads-ads / CPL por semana (lun-dom)
//  · formatoCampana: Formulario nativo / Click to Web / Search (parseando campaign_name)
//  · programaSemana: matriz programa × semana con leads y CPL
function construirMetaSerie(base, cfg) {
  const num = (v) => Number(v) || 0
  // --- semanal ---
  const wMap = new Map()
  const wRow = (k) => { if (!wMap.has(k)) wMap.set(k, { semana: k, inversion: 0, leadsAds: 0, impresiones: 0, clics: 0 }); return wMap.get(k) }
  for (const r of base) {
    if (!r.fecha) continue
    const wk = lunesISO(r.fecha); if (!/^\d{4}-\d{2}-\d{2}$/.test(wk)) continue
    const s = wRow(wk)
    s.inversion += num(r.amount_spent); s.leadsAds += num(r.registration_completed)
    s.impresiones += num(r.impresions); s.clics += num(r.outbound_clics)
  }
  const serie = [...wMap.values()].sort((a, b) => a.semana.localeCompare(b.semana))
    .map((s) => ({ ...s, fin: finSemana(s.semana), cpl: s.leadsAds ? s.inversion / s.leadsAds : null }))
  // --- formato de campaña ---
  const clasifFmt = (name) => {
    const s = norm(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ') // separadores → espacios (para \b)
    if (/formnativo|form nativo|nativo|lead ?ad|leadgen/.test(s)) return 'Formulario nativo'
    if (/\bctw\b|click to web|link clicks?|\btrafico\b|to web/.test(s)) return 'Click to Web'
    if (/\bsearch\b|busqueda|\bsem\b/.test(s)) return 'Search'
    return 'Otro'
  }
  const fMap = new Map()
  for (const r of base) {
    const k = clasifFmt(r.campaign_name)
    if (!fMap.has(k)) fMap.set(k, { formato: k, inversion: 0, leadsAds: 0 })
    const x = fMap.get(k); x.inversion += num(r.amount_spent); x.leadsAds += num(r.registration_completed)
  }
  const ordF = { 'Formulario nativo': 0, 'Click to Web': 1, Search: 2, Otro: 9 }
  const formatoCampana = [...fMap.values()].map((x) => ({ ...x, cpl: x.leadsAds ? x.inversion / x.leadsAds : null }))
    .sort((a, b) => (ordF[a.formato] ?? 8) - (ordF[b.formato] ?? 8))
  // --- programa × semana ---
  const pMap = new Map()
  for (const r of base) {
    const nombre = norm(r.programa); if (!nombre) continue
    if (!r.fecha) continue
    const wk = lunesISO(r.fecha); if (!/^\d{4}-\d{2}-\d{2}$/.test(wk)) continue
    const k = normKey(nombre)
    if (!pMap.has(k)) pMap.set(k, { nombre, key: k, seg: segmentoDe(nombre, cfg), cel: new Map(), inv: 0, leads: 0 })
    const p = pMap.get(k)
    const c = p.cel.get(wk) || { inv: 0, leads: 0 }
    c.inv += num(r.amount_spent); c.leads += num(r.registration_completed); p.cel.set(wk, c)
    p.inv += num(r.amount_spent); p.leads += num(r.registration_completed)
  }
  const semanas = serie.map((s) => s.semana)
  const programas = [...pMap.values()].sort((a, b) => b.leads - a.leads).map((p) => ({
    nombre: p.nombre, key: p.key, seg: p.seg, totLeads: p.leads, totInv: p.inv,
    cpl: p.leads ? p.inv / p.leads : null,
    semanas: Object.fromEntries([...p.cel.entries()].map(([w, c]) => [w, { leads: c.leads, cpl: c.leads ? c.inv / c.leads : null }])),
  }))
  return { serie, formatoCampana, programaSemana: { semanas, programas } }
}
function finSemana(lunesStr) { const d = new Date(lunesStr + 'T00:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10) }

// Mapea el formato_programa de objetivos ("Masters"/"Diplomados"/"GMP") a segmento.
function formatoASeg(formato, cfg) {
  const f = norm(formato).toLowerCase()
  for (const s of cfg.segmentos) {
    if (f.includes('diplom') && s.id === 'dip') return s.id
    if ((f.includes('master') || f.includes('gmp')) && (s.id === 'mas' || s.id === 'gmp')) return s.id
  }
  return null
}

function construirMetas(objetivos, meta, mats, leads, cfg) {
  // Objetivos: filas semanales por formato con objetivo_leads/objetivo_matriculas/inversion.
  let leadsMeta = 0, matMeta = 0
  const porSeg = {}
  for (const o of objetivos) {
    leadsMeta += Number(o.objetivo_leads) || 0
    matMeta += Number(o.objetivo_matriculas) || 0
    const seg = formatoASeg(o.formato_programa, cfg)
    if (seg) {
      porSeg[seg] = porSeg[seg] || { leadsMeta: 0, matMeta: 0 }
      porSeg[seg].leadsMeta += Number(o.objetivo_leads) || 0
      porSeg[seg].matMeta += Number(o.objetivo_matriculas) || 0
    }
  }
  // Inversión: suma de amount_spent en meta (Meta Ads), sobre UNA sola descomposición
  // (breakdown_type) para no multiplicar el gasto.
  const metaBase = baseMeta(meta)
  const inversion = metaBase.reduce((a, m) => a + (Number(m.amount_spent) || 0), 0)
  const cobertura = metaBase.length ? rangoFechas(metaBase.map((m) => m.fecha)) : null

  // Ventana de inversión: leads/matrículas/ingreso DENTRO del período con gasto,
  // para que CPL/CAC/ROAS sean comparables (el gasto puede cubrir pocos días).
  let ventana = null
  if (cobertura) {
    const a = +new Date(cobertura.desde + 'T00:00:00')
    const b = +new Date(cobertura.hasta + 'T23:59:59')
    const inRange = (f) => { const t = +new Date(f); return t >= a && t <= b }
    const matsV = mats.filter((m) => m.fechaPago && inRange(m.fechaPago))
    ventana = {
      desde: cobertura.desde, hasta: cobertura.hasta,
      leads: leads.filter((l) => l.fecha && inRange(l.fecha)).length,
      matriculas: matsV.length,
      ingreso: matsV.reduce((s, m) => s + m.precio, 0),
      dias: Math.round((b - a) / 864e5) + 1,
    }
  }

  // reales por segmento (leads y matrículas efectivos)
  for (const s of cfg.segmentos) {
    porSeg[s.id] = porSeg[s.id] || { leadsMeta: 0, matMeta: 0 }
    porSeg[s.id].matReal = mats.filter((m) => m.seg === s.id).length
    porSeg[s.id].leadsReal = leads.filter((l) => l.seg === s.id).length
  }

  return {
    leads: { meta: leadsMeta || null, real: leads.length, inversion },
    matriculas: { meta: matMeta || null, real: mats.length, acumulado: mats.length },
    porSegmento: porSeg,
    coberturaInversion: cobertura,
    inversionVentana: ventana,
  }
}

function rangoFechas(fechas) {
  const f = fechas.filter(Boolean).sort()
  return f.length ? { desde: f[0], hasta: f[f.length - 1] } : null
}

// Distancia de edición (Levenshtein) y similitud de nombres, igual criterio que el
// tablero: fusiona programas que difieren por pocas letras (ej. "RRHH" vs "RR HH").
function editDist(a, b) {
  const m = a.length, n = b.length
  if (!m) return n; if (!n) return m
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c)
  }
  return d[m][n]
}
function nombresSimilares(a, b) {
  if (a === b) return true
  const maxLen = Math.max(a.length, b.length)
  if (maxLen < 12) return false
  return editDist(a, b) <= Math.max(2, Math.round(maxLen * 0.06))
}

// Fusión difusa de las entradas de detalle por programa (mismo segmento, nombre casi
// igual). Suma contadores y combina el mapa de motivos; el de mayor volumen conserva el nombre.
function fusionarDetalle(entries) {
  const items = [...entries].sort((a, b) => (b.total + b.matriculados) - (a.total + a.matriculados))
  const out = []
  for (const e of items) {
    const dst = out.find((o) => o.segmento === e.segmento && nombresSimilares(normKey(o.nombre), normKey(e.nombre)))
    if (dst) {
      dst.total += e.total; dst.gestionados += e.gestionados; dst.contacto += e.contacto
      dst.potenciales += e.potenciales; dst.noUtil += e.noUtil; dst.matriculados += e.matriculados
      dst.descSum += e.descSum; dst.descN += e.descN
      for (const [k, v] of e._mot) dst._mot.set(k, (dst._mot.get(k) || 0) + v)
    } else out.push(e)
  }
  return out
}

// Meta Ads devuelve VARIAS descomposiciones de la MISMA campaña (breakdown_type:
// platform/placement/age_gender/country/region). Cada una reparte el mismo gasto →
// sumar todas multiplica la inversión. Para totales usamos UNA sola descomposición.
// Las llamadas mes-a-mes de Meta pueden solaparse (devolver filas repetidas). Cada fila
// trae un `dedup_key` único por (breakdown, anuncio, fecha, plataforma) → deduplicamos.
function dedupeMeta(meta) {
  const seen = new Set(); const out = []
  for (const r of meta) {
    const k = r.dedup_key || `${r.breakdown_type}|${r.ad_id}|${r.fecha}|${r.publisher_platform}|${r.age}|${r.gender}`
    if (seen.has(k)) continue
    seen.add(k); out.push(r)
  }
  return out
}
function baseMeta(meta) {
  const types = new Set(meta.map((r) => r.breakdown_type).filter(Boolean))
  if (!types.size) return meta // data vieja sin breakdown → una sola copia
  const bt = types.has('platform') ? 'platform' : [...types][0]
  return meta.filter((r) => r.breakdown_type === bt)
}

// Performance de pauta desde `meta` (Meta Ads, granular): agrega inversión, alcance
// (reach), impresiones, clics y leads de ads (global y por programa), y el cumplimiento
// de objetivos de matrículas. La inversión cubre la ventana descargada (mes en curso).
function construirPerformance(meta, metas, cfg) {
  const num = (v) => Number(v) || 0
  const base = baseMeta(meta) // una sola descomposición para no multiplicar el gasto
  const ads = { inversion: 0, impresiones: 0, alcance: 0, clics: 0, leadsAds: 0 }
  const pmap = new Map()
  for (const r of base) {
    ads.inversion += num(r.amount_spent)
    ads.impresiones += num(r.impresions)
    ads.alcance += num(r.reach)
    ads.clics += num(r.outbound_clics)
    ads.leadsAds += num(r.registration_completed)
    const nombre = norm(r.programa)
    if (!nombre) continue
    const k = normKey(nombre)
    if (!pmap.has(k)) pmap.set(k, { nombre, inversion: 0, impresiones: 0, alcance: 0, clics: 0, leadsAds: 0 })
    const p = pmap.get(k)
    p.inversion += num(r.amount_spent); p.impresiones += num(r.impresions)
    p.alcance += num(r.reach); p.clics += num(r.outbound_clics); p.leadsAds += num(r.registration_completed)
  }
  const adsPorPrograma = [...pmap.values()]
    .map((p) => ({ ...p, key: normKey(p.nombre), cpl: p.leadsAds ? p.inversion / p.leadsAds : null }))
    .sort((a, b) => b.inversion - a.inversion)

  // Inversión real por FORMATO y por ÁNGULO (parseando ad_name), para superponerla al
  // cruce creativos→ventas del CRM. Cubre la ventana descargada de Meta (mes en curso).
  const invF = new Map(), invA = new Map()
  const acc = (map, k) => { if (!map.has(k)) map.set(k, { inversion: 0, leadsAds: 0 }); return map.get(k) }
  for (const r of base) {
    if (!r.ad_name) continue
    const cr = parseCreativo(r.ad_name)
    const f = acc(invF, cr.formato); f.inversion += num(r.amount_spent); f.leadsAds += num(r.registration_completed)
    const a = acc(invA, cr.angulo); a.inversion += num(r.amount_spent); a.leadsAds += num(r.registration_completed)
  }
  const invRows = (map, campo) => [...map.entries()].map(([k, v]) => ({ [campo]: k, inversion: v.inversion, leadsAds: v.leadsAds, cpl: v.leadsAds ? v.inversion / v.leadsAds : null }))

  const demografia = construirDemografia(meta)
  const metaSerie = construirMetaSerie(base, cfg)
  const v = metas.inversionVentana
  return {
    serie: metaSerie.serie,
    formatoCampana: metaSerie.formatoCampana,
    programaSemana: metaSerie.programaSemana,
    ads: {
      ...ads,
      cpl: ads.leadsAds ? ads.inversion / ads.leadsAds : null,      // CPL sobre leads reportados por Meta
      cplReal: v && v.leads ? ads.inversion / v.leads : null,        // CPL sobre leads reales de la ventana
      ctr: ads.impresiones ? (ads.clics / ads.impresiones) * 100 : null,
      ventana: metas.coberturaInversion,
    },
    adsPorPrograma,
    inversionCreativos: { porFormato: invRows(invF, 'formato'), porAngulo: invRows(invA, 'angulo'), ventana: metas.coberturaInversion },
    demografia,
    objetivos: { matriculas: metas.matriculas, leads: metas.leads, porSegmento: metas.porSegmento },
  }
}

// Demografía de la pauta (género y edad) desde las filas breakdown_type='age_gender'
// de Meta (cada fila trae age, gender, amount_spent, registration_completed). CPL por
// grupo = gasto del grupo ÷ leads de ads del grupo. Ventana = mes en curso.
function construirDemografia(meta) {
  const num = (v) => Number(v) || 0
  const rows = meta.filter((r) => r.breakdown_type === 'age_gender' && (r.gender || r.age))
  if (!rows.length) return null
  const GEN = { female: 'Mujeres', male: 'Hombres', unknown: 'Sin dato' }
  const gMap = new Map(), aMap = new Map()
  const bump = (map, k) => { if (!map.has(k)) map.set(k, { clave: k, inversion: 0, leadsAds: 0 }); return map.get(k) }
  for (const r of rows) {
    if (r.gender) { const g = bump(gMap, r.gender); g.inversion += num(r.amount_spent); g.leadsAds += num(r.registration_completed) }
    if (r.age) { const a = bump(aMap, r.age); a.inversion += num(r.amount_spent); a.leadsAds += num(r.registration_completed) }
  }
  const fin = (map, campo, label) => [...map.values()].map((x) => ({ [campo]: label ? label(x.clave) : x.clave, inversion: x.inversion, leadsAds: x.leadsAds, cpl: x.leadsAds ? x.inversion / x.leadsAds : null }))
  const genero = fin(gMap, 'genero', (k) => GEN[k] || k).sort((a, b) => b.leadsAds - a.leadsAds)
  const ordenEdad = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+']
  const edad = fin(aMap, 'edad').sort((a, b) => {
    const ia = ordenEdad.indexOf(a.edad), ib = ordenEdad.indexOf(b.edad)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  const totLeads = genero.reduce((s, x) => s + x.leadsAds, 0)
  return { genero: genero.map((x) => ({ ...x, share: totLeads ? (x.leadsAds / totLeads) * 100 : 0 })), edad, totalLeads: totLeads }
}

function lunes(d) { const x = new Date(d); x.setHours(0,0,0,0); const dow=(x.getDay()+6)%7; x.setDate(x.getDate()-dow); return x }

function construirLeadsSemana(leads, cfg) {
  const hoy = new Date()
  const inicioActual = lunes(hoy)
  const finActual = new Date(inicioActual); finActual.setDate(inicioActual.getDate()+6); finActual.setHours(23,59,59,999)
  const inicioAnt = new Date(inicioActual); inicioAnt.setDate(inicioActual.getDate()-7)
  const finAnt = new Date(finActual); finAnt.setDate(finActual.getDate()-7)
  const out = { rango: { actual: { inicio: inicioActual.toISOString(), fin: finActual.toISOString() }, anterior: { inicio: inicioAnt.toISOString(), fin: finAnt.toISOString() } } }
  for (const s of cfg.segmentos) {
    const ls = leads.filter((l) => l.seg === s.id && l.fecha)
    const cnt = (a, b) => ls.filter((l) => { const t = +new Date(l.fecha); return t >= +a && t <= +b }).length
    out[s.id] = { ultima: cnt(inicioAnt, finAnt), actual: cnt(inicioActual, finActual) }
  }
  return out
}

// Evolución SEMANAL (lun–dom) del ciclo actual: neto por semana + acumulado, y
// objetivo semanal (de `objetivos`, que ya viene por semana). Acota al año del ciclo
// para no arrastrar leads de bases viejas (2025).
function construirDaily(leads, mats, objetivos, cfg) {
  // año del ciclo = el de la mayoría de las matrículas (o el actual)
  const anios = mats.map((m) => (String(m.fechaPago).match(/^(\d{4})/) || [])[1]).filter(Boolean)
  const cycleYear = anios.length ? moda(anios) : String(new Date().getFullYear())
  const desde = `${cycleYear}-01-01`

  const matDates = mats.map((m) => m.fechaPago).filter((f) => f && f >= desde)
  const leadDates = leads.map((l) => l.fecha).filter((f) => f && String(f).slice(0, 10) >= desde)

  // objetivo semanal por lunes
  const objMatSem = new Map(), objLeadSem = new Map()
  for (const o of objetivos) {
    if (!o.fecha) continue
    const k = lunesISO(o.fecha)
    objMatSem.set(k, (objMatSem.get(k) || 0) + (Number(o.objetivo_matriculas) || 0))
    objLeadSem.set(k, (objLeadSem.get(k) || 0) + (Number(o.objetivo_leads) || 0))
  }

  return {
    cicloDesde: desde,
    matriculas: serieSemanal(matDates, objMatSem),
    leads: serieSemanal(leadDates, objLeadSem),
    objetivoMatriculasTotal: [...objMatSem.values()].reduce((a, b) => a + b, 0),
    objetivoLeadsTotal: [...objLeadSem.values()].reduce((a, b) => a + b, 0),
  }
}

function moda(arr) {
  const m = {}; let best = arr[0]
  for (const x of arr) { m[x] = (m[x] || 0) + 1; if (m[x] > (m[best] || 0)) best = x }
  return best
}

function lunesISO(fechaStr) {
  const d = new Date(String(fechaStr).slice(0, 10) + 'T00:00:00')
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return d.toISOString().slice(0, 10)
}

// arma [{semana(lunes), neto, acumulado, objetivo, objetivoAcum}] uniendo semanas
// con datos reales y semanas con objetivo, ordenadas.
function serieSemanal(fechas, objSemMap) {
  const neto = new Map()
  for (const f of fechas) {
    const k = lunesISO(f)
    neto.set(k, (neto.get(k) || 0) + 1)
  }
  const semanas = [...new Set([...neto.keys(), ...objSemMap.keys()])].sort()
  let acc = 0, accObj = 0
  return semanas.map((s) => {
    const n = neto.get(s) || 0
    const o = objSemMap.get(s) || 0
    acc += n; accObj += o
    return { semana: s, neto: n, acumulado: acc, objetivo: o, objetivoAcum: accObj }
  })
}
