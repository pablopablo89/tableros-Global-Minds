import { useMemo, useState } from 'react'
import { n0, pct, money, fechaCorta } from '../lib/format.js'
import DailyChart from './DailyChart.jsx'
import { Gauge, MatrizCreativos, Demografia } from './PerfCharts.jsx'

// Peso comercial de un Máster/GMP en "unidades equivalentes" de diplomado.
const PESO_PREMIUM = 2.5
const PESO_LABEL = String(PESO_PREMIUM).replace('.', ',')

// Página "Performance": pensada para leerse como un reporte de agencia.
//  · GMP/Másters y Diplomados SEPARADOS (1 Máster/GMP = 3 diplomados en valor).
//  · Cruce CREATIVOS → VENTAS: qué formato y qué ángulo de anuncio vende (no sólo trae leads).
//  · Cada métrica lleva un "?" que explica qué es y de dónde sale.
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

  if (!data || !vista) {
    return <div><BackBar cuenta={cuenta} onBack={onBack} /><div className="card"><div className="card-b">Este snapshot todavía no tiene datos de performance. Tocá “Actualizar datos” en el tablero.</div></div></div>
  }

  const acc = cuenta.acento
  const perf = data.performance || {}
  const ads = perf.ads || {}
  const obj = perf.objetivos || {}
  const invCrea = perf.inversionCreativos || {}
  const crea = vista.creativos || { formatos: [], angulos: [], cobertura: {} }

  const f = vista.funnel || {}
  const convGlobal = f.leadsTotales ? (f.matriculados / f.leadsTotales) * 100 : 0

  // Segmentos: premium (Másters/GMP = ×3) y diplomados (×1).
  const segPrem = cuenta.segmentos[0]
  const segDip = cuenta.segmentos.find((s) => s.id === 'dip') || cuenta.segmentos[1]
  const segRow = (id) => (vista.segmentos || []).find((s) => s.id === id) || {}
  const prem = segRow(segPrem.id), dip = segRow(segDip.id)
  const equiv = (prem.matriculados || 0) * PESO_PREMIUM + (dip.matriculados || 0)
  const premValorPct = equiv ? ((prem.matriculados || 0) * PESO_PREMIUM / equiv) * 100 : 0

  const detalleTodos = vista.programasDetalle || []
  const segOrden = Object.fromEntries(cuenta.segmentos.map((s, i) => [s.id, i]))
  const tipoDe = (segId) => { const s = cuenta.segmentos.find((x) => x.id === segId); return s ? s.nombre.replace(/s$/, '') : '' }
  const opciones = [...(data.programasDetalle || [])].sort((a, b) => (segOrden[a.segmento] - segOrden[b.segmento]) || a.nombre.localeCompare(b.nombre))
  const progSel = prog !== 'todos' ? detalleTodos.find((p) => p.key === prog) : null

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
  const selPrograma = (
    <div className="field" style={{ minWidth: 240 }}>
      <label>Programa (detalle)</label>
      <select value={prog} onChange={(e) => setProg(e.target.value)}>
        <option value="todos">Todos los programas</option>
        {opciones.map((p) => <option key={p.segmento + '|' + p.key} value={p.key}>{tipoDe(p.segmento)} · {limpiar(p.nombre)}</option>)}
      </select>
    </div>
  )

  return (
    <div>
      <BackBar cuenta={cuenta} onBack={onBack} />
      <div className="toolbar">{selPeriodo}{selPrograma}<div className="spacer" />
        <span className="small faint">{periodView ? 'Período seleccionado' : 'Ciclo completo'}</span>
      </div>

      {/* ===== KPIs de cabecera ===== */}
      <div className="grid cols-6">
        <Kpi lbl="Leads" val={n0(f.leadsTotales)} info={<>Leads cargados en el CRM (consulta_base) dentro del período elegido.<span className="src">Fuente: NODS · consulta_base</span></>} />
        <Kpi lbl="Matrículas" val={n0(f.matriculados)} info={<>Inscripciones pagadas en el período.<span className="src">Fuente: NODS · matriculas</span></>} />
        <Kpi lbl="Conversión" val={pct(convGlobal, 2)} info={<>Matrículas ÷ leads del período. Cuántos de cada 100 leads terminan matriculados.<span className="src">Cálculo: matrículas / leads</span></>} />
        <Kpi lbl="Inversión Meta" val={money(ads.inversion, cuenta.moneda)} info={<>Gasto en Meta Ads de la ventana descargada (<b>mes en curso</b>). No cambia con el filtro de período.<span className="src">Fuente: Meta Ads · amount_spent</span></>} />
        <Kpi lbl="CPL global" val={ads.cplReal != null ? money(ads.cplReal, cuenta.moneda) : '—'} info={<>Costo por lead: inversión de la ventana ÷ leads reales de esa ventana.<span className="src">Cálculo: inversión / leads (ventana Meta)</span></>} />
        <Kpi lbl="Alcance" val={ads.alcance ? n0(ads.alcance) : '—'} sub={ads.impresiones ? `${n0(ads.impresiones)} impresiones` : null} info={<>Personas únicas alcanzadas por la pauta en la ventana de Meta.<span className="src">Fuente: Meta Ads · reach</span></>} />
      </div>
      <p className="small faint" style={{ marginTop: 8 }}>
        Inversión, CPL, alcance e impresiones vienen de Meta Ads y cubren {ads.ventana ? <>la ventana <b>{fechaCorta(ads.ventana.desde)}–{fechaCorta(ads.ventana.hasta)}</b> (mes en curso)</> : 'el mes en curso'}; no se mueven con el filtro de período. Leads, matrículas y conversión sí responden al período.
      </p>

      {/* ===== GMP/Másters vs Diplomados, separados ===== */}
      <div className="section-title">Por tipo de programa
        <Info>Se muestran separados porque tienen valor y objetivos distintos: <b>1 {segPrem.nombre.replace(/s$/, '')} equivale a {PESO_LABEL} diplomados</b>.<span className="src">Segmentación por el nombre del programa</span></Info>
      </div>

      <div className="callout" style={{ marginBottom: 14 }}>
        <span className="ic">⚖️</span>
        <div>
          <b>Valor equivalente:</b> {n0(equiv)} unidades <span className="faint">(1 {segPrem.nombre.replace(/s$/, '')} = {PESO_LABEL} diplomados)</span> — {n0(prem.matriculados)} {segPrem.nombre} × {PESO_LABEL} + {n0(dip.matriculados)} diplomados.
          {' '}{segPrem.nombre} concentra <b>{pct(premValorPct, 0)}</b> del valor comercial del período.
        </div>
      </div>

      <SegBlock seg={segPrem} row={prem} obj={obj.porSegmento?.[segPrem.id]} detalle={detalleTodos} acc={acc} cuenta={cuenta} icon="🎓" tag={`valor ×${PESO_LABEL}`} periodView={periodView} />
      <SegBlock seg={segDip} row={dip} obj={obj.porSegmento?.[segDip.id]} detalle={detalleTodos} acc={mezcla(acc)} cuenta={cuenta} icon="📗" tag={`valor ×1`} periodView={periodView} />

      {/* ===== Seguimiento semanal ===== */}
      <div className="section-title">Seguimiento semanal
        <Info>Evolución semana a semana del ciclo. Barras = neto de la semana; línea = acumulado; punteada = objetivo acumulado.<span className="src">CRM (leads/matrículas) + objetivos NODS</span></Info>
      </div>
      <DailyChart data={data} cfg={cuenta} />

      {/* ===== Cumplimiento de objetivos (dona) ===== */}
      <div className="section-title">Cumplimiento de objetivos
        <Info>Metas que NODS carga por semana y formato (Másters/GMP y Diplomados). Comparamos lo real acumulado del ciclo contra la meta total.<span className="src">Fuente: NODS · objetivos</span></Info>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <div className="card-h"><h2>Matrículas vs meta</h2><span className="hint">ciclo completo</span></div>
          <div className="card-b">
            <div className="gaugegrid">
              <Gauge titulo="Total" real={obj.matriculas?.real} meta={obj.matriculas?.meta} acc={acc} />
              {cuenta.segmentos.map((s) => { const ps = obj.porSegmento?.[s.id]; return <Gauge key={s.id} titulo={s.nombre} real={ps?.matReal} meta={ps?.matMeta} acc={acc} /> })}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h2>Leads vs meta</h2><span className="hint">ciclo completo</span></div>
          <div className="card-b">
            <div className="gaugegrid">
              <Gauge titulo="Total" real={obj.leads?.real} meta={obj.leads?.meta} acc={acc} />
              {cuenta.segmentos.map((s) => { const ps = obj.porSegmento?.[s.id]; return <Gauge key={s.id} titulo={s.nombre} real={ps?.leadsReal} meta={ps?.leadsMeta} acc={acc} /> })}
            </div>
          </div>
        </div>
      </div>

      {/* ===== CREATIVOS → VENTAS (el cruce) ===== */}
      <CreativosBoard crea={crea} invCrea={invCrea} acc={acc} cuenta={cuenta} periodView={periodView} />

      {/* ===== Demografía de la pauta ===== */}
      {perf.demografia && <>
        <div className="section-title">Rendimiento demográfico
          <Info>Género y edad de las personas alcanzadas por la pauta, con su costo por lead. Del desglose demográfico de Meta Ads (mes en curso).<span className="src">Meta Ads · breakdown age_gender</span></Info>
        </div>
        <Demografia demo={perf.demografia} acc={acc} moneda={cuenta.moneda} />
      </>}

      {/* ===== Detalle por programa (filtro) + drill ===== */}
      <div className="section-title">Detalle por programa {progSel && <span className="faint" style={{ textTransform: 'none', fontWeight: 400 }}>· {limpiar(progSel.nombre)}</span>}</div>
      {progSel ? (
        <div className="grid cols-2">
          <div className="card">
            <div className="card-h"><h2>Motivos de cierre</h2><span className="hint">{n0(progSel.noUtil)} no útiles</span></div>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Motivo <Info>Tipificación con la que el asesor cerró un lead como no útil.<span className="src">NODS · descripcion_sub</span></Info></th><th>Leads</th><th>%</th></tr></thead>
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
              <Linea k="Leads" v={n0(progSel.total)} info="Total de leads del programa en el período." />
              <Linea k="Tasa de contacto" v={pct(progSel.contactoPct, 1)} info="Leads con los que se logró hablar ÷ total. Excluye no-contesta, buzón, teléfono erróneo, etc." />
              <Linea k="Potenciales" v={n0(progSel.potenciales)} info="Leads en proceso de pago (estado transitorio previo a la matrícula)." />
              <Linea k="Matrículas" v={n0(progSel.matriculados)} info="Inscripciones pagadas del programa." />
              <Linea k="Conv. lead → matrícula" v={pct(progSel.convLead, 2)} info="Matrículas ÷ leads del programa." />
              <Linea k="Conv. contacto → matrícula" v={pct(progSel.convContacto, 2)} info="Matrículas ÷ leads contactados. Mide el cierre una vez que se logró el contacto." />
              <Linea k="Descuento promedio" v={progSel.descuento != null ? pct(progSel.descuento, 1) : '—'} info="Promedio del descuento aplicado en las matrículas del programa." />
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-b small faint">Elegí un programa en el filtro de arriba para ver sus motivos de cierre y su embudo completo. El desglose por programa de cada tipo está en los bloques de arriba.</div>
        </div>
      )}
    </div>
  )
}

/* ---------- Bloque de segmento (Másters/GMP o Diplomados) ---------- */
function SegBlock({ seg, row, obj, detalle, acc, cuenta, icon, tag, periodView }) {
  const conv = row.leads ? (row.matriculados / row.leads) * 100 : 0
  const cumpl = obj && obj.matMeta ? (obj.matReal / obj.matMeta) * 100 : null
  const filas = detalle.filter((p) => p.segmento === seg.id).sort((a, b) => b.matriculados - a.matriculados || b.total - a.total)
  return (
    <div className="segblk">
      <div className="sh" style={{ background: acc }}>
        <span className="ic">{icon}</span>
        <span className="nm">{seg.nombre}</span>
        <span className="tag">{tag}</span>
      </div>
      <div className="sb">
        <div className="mini" style={{ marginBottom: 14 }}>
          <Mini k="Leads" v={n0(row.leads)} info="Leads del CRM de este tipo de programa en el período." />
          <Mini k="Matrículas" v={n0(row.matriculados)} info="Inscripciones pagadas de este tipo en el período." />
          <Mini k="Conversión" v={pct(conv, 2)} info="Matrículas ÷ leads de este tipo." />
          <Mini k="Cumplimiento" v={cumpl != null ? pct(cumpl, 0) : '—'} sub={obj ? `${n0(obj.matReal)} / ${n0(obj.matMeta)} meta` : null} info="Matrículas reales del ciclo ÷ meta de matrículas del ciclo (no varía con el período)." />
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr>
              <th>Programa</th>
              <th>Leads</th>
              <th>Contacto <Info r>Leads contactados ÷ total. Excluye no-contesta, buzón, teléfono erróneo, duplicado.<span className="src">NODS · descripcion_sub</span></Info></th>
              <th>Potenc. <Info r>Leads en proceso de pago.<span className="src">NODS · descripcion_sub</span></Info></th>
              <th>Matrículas</th>
              <th>Conv. <Info r>Matrículas ÷ leads del programa.</Info></th>
              <th>Descuento <Info r>Descuento promedio aplicado en las matrículas.<span className="src">NODS · matriculas.descuento_aplicado</span></Info></th>
              <th>Motivo #1 <Info r>Motivo de cierre no útil más frecuente.</Info></th>
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
    </div>
  )
}

/* ---------- Cruce creativos → ventas ---------- */
function CreativosBoard({ crea, invCrea, acc, cuenta, periodView }) {
  const formatos = crea.formatos || []
  const angulos = (crea.angulos || []).filter((a) => a.leads > 0)
  const cob = crea.cobertura || {}
  const invF = new Map((invCrea.porFormato || []).map((r) => [r.formato, r]))

  if (!angulos.length && !formatos.length) return null

  // Insight automático: mejor ángulo por conversión con volumen real (evita que un
  // ángulo con pocas matrículas gane por ruido estadístico), y formato ganador.
  const angConVol = angulos.filter((a) => a.leads >= 100 && a.matriculados >= 10)
  const mejorAng = [...(angConVol.length ? angConVol : angulos)].sort((a, b) => b.convPct - a.convPct)[0]
  const masLeadsAng = [...angulos].sort((a, b) => b.leads - a.leads)[0]
  const fmtConv = formatos.filter((x) => x.formato !== 'Sin dato' && x.leads >= 30)
  const mejorFmt = [...fmtConv].sort((a, b) => b.convPct - a.convPct)[0]

  return (
    <>
      <div className="section-title">Creativos → ventas
        <Info>Cruzamos el creativo con el que entró cada lead y cada matrícula (codificado en <code>utm_content</code>) para ver qué <b>vende</b>, no sólo qué trae leads. Formato = imagen/video; ángulo = el "perfil del anuncio" (Especialista, Estudioso…).<span className="src">CRM: utm_content · Inversión: Meta Ads ad_name</span></Info>
      </div>

      {mejorAng && (
        <div className="callout" style={{ marginBottom: 14 }}>
          <span className="ic">💡</span>
          <div>
            El ángulo <b>{mejorAng.angulo}</b> es el que mejor convierte (<b>{pct(mejorAng.convPct, 2)}</b>, {n0(mejorAng.matriculados)} matrículas){masLeadsAng && masLeadsAng.angulo !== mejorAng.angulo && <> — mientras que <b>{masLeadsAng.angulo}</b> trae más leads ({n0(masLeadsAng.leads)}) pero convierte {pct(masLeadsAng.convPct, 2)}</>}.
            {mejorFmt && <> En formato, <b>{mejorFmt.formato}</b> lidera la conversión ({pct(mejorFmt.convPct, 2)}).</>}
          </div>
        </div>
      )}

      <div className="grid cols-2">
        {/* Por formato */}
        <div className="card">
          <div className="card-h"><h2>Por formato de anuncio</h2><span className="hint">imagen vs video</span></div>
          <div className="card-b">
            <div className="mini" style={{ gridTemplateColumns: `repeat(${Math.min(formatos.length, 3)}, 1fr)` }}>
              {formatos.map((ff) => {
                const inv = invF.get(ff.formato)
                const es = ff.formato === 'Sin dato'
                return (
                  <div className="m" key={ff.formato}>
                    <div className="mk">{es ? 'Sin formato' : ff.formato}
                      <Info>{es ? 'Creativos cuyo nombre no indica formato.' : `Anuncios en formato ${ff.formato.toLowerCase()}.`} Conversión = matrículas ÷ leads de ese formato.{inv && <span className="src">Inversión {money(inv.inversion, cuenta.moneda)} (mes)</span>}</Info>
                    </div>
                    <div className="mv" style={{ color: es ? 'var(--faint)' : acc }}>{pct(ff.convPct, 2)}</div>
                    <div className="ms">{n0(ff.matriculados)} mat · {n0(ff.leads)} leads</div>
                    {inv && <div className="ms">Inv {money(inv.inversion, cuenta.moneda)} <span className="faint">(mes)</span></div>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Por ángulo */}
        <div className="card">
          <div className="card-h"><h2>Por ángulo (perfil del anuncio)</h2><span className="hint">qué mensaje vende</span></div>
          <div className="card-b">
            <CBars rows={angulos} acc={acc} />
            <div className="legend">
              <span className="li"><span className="sw" style={{ background: acc }} /> largo = leads · intensidad = conversión</span>
            </div>
          </div>
        </div>
      </div>

      {/* Matriz ángulo × formato (celdas coloreadas por conversión) */}
      {(crea.combos || []).length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-h"><h2>Matriz creativa · ángulo × formato</h2><span className="hint">matrículas por combinación</span></div>
          <div className="card-b">
            <MatrizCreativos combos={crea.combos} acc={acc} />
          </div>
        </div>
      )}

      <p className="small faint" style={{ marginTop: 8 }}>
        Cobertura: {n0(cob.leadsConDato)} de {n0(cob.leadsTotal)} leads y {n0(cob.matsConDato)} de {n0(cob.matsTotal)} matrículas traen creativo identificable. La inversión por formato es del mes en curso (Meta); leads y matrículas responden al período.
      </p>
    </>
  )
}

// Barras de ángulo: largo ∝ leads (audiencia), intensidad de color ∝ conversión.
function CBars({ rows, acc }) {
  const maxLeads = Math.max(...rows.map((r) => r.leads), 1)
  const maxConv = Math.max(...rows.map((r) => r.convPct), 0.0001)
  const { r, g, b } = hexRgb(acc)
  return (
    <div className="cvz">
      {rows.map((row) => {
        const w = Math.max(6, (row.leads / maxLeads) * 100)
        const op = 0.32 + 0.68 * (row.convPct / maxConv)
        return (
          <div className="crow" key={row.angulo}>
            <div className="cname">{row.angulo}</div>
            <div className="ctrack">
              <div className="cfill" style={{ width: `${w}%`, background: `rgba(${r},${g},${b},${op.toFixed(3)})` }} />
              <span className="cconv" style={{ color: w > 62 ? '#fff' : 'var(--ink)' }}>{pct(row.convPct, 2)}</span>
            </div>
            <div className="cval"><b>{n0(row.matriculados)}</b> mat · {n0(row.leads)} leads</div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Átomos ---------- */
function Info({ children, r }) {
  return (
    <span className={'info' + (r ? ' r' : '')}>
      <button type="button" className="q" aria-label="Qué es esta métrica">?</button>
      <span className="bub" role="tooltip">{children}</span>
    </span>
  )
}

function BackBar({ cuenta, onBack }) {
  return (
    <div className="acct-head">
      <div>
        <button className="btn" onClick={onBack} style={{ marginBottom: 10 }}>← Volver al tablero</button>
        <h1>📊 Performance</h1>
        <div className="sub">{cuenta.nombre} · rendimiento por tipo, programa y creativo</div>
      </div>
    </div>
  )
}

function Kpi({ lbl, val, sub, info }) {
  return (
    <div className="card kpi">
      <div className="lbl">{lbl}{info && <Info>{info}</Info>}</div>
      <div className="val small">{val}</div>
      {sub && <div className="delta faint">{sub}</div>}
    </div>
  )
}

function Mini({ k, v, sub, info }) {
  return (
    <div className="m">
      <div className="mk">{k}{info && <Info>{info}</Info>}</div>
      <div className="mv">{v}</div>
      {sub && <div className="ms">{sub}</div>}
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

function Linea({ k, v, info }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 13 }}><span className="muted">{k}{info && <Info>{info}</Info>}</span><b>{v}</b></div>
}

const limpiar = (nombre) => String(nombre).replace(/^(Master|Diplomado|GMP|DIPLOMADO)\s*[-–]\s*/i, '').trim()
function mesLabel(yyyymm) {
  try { const s = new Date(yyyymm + '-01T00:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1) } catch { return yyyymm }
}
function hexRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
// Tono más apagado del acento, para diferenciar el bloque de diplomados.
function mezcla(hex) {
  const { r, g, b } = hexRgb(hex)
  const m = (c) => Math.round(c * 0.55 + 90 * 0.45)
  return `rgb(${m(r)},${m(g)},${m(b)})`
}
