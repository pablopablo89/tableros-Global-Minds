// Semanas de lunes a domingo.

// Lunes de la semana que contiene `d` (00:00 local).
export function lunesDe(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const dow = (x.getDay() + 6) % 7 // 0 = lunes ... 6 = domingo
  x.setDate(x.getDate() - dow)
  return x
}

export function domingoDe(d) {
  const l = lunesDe(d)
  const dom = new Date(l)
  dom.setDate(l.getDate() + 6)
  dom.setHours(23, 59, 59, 999)
  return dom
}

// Semana en curso y semana anterior (según fecha de referencia, por defecto hoy).
export function rangosSemana(ref = new Date()) {
  const inicioActual = lunesDe(ref)
  const finActual = domingoDe(ref)
  const inicioAnterior = new Date(inicioActual)
  inicioAnterior.setDate(inicioActual.getDate() - 7)
  const finAnterior = new Date(finActual)
  finAnterior.setDate(finActual.getDate() - 7)
  return {
    actual: { inicio: inicioActual, fin: finActual },
    anterior: { inicio: inicioAnterior, fin: finAnterior },
  }
}

// Lista de semanas (lun-dom) que cubren un rango, para el selector "por semana".
export function semanasEntre(inicio, fin) {
  const out = []
  let cur = lunesDe(inicio)
  const tope = lunesDe(fin)
  while (cur <= tope) {
    out.push({ inicio: new Date(cur), fin: domingoDe(cur) })
    cur = new Date(cur)
    cur.setDate(cur.getDate() + 7)
  }
  return out
}

// Cuenta ítems (con .fecha ISO) dentro de un rango [inicio, fin].
export function contarEnRango(items, inicio, fin, getFecha = (x) => x.fecha) {
  if (!Array.isArray(items)) return 0
  const a = +new Date(inicio)
  const b = +new Date(fin)
  return items.reduce((acc, it) => {
    const t = +new Date(getFecha(it))
    return acc + (t >= a && t <= b ? 1 : 0)
  }, 0)
}
