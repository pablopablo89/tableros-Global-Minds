import { useMemo, useState } from 'react'
import { n0, pct, money, fecha, fechaCorta } from '../lib/format.js'

// Página "Performance": desglose por programa (contactabilidad, conversiones, motivos
// de cierre, descuento), cumplimiento de objetivos y datos de pauta (inversión, alcance,
// CPL). Filtros por período (mes/semana) y por programa. Sólo tablero.
export default function PerformanceView({ cuenta, data, onBack }) {
  const [periodo, setPeriodo] = useState('todas')
  const [prog, setProg] = useState('todos')
  const meses = data?.mensual || []
  const semanas = data?.semanal || []

  const vista = useMemo(() => {
    if (!data) return null
    if (periodo === 'todas') return data
    if (periodo.startsWith('M:')) return { ...data, ...(data.mensual || []).find((x) => x.mes === periodo.slice(2)) }
    return { ...data, ...(data.semanal || []).find((x) => x.semana === periodo.replace(/^S:/, '')) }
  }, [data, periodo])
  const periodView = periodo !== 'todas'

  const selPeriodo = (
    <div className="field">
      <label>Período</label>
      <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
        <option value="todas">Todo el ciclo</option>
        <optgroup label="Por mes">{meses.map((m) => <option key={m.mes} value={'M:' + m.mes}>{mesLabel(m.mes)}</option>)}</optgroup>
        <optgroup label="Por semana (lun–dom)">{semanas.map((s) => <option key={s.semana} value={'S:' + s.semana}>{fechaCorta(s.semana)} – {fechaCorta(s.fin)}</option>)}</optgroup>
      </select>
    </div>
  )

  if (!data || !vista) {
    return <div><BackBar cuenta={cuenta} onBack={onBack} /><div className="card"><div className="card-b">Este snapshot todavía no tiene datos de performance. Tocá “Actualizar datos” en el tablero.</div></div></div>
  }

  const perf = data.performance || {}
  const ads = perf.ads || {}
  const obj = perf.objetivos || {}
  const detalleTodos = vista.programasDetalle || []
  const opciones = [...(data.programasDetalle || [])].sort((a, b) => a.nombre.localeCompare(b.nombre))
  const progSel = prog !== 'todos' ? detalleTodos.find((p) => p.key === prog) : null
  const filas = [...(prog !== 'todos' ? detalleTodos.filter((p) => p.key === prog) : detalleTodos)]
    .sort((a, b) => b.matriculados - a.matriculados || b.total - a.total)
  const adsSel = prog !== 'todos' ? (perf.adsPorPrograma || []).find((a) => a.key === prog) : null

  const selPrograma = (
    <div className="field" style={{ minWidth: 240 }}>
      <label>Programa</label>
      <select value={prog} onChange={(e) => setProg(e.target.value)}>
        <option value="todos">Todos los programas</option>
        {opciones.map((p) => <option key={p.segmento + '|' + p.key} value={p.key}>{limpiar(p.nombre)}</option>)}
      </select>
    </div>
  )

  const mm = obj.matriculas || {}
  const objPct = mm.meta ? (mm.real / mm.meta) * 100 : null

  return (
    <div>
      <BackBar cuenta={cuenta} onBack={onBack} />
      <div className="toolbar">{selPeriodo}{selPrograma}<div className="spacer" /></div>

      {/* Pauta / alcance / CPL (ventana con inversión) */}
      <div className="section-title">Pauta · alcance · CPL {ads.ventana && <span className="faint" style={{ textTransform: 'none', fontWeight: 400 }}>· ventana {fechaCorta(ads.ventana.desde)}–{fechaCorta(ads.ventana.hasta)}</span>}</div>
      {adsSel && (
        <div className="card" style={{ marginBottom: 12, borderColor: cuenta.acento }}>
          <div className="card-b small">📣 Pauta del programa <b>{limpiar(adsSel.nombre)}</b>: inversión <b>{money(adsSel.inversion, cuenta.moneda)}</b> · {n0(adsSel.leadsAds)} leads de ads · CPL <b>{adsSel.cpl != null ? money(adsSel.cpl, cuenta.moneda) : '—'}</b> · alcance {n0(adsSel.alcance)} · {n0(adsSel.impresiones)} impresiones.</div>
        </div>
      )}
      <div className="grid cols-4">
        <Kpi lbl="Inversión en ads" val={money(ads.inversion, cuenta.moneda)} />
        <Kpi lbl="CPL global" val={ads.cplReal != null ? money(ads.cplReal, cuenta.moneda) : '—'} sub="inversión / leads reales" />
        <Kpi lbl="Alcance (personas)" val={ads.alcance ? n0(ads.alcance) : '—'} sub={ads.impresiones ? `${n0(ads.impresiones)} impresiones` : null} />
        <Kpi lbl="Clics salientes" val={ads.clics ? n0(ads.clics) : '—'} sub={ads.ctr != null ? `CTR ${pct(ads.ctr, 2)}` : null} />
      </div>
      <p className="small faint" style={{ marginTop: 8 }}>La inversión y el alcance corresponden a la ventana descargada de Meta Ads (mes en curso); no cambian con el filtro de período.</p>

      {/* Cumplimiento de objetivos en matrículas */}
      <div className="section-title">Cumplimiento de objetivos · matrículas</div>
      <div className="card">
        <div className="card-b">
          <Meter titulo="Total matrículas" real={mm.real} meta={mm.meta} pct={objPct} acc={cuenta.acento} />
          <div className="grid cols-2" style={{ marginTop: 8 }}>
            {cuenta.segmentos.map((s) => {
              const ps = obj.porSegmento?.[s.id]
              if (!ps) return null
              const p = ps.matMeta ? (ps.matReal / ps.matMeta) * 100 : null
              return <Meter key={s.id} titulo={s.nombre} real={ps.matReal} meta={ps.matMeta} pct={p} acc={cuenta.acento} />
            })}
          </div>
          <p className="small faint" style={{ margin: '10px 0 0' }}>Objetivos del ciclo completo (NODS los carga por semana).</p>
        </div>
      </div>

      {/* Detalle por programa */}
      <div className="section-title">Detalle por programa {periodView && <span className="faint" style={{ textTransform: 'none', fontWeight: 400 }}>· período seleccionado</span>}</div>
      <div className="card">
        <div className="table-wrap">
          <table className="data">
            <thead><tr>
              <th>Programa</th><th>Leads</th><th>Contacto</th><th>Potenc.</th><th>Matrículas</th><th>Conv.</th><th>Descuento</th><th>Motivo de cierre #1</th>
            </tr></thead>
            <tbody>
              {filas.map((p, i) => (
                <tr key={i}>
                  <td>{limpiar(p.nombre)}</td>
                  <td>{n0(p.total)}</td>
                  <td>{pct(p.contactoPct, 0)}</td>
                  <td>{n0(p.potenciales)}</td>
                  <td><b>{n0(p.matriculados)}</b></td>
                  <td>{pct(p.convLead, 1)}</td>
                  <td>{p.descuento != null ? pct(p.descuento, 0) : '—'}</td>
                  <td>{p.motivos?.[0] ? `${p.motivos[0].motivo} (${n0(p.motivos[0].leads)})` : '—'}</td>
                </tr>
              ))}
              {!filas.length && <tr><td colSpan={8} className="faint">Sin datos en este período.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalle del programa seleccionado: motivos de cierre completos */}
      {progSel && (
        <>
          <div className="section-title">Motivos de cierre · {limpiar(progSel.nombre)}</div>
          <div className="grid cols-2">
            <div className="card">
              <div className="card-h"><h2>Motivos de cierre</h2><span className="hint">{n0(progSel.noUtil)} cierres</span></div>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Motivo</th><th>Leads</th><th>%</th></tr></thead>
                  <tbody>
                    {(progSel.motivos || []).map((m, i) => (
                      <tr key={i}><td>{m.motivo}</td><td>{n0(m.leads)}</td><td>{pct(progSel.noUtil ? (m.leads / progSel.noUtil) * 100 : 0, 0)}</td></tr>
                    ))}
                    {!progSel.motivos?.length && <tr><td colSpan={3} className="faint">Sin motivos registrados.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-h"><h2>Embudo del programa</h2></div>
              <div className="card-b">
                <Linea k="Leads" v={n0(progSel.total)} />
                <Linea k="Gestionados" v={n0(progSel.gestionados)} />
                <Linea k="Tasa de contacto" v={pct(progSel.contactoPct, 1)} />
                <Linea k="Potenciales" v={n0(progSel.potenciales)} />
                <Linea k="Matrículas" v={n0(progSel.matriculados)} />
                <Linea k="Conversión lead → matrícula" v={pct(progSel.convLead, 2)} />
                <Linea k="Conversión contacto → matrícula" v={pct(progSel.convContacto, 2)} />
                <Linea k="Descuento promedio" v={progSel.descuento != null ? pct(progSel.descuento, 1) : '—'} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function BackBar({ cuenta, onBack }) {
  return (
    <div className="acct-head">
      <div>
        <button className="btn" onClick={onBack} style={{ marginBottom: 10 }}>← Volver al tablero</button>
        <h1>📊 Performance</h1>
        <div className="sub">{cuenta.nombre} · rendimiento por programa</div>
      </div>
    </div>
  )
}

function Kpi({ lbl, val, sub }) {
  return (
    <div className="card kpi">
      <div className="lbl">{lbl}</div>
      <div className="val small">{val}</div>
      {sub && <div className="delta faint">{sub}</div>}
    </div>
  )
}

function Meter({ titulo, real, meta, pct: p, acc }) {
  const w = p == null ? 0 : Math.min(p, 100)
  const color = p == null ? acc : p >= 100 ? '#2E9E6B' : p >= 80 ? acc : '#C6902F'
  return (
    <div className="meter">
      <div className="m-top"><span className="k">{titulo}</span><span><b>{n0(real)}</b> / {meta != null ? n0(meta) : '—'} {p != null && <span className="faint">· {pct(p, 0)}</span>}</span></div>
      <div className="track"><div className="fill" style={{ width: `${w}%`, background: color }} /></div>
    </div>
  )
}

function Linea({ k, v }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 13 }}><span className="muted">{k}</span><b>{v}</b></div>
}

const limpiar = (nombre) => String(nombre).replace(/^(Master|Diplomado|GMP|DIPLOMADO)\s*[-–]\s*/i, '').trim()
function mesLabel(yyyymm) {
  try { const s = new Date(yyyymm + '-01T00:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1) } catch { return yyyymm }
}
