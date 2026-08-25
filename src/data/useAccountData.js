import { useCallback, useEffect, useState } from 'react'

// Fuente de datos del tablero:
//  - 'snapshot' (default): lee /snapshots/<cuenta>.json (agregado real, generado del
//    lado servidor/offline). Rápido y sin exponer la API.
//  - 'live': pega a /api/nods?endpoint=agg&cuenta=... (serverless que agrega en vivo).
const MODE = (import.meta.env.VITE_DATA_MODE ?? 'snapshot')

function appKey() {
  try { return sessionStorage.getItem('nods_app_key') || '' } catch { return '' }
}

export function useAccountData(cuentaCfg, filtros) {
  const [state, setState] = useState({ loading: true, error: null, data: null, actualizado: null, modo: MODE })

  const cargar = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      let data
      if (MODE === 'live') {
        const qs = new URLSearchParams({ endpoint: 'agg', cuenta: cuentaCfg.cuenta })
        if (filtros?.fechaInicio) qs.set('fecha_inicio', filtros.fechaInicio)
        if (filtros?.fechaFin) qs.set('fecha_fin', filtros.fechaFin)
        const r = await fetch(`/api/nods?${qs}`, { headers: { 'x-app-key': appKey() } })
        if (!r.ok) throw new Error(`API ${r.status}`)
        data = await r.json()
      } else {
        const r = await fetch(`/snapshots/${cuentaCfg.id}.json`, { cache: 'no-store' })
        if (!r.ok) throw new Error(`snapshot ${r.status}`)
        data = await r.json()
      }
      setState({ loading: false, error: null, data, actualizado: new Date(), modo: MODE })
    } catch (e) {
      setState({ loading: false, error: String(e), data: null, actualizado: null, modo: MODE })
    }
  }, [cuentaCfg, filtros?.fechaInicio, filtros?.fechaFin])

  useEffect(() => { cargar() }, [cargar])

  return { ...state, recargar: cargar }
}
