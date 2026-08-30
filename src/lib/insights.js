// Motor de insights "wow" para el dashboard (no van al reporte).
// Genera muchos candidatos con un score de relevancia y muestra los mejores.
import { n0, pct, money } from './format.js'
import { programasDe } from './derive.js'

const limpiar = (nombre) => String(nombre).replace(/^(Master|Diplomado|GMP|DIPLOMADO)\s*[-–]\s*/i, '').trim()

export function generarInsights(data, cfg) {
  const C = [] // candidatos: { tipo, score, texto }
  const add = (tipo, score, texto) => C.push({ tipo, score, texto })
  const mon = cfg.moneda
  const f = data.funnel
  const totalMat = f.matriculados || 0

  // (Ingreso/ROAS omitidos: el precio de la API refleja cuotas, no el total confiable.)

  // ---- Ritmo vs objetivo de matrículas + proyección ----
  const mm = data.metas?.matriculas
  if (mm?.meta) {
    const av = (mm.real / mm.meta) * 100
    const dif = mm.real - mm.meta
    if (av >= 100) add('pos', 98, `🎯 <b>Objetivo de matrículas superado</b>: ${n0(mm.real)} vs ${n0(mm.meta)} (+${n0(dif)}, ${pct(av, 0)}).`)
    else if (av >= 85) add('neu', 88, `🎯 Cerca de la meta de matrículas: <b>${pct(av, 0)}</b> (${n0(mm.real)}/${n0(mm.meta)}), faltan <b>${n0(-dif)}</b>.`)
    else add('neg', 90, `🎯 Matrículas al <b>${pct(av, 0)}</b> de la meta — faltan <b>${n0(-dif)}</b> para ${n0(mm.meta)}.`)
  }

  // ---- Semana: matrículas y leads última vs previa (aceleración) ----
  const semMat = ultimaVsPrevia(data.daily?.matriculas)
  if (semMat && semMat.previa >= 0 && (semMat.ultima + semMat.previa) > 0) {
    const d = semMat.previa ? ((semMat.ultima - semMat.previa) / semMat.previa) * 100 : 100
    if (d >= 20) add('pos', 92, `📈 <b>Semana en alza</b>: ${n0(semMat.ultima)} matrículas en los últimos 7 días (+${pct(d, 0)} vs semana previa).`)
    else if (d <= -20) add('neg', 92, `📉 <b>Freno esta semana</b>: ${n0(semMat.ultima)} matrículas en 7 días (${pct(d, 0)} vs previa). Revisar gestión.`)
  }
  const semLeads = ultimaVsPrevia(data.daily?.leads)
  if (semLeads && (semLeads.ultima + semLeads.previa) > 0) {
    const d = semLeads.previa ? ((semLeads.ultima - semLeads.previa) / semLeads.previa) * 100 : 100
    if (Math.abs(d) >= 25) add(d > 0 ? 'pos' : 'neg', 80, `${d > 0 ? '🚀' : '⚠️'} Leads últimos 7 días: <b>${n0(semLeads.ultima)}</b> (${d > 0 ? '+' : ''}${pct(d, 0)} vs semana previa).`)
  }

  // ---- Inversión: CPL y CAC DENTRO de la ventana con gasto (sin ROAS: precio poco confiable) ----
  const inv = data.metas?.leads?.inversion || 0
  const v = data.metas?.inversionVentana
  if (inv > 0 && v) {
    const per = ` (${v.dias} días: ${v.desde}→${v.hasta})`
    const cpl = v.leads ? inv / v.leads : null
    const cac = v.matriculas >= 10 ? inv / v.matriculas : null // CAC sólo con muestra suficiente
    if (cpl) add('neu', 86, `🧮 En la ventana con inversión${per}: <b>${money(cpl, mon)}</b> por lead${cac ? ` y <b>${money(cac, mon)}</b> por matrícula` : ''}.`)
  } else if (inv > 0) {
    add('neu', 70, `🧮 Inversión en ads registrada: <b>${money(inv, mon)}</b>.`)
  }

  // ---- Segmento que mejor convierte ----
  const segs = data.segmentos.map((s) => ({ ...s, conv: s.leads ? (s.matriculados / s.leads) * 100 : 0 }))
  const mejor = [...segs].sort((a, b) => b.conv - a.conv)[0]
  const peor = [...segs].sort((a, b) => a.conv - b.conv)[0]
  if (mejor && peor && mejor.id !== peor.id && mejor.conv > 0) {
    add('neu', 78, `⚖️ <b>${mejor.nombre}</b> convierte mejor (${pct(mejor.conv)} lead→matrícula) que <b>${peor.nombre}</b> (${pct(peor.conv)}).`)
  }

  // ---- Programa estrella ----
  const todos = data.programas.filter((p) => p.matriculados > 0)
  const estrella = [...todos].sort((a, b) => b.matriculados - a.matriculados)[0]
  if (estrella) {
    const share = totalMat ? (estrella.matriculados / totalMat) * 100 : 0
    add('pos', 82, `⭐ Programa líder: <b>${limpiar(estrella.nombre)}</b> con <b>${n0(estrella.matriculados)}</b> matrículas (${pct(share, 0)} del total).`)
  }

  // ---- Oportunidad: mucho volumen, poca conversión ----
  const opp = data.programas
    .filter((p) => p.gestionados >= 800)
    .map((p) => ({ ...p, conv: p.gestionados ? p.matriculados / p.gestionados : 0 }))
    .sort((a, b) => a.conv - b.conv)[0]
  if (opp && opp.conv < 0.005) {
    add('neg', 89, `🔎 Oportunidad: <b>${limpiar(opp.nombre)}</b> gestionó ${n0(opp.gestionados)} leads y sólo <b>${n0(opp.matriculados)}</b> matrículas (${pct(opp.conv * 100)}). Foco de gestión.`)
  }

  // ---- Demanda futura embalsada: "Siguiente cohorte" ----
  const tips = Object.values(data.tipificaciones || {}).flat()
  const sig = sumMotivo(tips, 'Siguiente cohorte')
  if (sig >= 50) add('pos', 76, `⏭️ <b>${n0(sig)} leads</b> piden la <b>siguiente cohorte</b>: demanda embalsada para el próximo ciclo.`)

  // ---- Pricing: peso de "Le parece caro" ----
  const totMotivos = tips.reduce((a, t) => a + t.leads, 0)
  const caro = sumMotivo(tips, 'Le parece caro')
  if (caro > 0 && totMotivos > 0) {
    const p = (caro / totMotivos) * 100
    if (p >= 12) add('neg', 83, `💸 <b>Precio</b> es el freno #1 o cercano: ${n0(caro)} leads dijeron "le parece caro" (${pct(p, 0)} de los motivos). Revisar oferta/becas.`)
  }

  // ---- Calidad de base: no útiles / duplicados / teléfono ----
  if (f.leadsTotales) {
    const nu = (f.noUtiles / f.leadsTotales) * 100
    const dup = sumMotivo(tips, 'Duplicado')
    const tel = sumMotivo(tips, 'Teléfono erróneo o fuera de servicio')
    if (nu >= 20) add('neg', 80, `🧹 <b>${pct(nu, 0)}</b> de leads no útiles (${n0(f.noUtiles)}). Depurar la fuente sube la eficiencia de gestión.`)
    else if (dup + tel > 0) add('neu', 60, `🧹 Calidad de base: ${n0(dup)} duplicados y ${n0(tel)} con teléfono erróneo.`)
  }

  // ---- Concentración geográfica ----
  const totCiu = (data.ciudades || []).reduce((a, c) => a + c.matriculados, 0)
  const topC = data.ciudades?.[0]
  if (topC && totCiu) {
    const share = (topC.matriculados / totCiu) * 100
    if (share >= 55) add('neu', 74, `📍 Alta concentración: <b>${topC.ciudad}</b> reúne <b>${pct(share, 0)}</b> de las matrículas. Oportunidad de expandir a otras plazas.`)
    else add('neu', 55, `📍 <b>${topC.ciudad}</b> lidera con ${n0(topC.matriculados)} matrículas (${pct(share, 0)} del total).`)
  }

  // ---- Día pico de matrículas ----
  const pico = picoDiario(data.daily?.matriculas)
  if (pico && pico.valor >= 4) add('pos', 58, `🔥 Mejor día del ciclo: <b>${pico.fecha}</b> con <b>${n0(pico.valor)}</b> matrículas.`)

  // ordenar por relevancia y devolver top
  return C.sort((a, b) => b.score - a.score).slice(0, 8).map(({ tipo, texto }) => ({ tipo, texto }))
}

function sumMotivo(tips, nombre) {
  return tips.filter((t) => (t.motivo || '').toLowerCase().startsWith(nombre.toLowerCase())).reduce((a, t) => a + t.leads, 0)
}

// suma de los últimos 7 días vs los 7 anteriores, sobre serie [{fecha, valor}]
function ultimaVsPrevia(serie) {
  if (!serie || !serie.length) return null
  const dia = (s) => +new Date(s + 'T00:00:00')
  const fin = dia(serie[serie.length - 1].fecha)
  const d7 = 7 * 864e5
  let ultima = 0, previa = 0
  for (const p of serie) {
    const t = dia(p.fecha)
    if (t > fin - d7) ultima += p.valor
    else if (t > fin - 2 * d7) previa += p.valor
  }
  return { ultima, previa }
}

function picoDiario(serie) {
  if (!serie || !serie.length) return null
  return serie.reduce((mx, p) => (p.valor > (mx?.valor || 0) ? p : mx), null)
}
