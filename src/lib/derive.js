// Cálculos derivados del modelo de una cuenta.

export function programasDe(data, segId) {
  return (data.programas || []).filter((p) => p.segmento === segId)
}

// Segmento "principal" (Másters/GMP) = el primero; "diplomados" = el segundo.
export function segPrincipal(cfg) { return cfg.segmentos[0] }
export function segDiplomados(cfg) { return cfg.segmentos.find((s) => s.id === 'dip') || cfg.segmentos[1] }

// Agrupa filas por cohorte. Devuelve [{cohorte, filas, subtotal}]. Si no hay
// cohortes (todas null), devuelve un solo grupo con cohorte=null.
export function agruparPorCohorte(filas) {
  const hayCohorte = filas.some((f) => f.cohorte)
  if (!hayCohorte) return [{ cohorte: null, filas, subtotal: subtotalDe(filas) }]
  const mapa = new Map()
  for (const f of filas) {
    const k = f.cohorte || 'Sin cohorte'
    if (!mapa.has(k)) mapa.set(k, [])
    mapa.get(k).push(f)
  }
  return [...mapa.entries()].map(([cohorte, fs]) => ({ cohorte, filas: fs, subtotal: subtotalDe(fs) }))
}

export function subtotalDe(filas) {
  return filas.reduce(
    (a, f) => ({
      gestionados: a.gestionados + f.gestionados,
      noUtil: a.noUtil + f.noUtil,
      potenciales: a.potenciales + f.potenciales,
      matriculados: a.matriculados + f.matriculados,
      total: a.total + f.total,
    }),
    { gestionados: 0, noUtil: 0, potenciales: 0, matriculados: 0, total: 0 },
  )
}

// Pasos del funnel con ancho relativo y conversión relativa a la base correcta.
// No es un embudo estrictamente secuencial: "no útiles" y "en gestión" se miden
// sobre el total; "potenciales" y "matriculados" sobre "en gestión" (como el PDF).
export function pasosFunnel(f) {
  const g = f.enGestion || 1
  const t = f.leadsTotales || 1
  const pasos = [
    { id: 'leadsTotales', label: 'Leads totales', val: f.leadsTotales, conv: null },
    { id: 'noUtiles', label: 'No útiles', val: f.noUtiles, conv: pct(f.noUtiles, t), base: 'del total' },
    { id: 'enGestion', label: 'En gestión', val: f.enGestion, conv: pct(f.enGestion, t), base: 'del total' },
    { id: 'potenciales', label: 'Potenciales', val: f.potenciales, conv: pct(f.potenciales, g), base: 'de en gestión' },
    { id: 'matriculados', label: 'Matriculados', val: f.matriculados, conv: pct(f.matriculados, g), base: 'de en gestión' },
  ]
  const max = Math.max(...pasos.map((p) => p.val), 1)
  return pasos.map((p) => ({ ...p, w: 40 + 60 * (p.val / max) }))
}

function pct(a, b) { return b ? (a / b) * 100 : 0 }

export function cohortesDisponibles(data) {
  const set = new Set()
  for (const p of data.programas || []) if (p.cohorte) set.add(p.cohorte)
  return [...set]
}
