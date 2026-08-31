// Agregación NODS: convierte los endpoints crudos (matriculas, consulta_base,
// objetivos, meta) en el modelo compacto del tablero. Puro, sin dependencias:
// se usa igual en el generador de snapshots (Node) y en la función serverless.

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

  // ---------- Leads (consulta_base) ----------
  const leads = consultaBase.map((l) => ({
    seg: segmentoDe(l.txtprogramainteres, cfg),
    programa: norm(l.txtprogramainteres),
    sub: norm(l.descripcion_sub),
    gestionado: norm(l.gestionado_neotel) === 'S',
    cohorte: cohorteLabel(l.descripcion_db),
    ciudad: norm(l.ciudad),
    fecha: l.fecha_insercion || l.ts,
  }))

  // ---------- Matrículas ----------
  const mats = matriculas.map((m) => ({
    seg: segmentoDe(m.programa, cfg),
    programa: norm(m.programa),
    tipo: norm(m.tipo_programa),
    cohorte: cohorteLabel(m.cohorte),
    ciudad: norm(m.ciudad),
    fechaPago: m.fecha_de_pago,
    precio: money(m.precio_con_descuento) || money(m.precio_full),
  }))

  // ---------- Núcleo (funnel/segmentos/programas/ciudades/tipificaciones/ticket/ingresos) ----------
  const { funnel, segmentos, programas, ciudades, tipificaciones, ticket, ingresos } = nucleo(leads, mats, cfg)

  // ---------- Metas / inversión (objetivos + meta) ----------
  const metas = construirMetas(objetivos, meta, mats, leads, cfg)

  // ---------- Leads por semana ----------
  const leadsSemana = construirLeadsSemana(leads, cfg)

  // ---------- Evolución SEMANAL (neto + acumulado) vs objetivo, acotada al ciclo ----------
  const daily = construirDaily(leads, mats, objetivos, cfg)

  // cohortes disponibles (para el filtro)
  const cohortes = [...new Set(programas.filter((p) => p.cohorte).map((p) => p.cohorte))].sort()

  // ---------- Desglose por SEMANA (para el filtro semanal, sin re-consultar la API) ----------
  const semanal = construirSemanal(leads, mats, cfg)

  // ---------- Ventas (matrículas) del mes en curso, por segmento ----------
  const ventasMes = construirVentasMes(mats, cfg)

  return {
    fechaCorte: new Date().toISOString().slice(0, 10),
    cuenta: cfg.id,
    moneda: cfg.moneda,
    funnel, segmentos, programas, ciudades, tipificaciones, ticket, ingresos, metas, leadsSemana, daily, cohortes, semanal, ventasMes,
    cobertura: { leads: leads.length, matriculas: mats.length },
  }
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

  const funnel = {
    leadsTotales: leads.length,
    noUtiles: leads.filter((l) => esNoUtil(l.sub)).length,
    enGestion: leads.filter((l) => l.gestionado).length,
    potenciales: leads.filter((l) => esPotencial(l.sub)).length,
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
  const ingresos = { total: mats.reduce((a, m) => a + m.precio, 0), porSegmento: {} }
  for (const s of cfg.segmentos) ingresos.porSegmento[s.id] = mats.filter((m) => m.seg === s.id).reduce((a, m) => a + m.precio, 0)

  return { funnel, segmentos, programas, ciudades, tipificaciones, ticket, ingresos, cobertura: { leads: leads.length, matriculas: mats.length } }
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
      return { semana, fin: fin.toISOString().slice(0, 10), ...nucleo(ls, ms, cfg) }
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
  // Inversión: suma de amount_spent en meta (Meta Ads).
  const inversion = meta.reduce((a, m) => a + (Number(m.amount_spent) || 0), 0)
  const cobertura = meta.length ? rangoFechas(meta.map((m) => m.fecha)) : null

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
