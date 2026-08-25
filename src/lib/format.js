// Formato de números al estilo de los reportes (miles con punto, decimales con coma).

const nf0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const n0 = (v) => (v == null || isNaN(v) ? '—' : nf0.format(v))
export const n2 = (v) => (v == null || isNaN(v) ? '—' : nf2.format(v))

export function money(v, moneda = 'USD') {
  if (v == null || isNaN(v)) return '—'
  const símbolo = moneda === 'MXN' ? '$' : moneda === 'USD' ? '$' : ''
  return `${símbolo}${nf2.format(v)}`
}

export function pct(v, decimales = 2) {
  if (v == null || isNaN(v)) return '—'
  return `${v.toFixed(decimales).replace('.', ',')}%`
}

// Porcentaje de avance sobre meta (0–∞), formateado.
export function avance(valor, meta) {
  if (!meta) return null
  return (valor / meta) * 100
}

const fFecha = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
const fFechaCorta = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' })
export const fecha = (d) => (d ? fFecha.format(new Date(d)) : '—')
export const fechaCorta = (d) => (d ? fFechaCorta.format(new Date(d)) : '—')
