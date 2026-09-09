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
// Embudo secuencial que RESTA: Leads totales → En gestión (útiles = total − no útiles)
// → Matriculados. "No útiles" se muestra como deducción en el primer conector.
// "Potenciales" (en proceso de pago) es un estado transitorio → va como anotación aparte.
export function pasosFunnel(f) {
  const t = f.leadsTotales || 1
  const utiles = f.utiles != null ? f.utiles : (f.leadsTotales || 0) - (f.noUtiles || 0)
  const g = utiles || 1
  const pasos = [
    { id: 'leadsTotales', label: 'Leads totales', val: f.leadsTotales, conv: null },
    { id: 'enGestion', label: 'En gestión', val: utiles, conv: pct(utiles, t), base: 'del total', deducVal: f.noUtiles, deducPct: pct(f.noUtiles, t) },
    { id: 'matriculados', label: 'Matriculados', val: f.matriculados, conv: pct(f.matriculados, g), base: 'de en gestión' },
  ]
  const max = Math.max(...pasos.map((p) => p.val), 1)
  return pasos.map((p) => ({ ...p, w: 40 + 60 * (p.val / max) }))
}

function pct(a, b) { return b ? (a / b) * 100 : 0 }

const normNombre = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// Distancia de edición (Levenshtein) acotada.
function editDist(a, b) {
  const la = a.length, lb = b.length
  if (Math.abs(la - lb) > 6) return 99
  const dp = Array.from({ length: lb + 1 }, (_, j) => j)
  for (let i = 1; i <= la; i++) {
    let prev = dp[0]; dp[0] = i
    for (let j = 1; j <= lb; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[lb]
}
// ¿Son "prácticamente el mismo" nombre? (diferencia de pocas letras / typo)
function nombresSimilares(a, b) {
  if (a === b) return true
  const maxLen = Math.max(a.length, b.length)
  if (maxLen < 12) return false // nombres cortos: exigimos igualdad exacta
  return editDist(a, b) <= Math.max(2, Math.round(maxLen * 0.06))
}

// Consolida filas de programa por NOMBRE (suma cohortes/bases) y ADEMÁS fusiona
// nombres casi idénticos (typos, una letra de diferencia).
export function consolidarProgramas(filas) {
  // paso 1: merge exacto por nombre normalizado
  const mapa = new Map()
  for (const f of filas) {
    const k = normNombre(f.nombre)
    if (!mapa.has(k)) mapa.set(k, { ...f, cohorte: null })
    else {
      const a = mapa.get(k)
      a.gestionados += f.gestionados; a.noUtil += f.noUtil
      a.potenciales += f.potenciales; a.matriculados += f.matriculados; a.total += f.total
    }
  }
  // paso 2: fusión difusa (el de mayor total conserva el nombre)
  const items = [...mapa.values()].map((r) => ({ r, k: normNombre(r.nombre) })).sort((a, b) => b.r.total - a.r.total)
  const out = []
  for (const it of items) {
    const dst = out.find((o) => nombresSimilares(o.k, it.k))
    if (dst) {
      dst.r.gestionados += it.r.gestionados; dst.r.noUtil += it.r.noUtil
      dst.r.potenciales += it.r.potenciales; dst.r.matriculados += it.r.matriculados; dst.r.total += it.r.total
    } else out.push({ r: { ...it.r }, k: it.k })
  }
  return out.map((o) => o.r).sort((a, b) => b.matriculados - a.matriculados)
}

export function cohortesDisponibles(data) {
  const set = new Set()
  for (const p of data.programas || []) if (p.cohorte) set.add(p.cohorte)
  return [...set]
}
