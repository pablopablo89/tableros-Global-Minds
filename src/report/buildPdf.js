import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { n0, pct, money, fecha } from '../lib/format.js'
import { programasDe, segPrincipal, segDiplomados, consolidarProgramas } from '../lib/derive.js'
import { coverDataUrl } from './coverImage.js'

// Mismo contrato que buildPptx: genera el reporte en PDF con las secciones elegidas.
// Reutiliza SECCIONES de buildPptx para no duplicar la lista.
import { SECCIONES } from './buildPptx.js'

const INK = [14, 17, 22]
const MUTED = [91, 100, 114]
const LINE = [231, 234, 240]
const WHITE = [255, 255, 255]
const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

const W = 297, H = 210, M = 14 // A4 landscape (mm)

export async function generarPdf(data, cfg, seleccion) {
  const acc = hx(cfg.acento)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const ctx = { doc, acc, cfg, data, primeraLamina: true }

  const inc = (id) => seleccion.includes(id)
  if (inc('portada')) await portada(ctx)
  if (inc('funnel')) slideFunnel(ctx)
  if (inc('prog_principal')) slidePrograma(ctx, `Detalle por programa — ${segPrincipal(cfg).nombre}`, consolidarProgramas(programasDe(data, segPrincipal(cfg).id)))
  if (inc('prog_diplomados')) slidePrograma(ctx, 'Detalle por programa — Diplomados', consolidarProgramas(programasDe(data, segDiplomados(cfg).id)))
  if (inc('ciudad')) slideCiudad(ctx)
  if (inc('motivos')) slideMotivos(ctx)
  if (inc('objetivos')) slideObjetivos(ctx)

  const nombre = `${cfg.nombre.replace(/\s+/g, '_')}_${data.fechaCorte}.pdf`
  if (typeof document !== 'undefined') { doc.save(nombre); return nombre }
  return doc // entorno sin navegador (tests)
}

function nuevaLamina(ctx) {
  if (ctx.primeraLamina) { ctx.primeraLamina = false; return }
  ctx.doc.addPage()
}

function barraMarca(doc) {
  doc.setFillColor(25, 70, 227); doc.rect(0, 0, W / 3, 1.6, 'F')
  doc.setFillColor(225, 29, 72); doc.rect(W / 3, 0, W / 3, 1.6, 'F')
  doc.setFillColor(18, 179, 166); doc.rect((2 * W) / 3, 0, W / 3, 1.6, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK)
  doc.text('NODS', W - M - 22, 8)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED)
  doc.text('| +a', W - M - 8, 8)
}

function titulo(ctx, t) {
  const { doc } = ctx
  nuevaLamina(ctx)
  barraMarca(doc)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...INK)
  doc.text(t, M, 20)
}

async function portada(ctx) {
  const { doc, cfg, data } = ctx
  nuevaLamina(ctx)
  doc.setFillColor(...INK); doc.rect(0, 0, W, H, 'F')
  const cover = await coverDataUrl(cfg)
  if (cover) {
    const ih = (W * 810) / 1440 // portada del deck 16:9, ajustada al ancho
    doc.addImage(cover, 'PNG', 0, (H - ih) / 2, W, ih)
    return
  }
  doc.setFillColor(25, 70, 227); doc.rect(0, H / 2 - 2, W / 3, 3, 'F')
  doc.setFillColor(225, 29, 72); doc.rect(W / 3, H / 2 - 2, W / 3, 3, 'F')
  doc.setFillColor(18, 179, 166); doc.rect((2 * W) / 3, H / 2 - 2, W / 3, 3, 'F')
  doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(34)
  doc.text('NODS', W / 2 - 30, H / 2 - 14, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(18); doc.setTextColor(201, 206, 216)
  doc.text('|  +a educação', W / 2 + 18, H / 2 - 14, { align: 'center' })
  doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(22)
  doc.text(cfg.subtitulo, W / 2, H / 2 + 18, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(201, 206, 216)
  doc.text(`Reporte al ${fecha(data.fechaCorte)}`, W / 2, H / 2 + 28, { align: 'center' })
}

function slideFunnel(ctx) {
  const { doc, cfg, data, acc } = ctx
  titulo(ctx, 'Funnel de conversión')
  const f = data.funnel
  const pasos = [['Leads totales', f.leadsTotales], ['No útiles', f.noUtiles], ['En gestión', f.enGestion], ['Potenciales', f.potenciales], ['Matriculados', f.matriculados]]
  const max = Math.max(...pasos.map((p) => p[1]), 1)
  let y = 34
  const maxW = 130, x0 = M
  pasos.forEach(([lbl, val]) => {
    const w = 40 + maxW * (val / max)
    doc.setFillColor(...acc); doc.roundedRect(x0 + (maxW + 40 - w) / 2, y, w, 13, 1.5, 1.5, 'F')
    doc.setTextColor(...WHITE); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    doc.text(lbl, x0 + (maxW + 40 - w) / 2 + 4, y + 8)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
    doc.text(n0(val), x0 + (maxW + 40 - w) / 2 + w - 4, y + 8.5, { align: 'right' })
    y += 17
  })
  // Segmentos (mini tablas)
  let sx = 190
  data.segmentos.forEach((seg) => {
    autoTable(doc, {
      startY: 34, margin: { left: sx }, tableWidth: 45,
      head: [[seg.nombre, '']], headStyles: { fillColor: acc, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
      body: [['Leads', n0(seg.leads)], ['Gestionado', pct(seg.contactoPct, 0)], ['Potenciales', n0(seg.potenciales)], ['Matriculados', n0(seg.matriculados)]],
      bodyStyles: { fontSize: 8, textColor: INK }, columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      styles: { lineColor: LINE, lineWidth: 0.2 },
    })
    sx += 52
  })
  if (f.notas?.length) { doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(f.notas.join(' · '), M, H - 10) }
}

function filasPrograma(filas) {
  return filas.map((f) => [f.nombre, n0(f.gestionados), n0(f.noUtil), n0(f.potenciales), n0(f.matriculados), n0(f.total)])
}

function slidePrograma(ctx, tit, filas) {
  const { doc, acc } = ctx
  titulo(ctx, tit)
  const head = [['Programa', 'Gestionados', 'No útil', 'Potenciales', 'Matriculados', 'Total']]
  // Consolidado: una fila por programa (autoTable pagina solo si hace falta).
  const body = filasPrograma([...filas].sort((a, b) => b.matriculados - a.matriculados))
  const tot = filas.reduce((a, f) => ({ g: a.g + f.gestionados, nu: a.nu + f.noUtil, p: a.p + f.potenciales, m: a.m + f.matriculados, t: a.t + f.total }), { g: 0, nu: 0, p: 0, m: 0, t: 0 })
  const foot = [[{ content: 'Total', styles: { fontStyle: 'bold', textColor: WHITE, fillColor: INK } }, ...[tot.g, tot.nu, tot.p, tot.m, tot.t].map((v) => ({ content: n0(v), styles: { halign: 'right', fontStyle: 'bold', textColor: WHITE, fillColor: INK } }))]]
  autoTable(doc, {
    startY: 26, head, body, foot, margin: { left: M, right: M },
    headStyles: { fillColor: acc, textColor: WHITE, fontSize: 8, halign: 'right' },
    bodyStyles: { fontSize: 7.5 }, footStyles: { fontSize: 8 },
    columnStyles: { 0: { halign: 'left', cellWidth: 130 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    styles: { lineColor: LINE, lineWidth: 0.2, overflow: 'linebreak' },
    didParseCell: (d) => { if (d.section === 'head' && d.column.index === 0) d.cell.styles.halign = 'left' },
  })
}

function slideCiudad(ctx) {
  const { doc, acc, data } = ctx
  titulo(ctx, 'Detalle por ciudad')
  const top = [...(data.ciudades || [])].sort((a, b) => b.matriculados - a.matriculados).slice(0, 22)
  const max = top[0]?.matriculados || 1
  let y = 32
  const bx = 70, bw = 190
  doc.setFontSize(8)
  top.forEach((c) => {
    doc.setTextColor(...MUTED); doc.text(c.ciudad.slice(0, 30), bx - 3, y + 2.5, { align: 'right' })
    doc.setFillColor(...acc); doc.rect(bx, y, Math.max(1, (c.matriculados / max) * bw), 3.4, 'F')
    doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.text(n0(c.matriculados), bx + (c.matriculados / max) * bw + 2, y + 2.8)
    doc.setFont('helvetica', 'normal')
    y += 7
  })
}

function slideMotivos(ctx) {
  const { doc, acc, cfg, data } = ctx
  titulo(ctx, 'Motivos de no compra')
  let sx = M
  cfg.segmentos.forEach((seg) => {
    const filas = [...(data.tipificaciones?.[seg.id] || [])].sort((a, b) => b.leads - a.leads)
    const total = filas.reduce((a, f) => a + f.leads, 0)
    autoTable(doc, {
      startY: 26, margin: { left: sx }, tableWidth: 130,
      head: [[`Tipificación · ${seg.nombre}`, 'Leads', '%']],
      headStyles: { fillColor: acc, textColor: WHITE, fontSize: 8 },
      body: filas.map((f) => [f.motivo, n0(f.leads), pct(total ? (f.leads / total) * 100 : 0)]),
      foot: [[{ content: 'Total', styles: { fontStyle: 'bold', textColor: WHITE, fillColor: INK } }, { content: n0(total), styles: { halign: 'right', fontStyle: 'bold', textColor: WHITE, fillColor: INK } }, { content: '100%', styles: { halign: 'right', fontStyle: 'bold', textColor: WHITE, fillColor: INK } }]],
      bodyStyles: { fontSize: 7 }, columnStyles: { 0: { cellWidth: 95 }, 1: { halign: 'right' }, 2: { halign: 'right' } },
      styles: { lineColor: LINE, lineWidth: 0.2 },
    })
    sx += 138
  })
  const ty = (doc.lastAutoTable?.finalY || 150) + 6
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK)
  doc.text('Ticket promedio', M, ty)
  autoTable(doc, {
    startY: ty + 2, margin: { left: M }, tableWidth: 80,
    body: (data.ticket || []).map((t) => [t.tipo, money(t.valor, cfg.moneda)]),
    bodyStyles: { fontSize: 9 }, columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    styles: { lineColor: LINE, lineWidth: 0.2 },
  })
}

function slideObjetivos(ctx) {
  const { doc, acc, cfg, data } = ctx
  titulo(ctx, 'Inversión y matrículas vs objetivo')
  const m = data.metas || {}, leads = m.leads || {}, mat = m.matriculas || {}
  const v = m.inversionVentana
  const cpl = leads.inversion && v?.leads ? leads.inversion / v.leads : null
  const kpis = [
    ['Leads', `${n0(leads.real)}${leads.meta ? ` / ${n0(leads.meta)}` : ''}`, leads.meta ? `${pct((leads.real / leads.meta) * 100, 0)} de la meta` : 'objetivo pendiente'],
    ['Inversión (ads)', money(leads.inversion, cfg.moneda), cpl ? `CPL ${money(cpl, cfg.moneda)}` : ''],
    ['Matrículas', `${n0(mat.real)}${mat.meta ? ` / ${n0(mat.meta)}` : ''}`, mat.meta ? `${pct((mat.real / mat.meta) * 100, 0)} de la meta` : 'objetivo pendiente'],
    ['Acumulado ciclo', n0(mat.acumulado), ''],
  ]
  let x = M
  const cw = 62, cy = 40, ch = 42
  kpis.forEach(([lbl, val, sub]) => {
    doc.setFillColor(247, 248, 251); doc.setDrawColor(...LINE); doc.roundedRect(x, cy, cw, ch, 2, 2, 'FD')
    doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(lbl, x + cw / 2, cy + 9, { align: 'center' })
    doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(String(val), x + cw / 2, cy + 22, { align: 'center' })
    if (sub) { doc.setTextColor(...acc); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(sub, x + cw / 2, cy + 32, { align: 'center' }) }
    x += cw + 6
  })
}
