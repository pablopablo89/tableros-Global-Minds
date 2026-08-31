import { useMemo, useState } from 'react'
import { useAccountData } from '../data/useAccountData.js'
import { n0, fecha } from '../lib/format.js'
import { programasDe, segPrincipal, segDiplomados, consolidarProgramas } from '../lib/derive.js'
import { semanasEntre } from '../lib/weeks.js'
import { fechaCorta } from '../lib/format.js'
import Funnel from './Funnel.jsx'
import Metas from './Metas.jsx'
import Insights from './Insights.jsx'
import WeeklyLeads from './WeeklyLeads.jsx'
import ProgramTable from './ProgramTable.jsx'
import CityChart from './CityChart.jsx'
import Tipificaciones from './Tipificaciones.jsx'
import Ticket from './Ticket.jsx'
import DailyChart from './DailyChart.jsx'
import ReportModal from '../report/ReportModal.jsx'

export default function AccountView({ cuenta }) {
  const [filtros, setFiltros] = useState({})
  const [semanaSel, setSemanaSel] = useState('todas')
  const [showReport, setShowReport] = useState(false)
  const [refrescando, setRefrescando] = useState(false)
  const [msgRefresco, setMsgRefresco] = useState('')

  const actualizarDatos = async () => {
    setRefrescando(true); setMsgRefresco('Iniciando actualización…')
    let key = ''
    try { key = sessionStorage.getItem('nods_app_key') || '' } catch {}
    const prev = data?.actualizado
    try {
      const r = await fetch('/api/refresh', { method: 'POST', headers: { 'x-app-key': key } })
      if (!r.ok) { const j = await r.json().catch(() => ({})); setMsgRefresco('No se pudo iniciar: ' + (j.error || r.status)); setRefrescando(false); return }
      setMsgRefresco('⏳ Trayendo datos nuevos de NODS… tarda ~2 minutos, dejá esta pestaña abierta.')
      const start = Date.now()
      const poll = async () => {
        if (Date.now() - start > 300000) { setMsgRefresco('Está tardando más de lo normal. Probá recargar la página en unos minutos.'); setRefrescando(false); return }
        try {
          const s = await fetch(`/snapshots/${cuenta.id}.json?t=${Date.now()}`, { cache: 'no-store' })
          if (s.ok) {
            const j = await s.json()
            if (j.actualizado && j.actualizado !== prev) { setMsgRefresco('✓ ¡Datos actualizados!'); setRefrescando(false); recargar(); return }
          }
        } catch {}
        setTimeout(poll, 12000)
      }
      setTimeout(poll, 25000)
    } catch (e) { setMsgRefresco('Error: ' + e); setRefrescando(false) }
  }
  const { loading, error, data, actualizado, modo, recargar } = useAccountData(cuenta, filtros)

  const semanasDisp = data?.semanal || []
  const mesesDisp = data?.mensual || []
  const semView = semanaSel !== 'todas' // hay un período (mes o semana) seleccionado
  // Vista según período elegido (M:<mes> o S:<lunes>): reemplaza el núcleo por el slice
  // guardado en el snapshot. El resto (objetivos, evolución) queda del ciclo.
  const dataVista = useMemo(() => {
    if (!data) return null
    if (semanaSel === 'todas') return data
    if (semanaSel.startsWith('M:')) {
      const m = (data.mensual || []).find((x) => x.mes === semanaSel.slice(2))
      return m ? { ...data, ...m } : data
    }
    const w = (data.semanal || []).find((x) => x.semana === semanaSel.replace(/^S:/, ''))
    return w ? { ...data, ...w } : data
  }, [data, semanaSel])
  const semanas = useMemo(() => {
    const hoy = new Date()
    const inicio = new Date(hoy); inicio.setDate(hoy.getDate() - 7 * 11)
    return semanasEntre(inicio, hoy).reverse()
  }, [])

  const elegirSemana = (val) => {
    if (!val) { setFiltros((f) => ({ ...f, fechaInicio: undefined, fechaFin: undefined })); return }
    const s = semanas[Number(val)]
    setFiltros((f) => ({ ...f, fechaInicio: s.inicio.toISOString(), fechaFin: s.fin.toISOString() }))
  }

  return (
    <div>
      <div className="acct-head">
        <div>
          <h1>{cuenta.nombre}</h1>
          <div className="sub">{cuenta.subtitulo}</div>
        </div>
        <div className="meta">
          {data?.actualizado
            ? <>Datos actualizados<br /><b>{new Date(data.actualizado).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</b><br /></>
            : data && <>Datos al <b>{fecha(data.fechaCorte)}</b><br /></>}
          <span className="small faint">datos reales · API NODS</span>
          {data?.cobertura && <div className="small faint">{n0(data.cobertura.leads)} leads · {n0(data.cobertura.matriculas)} matrículas</div>}
        </div>
      </div>

      {/* Toolbar / filtros */}
      <div className="toolbar">
        <div className="field">
          <label>Período</label>
          <select value={semanaSel} onChange={(e) => setSemanaSel(e.target.value)}>
            <option value="todas">Todo el ciclo</option>
            <optgroup label="Por mes">
              {mesesDisp.map((m) => <option key={m.mes} value={'M:' + m.mes}>{mesLabel(m.mes)}</option>)}
            </optgroup>
            <optgroup label="Por semana (lun–dom)">
              {semanasDisp.map((s) => <option key={s.semana} value={'S:' + s.semana}>{fechaCorta(s.semana)} – {fechaCorta(s.fin)}</option>)}
            </optgroup>
          </select>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={actualizarDatos} disabled={refrescando} title="Trae datos nuevos de NODS (~2 min)">{refrescando ? '⏳ Actualizando…' : '⟳ Actualizar datos'}</button>
        <button className="btn primary" onClick={() => setShowReport(true)} disabled={!data}>Generar reporte</button>
      </div>
      {msgRefresco && <div className="card" style={{ marginBottom: 16 }}><div className="card-b small">{msgRefresco}</div></div>}

      {modo !== 'live' && (
        <p className="small faint" style={{ marginTop: -6, marginBottom: 16 }}>
          Los datos se actualizan solos cada mañana. El botón "Actualizar" recarga la última versión publicada.
        </p>
      )}

      {loading && <div className="card"><div className="card-b">Cargando datos…</div></div>}
      {error && <div className="card"><div className="card-b down">Error: {error}</div></div>}

      {dataVista && (
        <>
          {semView && (
            <div className="card" style={{ marginBottom: 16, borderColor: cuenta.acento }}>
              <div className="card-b small">
                📅 Mostrando <b>el período seleccionado</b>. Los objetivos, la inversión y la evolución son del ciclo completo y se ocultan en esta vista. Elegí <b>"Todo el ciclo"</b> para volver.
              </div>
            </div>
          )}

          {/* KPIs */}
          <div className="grid cols-4">
            <Kpi lbl="Leads totales" val={n0(dataVista.funnel.leadsTotales)} />
            <Kpi lbl="En gestión" val={n0(dataVista.funnel.enGestion)} />
            <Kpi lbl="Potenciales" val={n0(dataVista.funnel.potenciales)} />
            <Kpi lbl="Matriculados" val={n0(dataVista.funnel.matriculados)} />
          </div>

          {data.ventasMes && (
            <div className="card" style={{ marginTop: 18 }}>
              <div className="card-h">
                <h2>Ventas del mes — {mesLabel(data.ventasMes.mes)}</h2>
                <span className="hint">matrículas acumuladas del mes en curso</span>
              </div>
              <div className="card-b">
                <div className="grid cols-3">
                  {cuenta.segmentos.map((s) => (
                    <div key={s.id} className="card kpi" style={{ boxShadow: 'none' }}>
                      <div className="lbl">{s.nombre}</div>
                      <div className="val">{n0(data.ventasMes.porSegmento[s.id] || 0)}</div>
                    </div>
                  ))}
                  <div className="card kpi" style={{ boxShadow: 'none', borderColor: cuenta.acento }}>
                    <div className="lbl">Total</div>
                    <div className="val" style={{ color: cuenta.acento }}>{n0(data.ventasMes.total)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="section-title">Resumen</div>
          <div className="grid cols-2">
            <Funnel data={dataVista} cfg={cuenta} />
            {semView ? <Ticket data={dataVista} cfg={cuenta} /> : <Insights data={dataVista} cfg={cuenta} />}
          </div>

          {!semView && <>
            <div className="section-title">Objetivos · inversión · semana</div>
            <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
              <Metas data={data} cfg={cuenta} />
              <WeeklyLeads data={data} cfg={cuenta} />
            </div>

            <div className="section-title">Evolución diaria</div>
            <DailyChart data={data} cfg={cuenta} />
          </>}

          <div className="section-title">Detalle por programa</div>
          <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
            <ProgramTable titulo={segPrincipal(cuenta).nombre} filas={consolidarProgramas(programasDe(dataVista, segPrincipal(cuenta).id))} />
            <ProgramTable titulo="Diplomados" filas={consolidarProgramas(programasDe(dataVista, segDiplomados(cuenta).id)).filter((p) => p.total >= 3)} />
          </div>

          <div className="section-title">Geografía</div>
          <CityChart data={dataVista} />

          <div className="section-title">Motivos de no compra y ticket</div>
          <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
            <Tipificaciones data={dataVista} cfg={cuenta} />
            <Ticket data={dataVista} cfg={cuenta} />
          </div>
        </>
      )}

      {showReport && <ReportModal data={data} cfg={cuenta} onClose={() => setShowReport(false)} />}
    </div>
  )
}

function Kpi({ lbl, val }) {
  return (
    <div className="card kpi">
      <div className="lbl">{lbl}</div>
      <div className="val">{val}</div>
    </div>
  )
}

function mesLabel(yyyymm) {
  try {
    const d = new Date(yyyymm + '-01T00:00:00')
    const s = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  } catch { return yyyymm }
}

function toDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
