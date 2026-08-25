import PptxGenJS from 'pptxgenjs'
import { n0, pct, money } from '../lib/format.js'
import { programasDe, segPrincipal, segDiplomados, agruparPorCohorte } from '../lib/derive.js'
import { fecha } from '../lib/format.js'

const INK = '0E1116'
const WHITE = 'FFFFFF'
const MUTED = '5B6472'
const LINE = 'E7EAF0'

// Secciones disponibles para el reporte (el usuario elige cuáles incluir).
export const SECCIONES = [
  { id: 'portada', label: 'Portada', sub: 'NODS | +a + nombre de cuenta', base: true },
  { id: 'funnel', label: 'Funnel de conversión', sub: 'Embudo + segmentos', base: true },
  { id: 'prog_principal', label: 'Detalle por programa — Másters/GMP', base: true },
  { id: 'prog_diplomados', label: 'Detalle por programa — Diplomados', sub: 'Agrupa por cohorte si está disponible', base: true },
  { id: 'ciudad', label: 'Detalle por ciudad', base: true },
  { id: 'motivos', label: 'Motivos de no compra + ticket', base: true },
  // Opcionales (no venían en el PDF original):
  { id: 'objetivos', label: 'Inversión y matrículas vs objetivo', sub: 'Con acumulado', base: false },
]

export async function generarPptx(data, cfg, seleccion) {
  const acc = cfg.acento.replace('#', '')
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 })
  pptx.layout = 'W'
  pptx.theme = { headFontFace: 'Space Grotesk', bodyFontFace: 'Space Grotesk' }

  const inc = (id) => seleccion.includes(id)

  if (inc('portada')) portada(pptx, cfg, data)
  if (inc('funnel')) slideFunnel(pptx, cfg, data, acc)
  if (inc('prog_principal')) slidePrograma(pptx, `Detalle por programa — ${segPrincipal(cfg).nombre}`, programasDe(data, segPrincipal(cfg).id), acc, false)
  if (inc('prog_diplomados')) slidePrograma(pptx, 'Detalle por programa — Diplomados', programasDe(data, segDiplomados(cfg).id), acc, true)
  if (inc('ciudad')) slideCiudad(pptx, cfg, data, acc)
  if (inc('motivos')) slideMotivos(pptx, cfg, data, acc)
  if (inc('objetivos')) slideObjetivos(pptx, cfg, data, acc)

  const nombre = `${cfg.nombre.replace(/\s+/g, '_')}_${data.fechaCorte}.pptx`
  await pptx.writeFile({ fileName: nombre })
  return nombre
}

function barraMarca(slide) {
  slide.addShape('rect', { x: 0, y: 0, w: 4.44, h: 0.08, fill: { color: '1946E3' } })
  slide.addShape('rect', { x: 4.44, y: 0, w: 4.45, h: 0.08, fill: { color: 'E11D48' } })
  slide.addShape('rect', { x: 8.89, y: 0, w: 4.44, h: 0.08, fill: { color: '12B3A6' } })
  slide.addText([{ text: 'NODS', options: { bold: true } }, { text: '  |  +a', options: { color: MUTED } }],
    { x: 10.3, y: 0.18, w: 2.8, h: 0.4, align: 'right', fontSize: 14, color: INK })
}

function tituloSlide(slide, titulo) {
  slide.addText(titulo, { x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 26, bold: true, color: INK })
}

function portada(pptx, cfg, data) {
  const s = pptx.addSlide()
  s.background = { color: INK }
  s.addShape('rect', { x: 0, y: 3.2, w: 4.44, h: 0.12, fill: { color: '1946E3' } })
  s.addShape('rect', { x: 4.44, y: 3.2, w: 4.45, h: 0.12, fill: { color: 'E11D48' } })
  s.addShape('rect', { x: 8.89, y: 3.2, w: 4.44, h: 0.12, fill: { color: '12B3A6' } })
  s.addText([{ text: 'NODS', options: { bold: true, fontSize: 40 } }, { text: '   |   +a educação', options: { fontSize: 22, color: 'C9CED8' } }],
    { x: 0.5, y: 2.2, w: 12.3, h: 0.9, align: 'center', color: WHITE })
  s.addText(cfg.subtitulo, { x: 0.5, y: 3.5, w: 12.3, h: 0.7, align: 'center', fontSize: 26, color: WHITE, bold: true })
  s.addText(`Reporte al ${fecha(data.fechaCorte)}`, { x: 0.5, y: 4.2, w: 12.3, h: 0.5, align: 'center', fontSize: 14, color: 'C9CED8' })
}

function slideFunnel(pptx, cfg, data, acc) {
  const s = pptx.addSlide()
  barraMarca(s); tituloSlide(s, 'Funnel de conversión')
  const f = data.funnel
  const pasos = [
    ['Leads totales', f.leadsTotales], ['No útiles', f.noUtiles], ['En gestión', f.enGestion],
    ['Potenciales', f.potenciales], ['Matriculados', f.matriculados],
  ]
  let y = 1.6
  const maxW = 5.5
  const max = Math.max(...pasos.map((p) => p[1]), 1)
  pasos.forEach(([lbl, val]) => {
    const w = 2 + maxW * (val / max)
    s.addShape('roundRect', { x: 0.6 + (maxW + 2 - w) / 2, y, w, h: 0.72, rectRadius: 0.06, fill: { color: acc } })
    s.addText([{ text: lbl + '  ', options: { fontSize: 10, color: 'FFFFFF', transparency: 20 } }, { text: n0(val), options: { fontSize: 15, bold: true } }],
      { x: 0.6 + (maxW + 2 - w) / 2, y, w, h: 0.72, align: 'center', color: WHITE })
    y += 0.92
  })
  // Segmentos
  let sx = 9.0
  data.segmentos.forEach((seg) => {
    s.addText(seg.nombre, { x: sx, y: 1.5, w: 1.9, h: 0.4, align: 'center', fontSize: 14, bold: true, color: WHITE, fill: { color: acc } })
    const rows = [['Leads', n0(seg.leads)], ['Contacto', pct(seg.contactoPct)], ['Potenciales', n0(seg.potenciales)], ['Matriculados', n0(seg.matriculados)]]
    s.addTable(rows.map((r) => [{ text: r[0], options: { color: MUTED } }, { text: r[1], options: { align: 'right', bold: true } }]),
      { x: sx, y: 1.95, w: 1.9, fontSize: 11, border: { type: 'solid', color: LINE, pt: 0.5 }, rowH: 0.4 })
    sx += 2.1
  })
  if (f.notas?.length) s.addText(f.notas.join(' · '), { x: 0.6, y: 6.7, w: 8, h: 0.4, fontSize: 11, italic: true, color: MUTED })
}

function tablaPrograma(rows, acc) {
  const head = ['Programa', 'Gestionados', 'No útil', 'Potenciales', 'Matriculados', 'Total'].map((t, i) => ({
    text: t, options: { fill: { color: acc }, color: WHITE, bold: true, align: i === 0 ? 'left' : 'right', fontSize: 9 },
  }))
  return [head, ...rows]
}

function filaP(f) {
  return [
    { text: f.nombre, options: { align: 'left', fontSize: 8 } },
    { text: n0(f.gestionados), options: { align: 'right', fontSize: 8 } },
    { text: n0(f.noUtil), options: { align: 'right', fontSize: 8 } },
    { text: n0(f.potenciales), options: { align: 'right', fontSize: 8 } },
    { text: n0(f.matriculados), options: { align: 'right', fontSize: 8 } },
    { text: n0(f.total), options: { align: 'right', fontSize: 8 } },
  ]
}

function slidePrograma(pptx, titulo, filas, acc, agrupar) {
  // Si son muchas filas (diplomados UEES), parte en varias slides.
  const grupos = agrupar ? agruparPorCohorte(filas) : [{ cohorte: null, filas }]
  let bloque = []
  const MAX = 20
  const flush = (cont) => {
    const s = pptx.addSlide()
    barraMarca(s); tituloSlide(s, titulo + (cont ? ' (cont.)' : ''))
    s.addTable(tablaPrograma(bloque, acc), {
      x: 0.5, y: 1.5, w: 12.3, colW: [6.3, 1.3, 1.1, 1.3, 1.4, 0.9],
      border: { type: 'solid', color: LINE, pt: 0.5 }, valign: 'middle', autoPage: false,
    })
    bloque = []
  }
  let primera = true
  for (const g of grupos) {
    const ordenadas = [...g.filas].sort((a, b) => b.matriculados - a.matriculados)
    if (agrupar && g.cohorte) {
      if (bloque.length > MAX) { flush(!primera); primera = false }
      bloque.push([{ text: g.cohorte, options: { colspan: 6, fill: { color: 'F1E6F3' }, color: acc, bold: true, fontSize: 9 } }])
    }
    for (const f of ordenadas) {
      if (bloque.length >= MAX) { flush(!primera); primera = false }
      bloque.push(filaP(f))
    }
  }
  // Total general
  const tot = filas.reduce((a, f) => ({ g: a.g + f.gestionados, nu: a.nu + f.noUtil, p: a.p + f.potenciales, m: a.m + f.matriculados, t: a.t + f.total }), { g: 0, nu: 0, p: 0, m: 0, t: 0 })
  bloque.push([
    { text: 'Total', options: { align: 'left', bold: true, color: WHITE, fill: { color: INK }, fontSize: 9 } },
    ...[tot.g, tot.nu, tot.p, tot.m, tot.t].map((v) => ({ text: n0(v), options: { align: 'right', bold: true, color: WHITE, fill: { color: INK }, fontSize: 9 } })),
  ])
  flush(!primera)
}

function slideCiudad(pptx, cfg, data, acc) {
  const s = pptx.addSlide()
  barraMarca(s); tituloSlide(s, 'Detalle por ciudad')
  const top = [...(data.ciudades || [])].sort((a, b) => b.matriculados - a.matriculados).slice(0, 20)
  s.addChart(pptx.ChartType.bar, [{ name: 'Matriculados', labels: top.map((c) => c.ciudad), values: top.map((c) => c.matriculados) }], {
    x: 0.5, y: 1.4, w: 12.3, h: 5.6, barDir: 'col', chartColors: [acc], showValue: true,
    dataLabelFontSize: 8, catAxisLabelFontSize: 8, valAxisHidden: true, showLegend: false,
  })
}

function slideMotivos(pptx, cfg, data, acc) {
  const s = pptx.addSlide()
  barraMarca(s); tituloSlide(s, 'Motivos de no compra')
  let x = 0.5
  cfg.segmentos.forEach((seg) => {
    const filas = [...(data.tipificaciones?.[seg.id] || [])].sort((a, b) => b.leads - a.leads)
    const total = filas.reduce((a, f) => a + f.leads, 0)
    const head = [{ text: `Tipificación · ${seg.nombre}`, options: { fill: { color: acc }, color: WHITE, bold: true, fontSize: 9 } }, { text: 'Leads', options: { fill: { color: acc }, color: WHITE, bold: true, align: 'right', fontSize: 9 } }, { text: '%', options: { fill: { color: acc }, color: WHITE, bold: true, align: 'right', fontSize: 9 } }]
    const rows = filas.map((f) => [{ text: f.motivo, options: { fontSize: 8 } }, { text: n0(f.leads), options: { align: 'right', fontSize: 8 } }, { text: pct(total ? (f.leads / total) * 100 : 0), options: { align: 'right', fontSize: 8 } }])
    rows.push([{ text: 'Total', options: { bold: true, color: WHITE, fill: { color: INK }, fontSize: 8 } }, { text: n0(total), options: { align: 'right', bold: true, color: WHITE, fill: { color: INK }, fontSize: 8 } }, { text: '100,00%', options: { align: 'right', bold: true, color: WHITE, fill: { color: INK }, fontSize: 8 } }])
    s.addTable([head, ...rows], { x, y: 1.4, w: 6.1, colW: [4.1, 1, 1], border: { type: 'solid', color: LINE, pt: 0.5 }, rowH: 0.26 })
    x += 6.4
  })
  // Ticket
  const ty = 6.4
  s.addText('Ticket promedio', { x: 0.5, y: ty, w: 3, h: 0.4, fontSize: 13, bold: true, color: INK })
  const tRows = (data.ticket || []).map((t) => [{ text: t.tipo, options: { fontSize: 9, bold: t.tipo.toLowerCase() === 'total' } }, { text: money(t.valor, cfg.moneda), options: { align: 'right', fontSize: 9, bold: t.tipo.toLowerCase() === 'total' } }])
  s.addTable(tRows, { x: 3.6, y: ty, w: 4, colW: [2, 2], border: { type: 'solid', color: LINE, pt: 0.5 }, rowH: 0.3 })
}

function slideObjetivos(pptx, cfg, data, acc) {
  const s = pptx.addSlide()
  barraMarca(s); tituloSlide(s, 'Inversión y matrículas vs objetivo')
  const m = data.metas || {}
  const leads = m.leads || {}, mat = m.matriculas || {}
  const cpl = leads.inversion && leads.real ? leads.inversion / leads.real : null
  const kpis = [
    ['Leads', `${n0(leads.real)} / ${n0(leads.meta)}`, leads.meta ? pct((leads.real / leads.meta) * 100, 0) + ' de la meta' : ''],
    ['Inversión', money(leads.inversion, cfg.moneda), cpl ? `CPL ${money(cpl, cfg.moneda)}` : ''],
    ['Matrículas', `${n0(mat.real)} / ${n0(mat.meta)}`, mat.meta ? pct((mat.real / mat.meta) * 100, 0) + ' de la meta' : ''],
    ['Acumulado ciclo', n0(mat.acumulado), ''],
  ]
  let x = 0.6
  kpis.forEach(([lbl, val, sub]) => {
    s.addShape('roundRect', { x, y: 2.2, w: 2.9, h: 2, rectRadius: 0.08, fill: { color: 'F7F8FB' }, line: { color: LINE, pt: 1 } })
    s.addText(lbl, { x, y: 2.4, w: 2.9, h: 0.4, align: 'center', fontSize: 12, color: MUTED })
    s.addText(val, { x, y: 2.9, w: 2.9, h: 0.6, align: 'center', fontSize: 22, bold: true, color: INK })
    if (sub) s.addText(sub, { x, y: 3.6, w: 2.9, h: 0.4, align: 'center', fontSize: 11, color: acc })
    x += 3.05
  })
  if (leads.demo || mat.demo) s.addText('* Valores demo — pendiente de conectar objetivos/inversión reales de la API.', { x: 0.6, y: 6.6, w: 11, h: 0.4, fontSize: 10, italic: true, color: MUTED })
}
