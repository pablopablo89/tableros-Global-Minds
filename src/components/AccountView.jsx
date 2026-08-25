import { useMemo, useState } from 'react'
import { useAccountData } from '../data/useAccountData.js'
import { n0, fecha } from '../lib/format.js'
import { cohortesDisponibles, programasDe, segPrincipal, segDiplomados } from '../lib/derive.js'
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
  const [cohorte, setCohorte] = useState('todas')
  const [showReport, setShowReport] = useState(false)
  const { loading, error, data, actualizado, modo, recargar } = useAccountData(cuenta, filtros)

  const cohortes = useMemo(() => (data ? cohortesDisponibles(data) : []), [data])
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
          {data && <>Datos al <b>{fecha(data.fechaCorte)}</b><br /></>}
          {actualizado && <>Actualizado {actualizado.toLocaleTimeString('es-ES')}<br /></>}
          {modo === 'live' ? <span className="small faint">en vivo · API NODS</span> : <span className="small faint">datos reales · snapshot</span>}
          {data?.cobertura && <div className="small faint">{n0(data.cobertura.leads)} leads · {n0(data.cobertura.matriculas)} matrículas</div>}
        </div>
      </div>

      {/* Toolbar / filtros */}
      <div className="toolbar">
        <div className="field">
          <label>Desde</label>
          <input type="date" value={toDate(filtros.fechaInicio)} onChange={(e) => setFiltros((f) => ({ ...f, fechaInicio: e.target.value ? new Date(e.target.value).toISOString() : undefined }))} />
        </div>
        <div className="field">
          <label>Hasta</label>
          <input type="date" value={toDate(filtros.fechaFin)} onChange={(e) => setFiltros((f) => ({ ...f, fechaFin: e.target.value ? new Date(e.target.value).toISOString() : undefined }))} />
        </div>
        <div className="field">
          <label>Semana (lun–dom)</label>
          <select onChange={(e) => elegirSemana(e.target.value)} defaultValue="">
            <option value="">Todas</option>
            {semanas.map((s, i) => (
              <option key={i} value={i}>{fechaCorta(s.inicio)} – {fechaCorta(s.fin)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Cohorte (diplomados)</label>
          <select value={cohorte} onChange={(e) => setCohorte(e.target.value)}>
            <option value="todas">Todas</option>
            {cohortes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={recargar} disabled={loading}>{loading ? 'Cargando…' : '↻ Actualizar'}</button>
        <button className="btn primary" onClick={() => setShowReport(true)} disabled={!data}>Generar reporte</button>
      </div>

      {modo !== 'live' && (
        <p className="small faint" style={{ marginTop: -6, marginBottom: 16 }}>
          Vista de datos reales (snapshot del ciclo). Los filtros de fecha/semana se aplican en modo "en vivo" contra la API.
        </p>
      )}

      {loading && <div className="card"><div className="card-b">Cargando datos…</div></div>}
      {error && <div className="card"><div className="card-b down">Error: {error}</div></div>}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid cols-4">
            <Kpi lbl="Leads totales" val={n0(data.funnel.leadsTotales)} />
            <Kpi lbl="En gestión" val={n0(data.funnel.enGestion)} />
            <Kpi lbl="Potenciales" val={n0(data.funnel.potenciales)} />
            <Kpi lbl="Matriculados" val={n0(data.funnel.matriculados)} />
          </div>

          <div className="section-title">Resumen</div>
          <div className="grid cols-2">
            <Funnel data={data} cfg={cuenta} />
            <Insights data={data} cfg={cuenta} />
          </div>

          <div className="section-title">Objetivos · inversión · semana</div>
          <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
            <Metas data={data} cfg={cuenta} />
            <WeeklyLeads data={data} cfg={cuenta} />
          </div>

          <div className="section-title">Evolución diaria</div>
          <DailyChart data={data} cfg={cuenta} />

          <div className="section-title">Detalle por programa</div>
          <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
            <ProgramTable titulo={segPrincipal(cuenta).nombre} filas={programasDe(data, segPrincipal(cuenta).id)} />
            <ProgramTable titulo="Diplomados" filas={programasDe(data, segDiplomados(cuenta).id)} agruparCohorte cohorteFiltro={cohorte} />
          </div>

          <div className="section-title">Geografía</div>
          <CityChart data={data} />

          <div className="section-title">Motivos de no compra y ticket</div>
          <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
            <Tipificaciones data={data} cfg={cuenta} />
            <Ticket data={data} cfg={cuenta} />
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

function toDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
