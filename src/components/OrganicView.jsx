import { useMemo, useState } from 'react'
import { n0, pct, fechaCorta } from '../lib/format.js'
import { MACRO_COLOR, MACRO_DESC } from '../lib/canales.js'
import { consolidarProgramas } from '../lib/derive.js'

// Página "Alcance orgánico": entiende el canal de adquisición con foco en lo
// GANADO sin pauta. Pensada como un mercadólogo: eficiencia por canal, de dónde
// viene el orgánico, qué programas/ciudades trae y cómo evoluciona.
export default function OrganicView({ cuenta, data, onBack }) {
  const [periodo, setPeriodo] = useState('todas')
  const meses = data?.mensual || []
  const semanas = data?.semanal || []
  // El período elegido (M:<mes> o S:<lunes>) reemplaza el bloque orgánico por el
  // corte guardado en el snapshot; "todas" usa el ciclo completo.
  const o = useMemo(() => {
    if (!data?.organico) return null
    if (periodo === 'todas') return data.organico
    if (periodo.startsWith('M:')) return (data.mensual || []).find((x) => x.mes === periodo.slice(2))?.organico || data.organico
    return (data.semanal || []).find((x) => x.semana === periodo.replace(/^S:/, ''))?.organico || data.organico
  }, [data, periodo])
  const periodView = periodo !== 'todas'
  const ins = useMemo(() => (o ? insightsOrganicos(o, cuenta) : []), [o, cuenta])

  const selector = (
    <div className="field" style={{ marginTop: 12 }}>
      <label>Período</label>
      <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
        <option value="todas">Todo el ciclo</option>
        <optgroup label="Por mes">
          {meses.map((m) => <option key={m.mes} value={'M:' + m.mes}>{mesLabel(m.mes)}</option>)}
        </optgroup>
        <optgroup label="Por semana (lun–dom)">
          {semanas.map((s) => <option key={s.semana} value={'S:' + s.semana}>{fechaCorta(s.semana)} – {fechaCorta(s.fin)}</option>)}
        </optgroup>
      </select>
    </div>
  )

  if (!o) {
    return (
      <div>
        <BackBar cuenta={cuenta} onBack={onBack} />
        <div className="card"><div className="card-b">Este snapshot todavía no tiene datos de canal. Tocá “Actualizar datos” en el tablero para regenerarlo.</div></div>
      </div>
    )
  }

  const org = o.macros.find((m) => m.macro === 'organico') || {}
  const pauta = o.macros.find((m) => m.macro === 'pauta') || {}
  const vsRatio = pauta.convPct ? org.convPct / pauta.convPct : null
  const maxConv = Math.max(...o.macros.map((m) => m.convPct), 0.01)
  const canalMax = Math.max(...o.canales.map((c) => c.leads), 1)
  const fuentesTop = topConOtros(o.fuentes, 12)
  const fuenteMax = Math.max(...fuentesTop.map((f) => f.leads), 1)
  const progOrg = consolidarProgramas(
    o.programas.map((p) => ({ segmento: p.segmento, nombre: p.nombre, total: p.leads, matriculados: p.matriculados, gestionados: 0, noUtil: 0, potenciales: 0, cohorte: null })),
  ).sort((a, b) => b.matriculados - a.matriculados || b.total - a.total).slice(0, 12)
  const ciuMax = Math.max(...o.ciudades.map((c) => c.matriculados), 1)
  const mesLeadMax = Math.max(...o.mensual.map((m) => m.leads), 1)
  const mesMatMax = Math.max(...o.mensual.map((m) => m.matriculados), 1)

  // Tema verde para la página de orgánico.
  return (
    <div style={{ '--acc': '#2E9E6B', '--acc-soft': '#E7F4EE' }}>
      <BackBar cuenta={cuenta} onBack={onBack} selector={selector} />

      {periodView && (
        <div className="card" style={{ marginBottom: 16, borderColor: '#2E9E6B' }}>
          <div className="card-b small">📅 Mostrando el <b>período seleccionado</b>. Elegí <b>“Todo el ciclo”</b> para volver a la vista completa.</div>
        </div>
      )}

      {/* Definición / advertencia metodológica */}
      <div className="card" style={{ marginBottom: 18, borderColor: '#2E9E6B' }}>
        <div className="card-b small" style={{ lineHeight: 1.5 }}>
          🌱 <b>Alcance orgánico</b> = leads y matrículas ganados <b>sin pauta</b> (social orgánico, búsqueda, directo, referral, email y eventos).
          Clasificamos por <code>utm_source</code> / <code>utm_medium</code>; en las matrículas sin UTM propio recuperamos el canal desde el lead de origen.
          <br />⚠️ <b>Ojo:</b> los <b>formularios nativos</b> de Meta (medium “nativo”) cuentan como <b>pauta</b>, no como orgánico: son leads de campañas pagas.
          Por eso el orgánico es una porción chica de los leads… pero, como vas a ver, la más eficiente.
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid cols-4">
        <Kpi lbl="Leads orgánicos" val={n0(org.leads)} sub={`${pct(org.leadShare, 1)} del total`} />
        <Kpi lbl="Matrículas orgánicas" val={n0(org.matriculados)} sub={`${pct(org.matShare, 1)} de las ventas`} accent />
        <Kpi lbl="Conversión orgánica" val={pct(org.convPct, 1)} sub="lead → matrícula" />
        <Kpi lbl="Eficiencia vs pauta" val={vsRatio ? `${vsRatio.toFixed(1)}×` : '—'} sub={`pauta convierte ${pct(pauta.convPct, 1)}`} />
      </div>

      {/* Eficiencia por origen — el hallazgo */}
      <div className="section-title">Eficiencia por origen · conversión lead → matrícula</div>
      <div className="card">
        <div className="card-b">
          <div style={{ display: 'grid', gap: 14 }}>
            {o.macros.map((m) => (
              <div key={m.macro}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                  <span><b style={{ color: MACRO_COLOR[m.macro] }}>{m.label}</b> <span className="faint small">· {n0(m.leads)} leads → {n0(m.matriculados)} matrículas</span></span>
                  <b>{pct(m.convPct, 2)}</b>
                </div>
                <div style={{ height: 16, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max((m.convPct / maxConv) * 100, 2)}%`, background: MACRO_COLOR[m.macro], borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
          <p className="small faint" style={{ margin: '14px 0 0' }}>
            Cada barra es la tasa de conversión de su origen (escala relativa al mejor). El orgánico no tiene costo de medios: cada matrícula acá es adquisición gratuita.
          </p>
        </div>
      </div>

      {/* Reparto leads vs matrículas por origen */}
      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-h"><h2>Reparto por origen</h2><span className="hint">leads vs matrículas</span></div>
          <div className="card-b">
            <StackedShare macros={o.macros} campo="leadShare" titulo="Leads" />
            <div style={{ height: 12 }} />
            <StackedShare macros={o.macros} campo="matShare" titulo="Matrículas" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
              {o.macros.map((m) => (
                <span key={m.macro} className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: MACRO_COLOR[m.macro] }} /> {m.label}
                </span>
              ))}
            </div>

            {/* Qué es "Sin clasificar" */}
            {o.sinDetalle?.length > 0 && (
              <details style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
                  ¿Qué es “Sin clasificar”?
                </summary>
                <p className="small faint" style={{ margin: '8px 0 10px', lineHeight: 1.5 }}>
                  Leads a los que el sistema <b>no les registró origen</b> (source y medium vacíos o de prueba). No se puede saber si vinieron de pauta u orgánico, por eso quedan aparte. Estas son las combinaciones <code>source · medium</code> más frecuentes:
                </p>
                <div className="table-wrap">
                  <table className="data">
                    <thead><tr><th>source · medium</th><th>Leads</th><th>Matrículas</th></tr></thead>
                    <tbody>
                      {o.sinDetalle.map((d, i) => (
                        <tr key={i}><td>{d.combo}</td><td>{n0(d.leads)}</td><td>{n0(d.matriculados)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        </div>
        <Insights items={ins} />
      </div>

      {/* Canales orgánicos */}
      <div className="section-title">Canales orgánicos</div>
      <div className="card">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Canal</th><th>Leads</th><th>Tasa de contacto</th><th>Matrículas</th><th>Conversión</th></tr></thead>
            <tbody>
              {o.canales.map((c) => (
                <tr key={c.canal}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 'none', width: Math.max((c.leads / canalMax) * 80, 4), height: 8, background: 'var(--acc)', borderRadius: 4 }} />
                      {c.canal}
                    </div>
                  </td>
                  <td>{n0(c.leads)}</td>
                  <td>{pct(c.contactoPct, 0)}</td>
                  <td><b>{n0(c.matriculados)}</b></td>
                  <td>{pct(c.convPct, 1)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total orgánico</td>
                <td>{n0(org.leads)}</td>
                <td>{pct(org.contactoPct, 0)}</td>
                <td>{n0(org.matriculados)}</td>
                <td>{pct(org.convPct, 1)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Fuentes + Segmentos */}
      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-h"><h2>¿De dónde viene?</h2><span className="hint">fuente orgánica</span></div>
          <div className="card-b">
            <div className="citybars">
              {fuentesTop.map((f) => (
                <div className="row" key={f.fuente}>
                  <div className="name">{f.fuente}</div>
                  <div className="bar" style={{ width: `${Math.max((f.leads / fuenteMax) * 100, 2)}%` }} />
                  <div className="num">{n0(f.leads)}{f.matriculados ? <span className="faint small"> · {f.matriculados}m</span> : null}</div>
                </div>
              ))}
            </div>
            <p className="small faint" style={{ margin: '10px 0 0' }}>Barra = leads · “Nm” = matrículas de esa fuente.</p>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h2>Orgánico por segmento</h2></div>
          <div className="card-b">
            <div className="segcards">
              {o.segmentos.map((s) => (
                <div className="segcard" key={s.id}>
                  <div className="sc-h">{s.nombre}</div>
                  <div className="sc-row"><span className="k">Leads</span><span className="v">{n0(s.leads)}</span></div>
                  <div className="sc-row"><span className="k">Matrículas</span><span className="v">{n0(s.matriculados)}</span></div>
                  <div className="sc-row"><span className="k">Conversión</span><span className="v">{pct(s.convPct, 1)}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Programas orgánicos */}
      <div className="section-title">Programas que trae el orgánico</div>
      <div className="card">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Programa</th><th>Leads org.</th><th>Matrículas org.</th><th>Conversión</th></tr></thead>
            <tbody>
              {progOrg.map((p, i) => (
                <tr key={i}>
                  <td>{limpiar(p.nombre)}</td>
                  <td>{n0(p.total)}</td>
                  <td><b>{n0(p.matriculados)}</b></td>
                  <td>{pct(p.total ? (p.matriculados / p.total) * 100 : 0, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Geografía + Evolución */}
      <div className="grid" style={{ marginTop: 18, gridTemplateColumns: periodView ? '1fr' : '1fr 1fr' }}>
        <div className="card">
          <div className="card-h"><h2>Geografía orgánica</h2><span className="hint">matrículas sin pauta</span></div>
          <div className="card-b">
            <div className="citybars">
              {o.ciudades.slice(0, 8).map((c) => (
                <div className="row" key={c.ciudad}>
                  <div className="name">{c.ciudad}</div>
                  <div className="bar" style={{ width: `${Math.max((c.matriculados / ciuMax) * 100, 3)}%` }} />
                  <div className="num">{n0(c.matriculados)}</div>
                </div>
              ))}
              {!o.ciudades.length && <p className="small faint">Sin matrículas orgánicas con ciudad.</p>}
            </div>
          </div>
        </div>
        {!periodView && <div className="card">
          <div className="card-h"><h2>Evolución mensual</h2><span className="hint">orgánico</span></div>
          <div className="card-b">
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${o.mensual.length || 1}, 1fr)`, gap: 8, alignItems: 'end', height: 150 }}>
              {o.mensual.map((m) => (
                <div key={m.mes} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                  <div className="small" style={{ fontWeight: 700, color: 'var(--acc)' }}>{m.matriculados || ''}</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100 }}>
                    <div title={`${m.leads} leads`} style={{ width: 12, height: `${(m.leads / mesLeadMax) * 100}%`, background: 'var(--line)', borderRadius: '3px 3px 0 0', minHeight: 2 }} />
                    <div title={`${m.matriculados} matrículas`} style={{ width: 12, height: `${(m.matriculados / mesMatMax) * 100}%`, background: 'var(--acc)', borderRadius: '3px 3px 0 0', minHeight: m.matriculados ? 3 : 0 }} />
                  </div>
                  <div className="small faint">{mesCorto(m.mes)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
              <span className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--line)' }} /> Leads</span>
              <span className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--acc)' }} /> Matrículas</span>
            </div>
          </div>
        </div>}
      </div>
    </div>
  )
}

function BackBar({ cuenta, onBack, selector }) {
  return (
    <div className="acct-head">
      <div>
        <button className="btn" onClick={onBack} style={{ marginBottom: 10 }}>← Volver al tablero</button>
        <h1>🌱 Alcance orgánico</h1>
        <div className="sub">{cuenta.nombre} · adquisición sin pauta</div>
      </div>
      {selector}
    </div>
  )
}

function Kpi({ lbl, val, sub, accent }) {
  return (
    <div className="card kpi" style={accent ? { borderColor: 'var(--acc)' } : undefined}>
      <div className="lbl">{lbl}</div>
      <div className="val" style={accent ? { color: 'var(--acc)' } : undefined}>{val}</div>
      {sub && <div className="delta faint">{sub}</div>}
    </div>
  )
}

function StackedShare({ macros, campo, titulo }) {
  return (
    <div>
      <div className="small faint" style={{ marginBottom: 4 }}>{titulo}</div>
      <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line)' }}>
        {macros.filter((m) => m[campo] > 0).map((m) => (
          <div key={m.macro} title={`${m.label}: ${pct(m[campo], 1)}`} style={{ width: `${m[campo]}%`, background: MACRO_COLOR[m.macro], display: 'grid', placeItems: 'center' }}>
            {m[campo] >= 8 && <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>{Math.round(m[campo])}%</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Insights({ items }) {
  return (
    <div className="card">
      <div className="card-h"><h2>Insights de orgánico</h2><span className="hint">lectura automática</span></div>
      <div className="card-b insights">
        {items.map((it, i) => (
          <div key={i} className={'insight ' + it.tipo}>
            <span className="dot" />
            <span className="txt" dangerouslySetInnerHTML={{ __html: it.texto }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- helpers ----
const limpiar = (nombre) => String(nombre).replace(/^(Master|Diplomado|GMP|DIPLOMADO)\s*[-–]\s*/i, '').trim()
function mesCorto(yyyymm) {
  try { return new Date(yyyymm + '-01T00:00:00').toLocaleDateString('es-ES', { month: 'short' }) } catch { return yyyymm }
}
function mesLabel(yyyymm) {
  try {
    const s = new Date(yyyymm + '-01T00:00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  } catch { return yyyymm }
}
function topConOtros(arr, n) {
  if (arr.length <= n) return arr
  const top = arr.slice(0, n - 1)
  const resto = arr.slice(n - 1)
  const otros = { fuente: `Otras (${resto.length})`, leads: resto.reduce((a, x) => a + x.leads, 0), matriculados: resto.reduce((a, x) => a + x.matriculados, 0) }
  return [...top, otros]
}

// Insights "wow" del orgánico, ordenados por relevancia.
function insightsOrganicos(o, cfg) {
  const C = []
  const add = (tipo, score, texto) => C.push({ tipo, score, texto })
  const org = o.macros.find((m) => m.macro === 'organico') || {}
  const pauta = o.macros.find((m) => m.macro === 'pauta') || {}

  if (org.convPct && pauta.convPct) {
    const r = org.convPct / pauta.convPct
    if (r >= 1.3) add('pos', 96, `🌱 <b>El orgánico es tu canal más eficiente</b>: convierte ${pct(org.convPct, 1)} vs ${pct(pauta.convPct, 1)} de la pauta (<b>${r.toFixed(1)}×</b>). Cada matrícula orgánica es adquisición gratuita.`)
    else if (r <= 0.8) add('neg', 90, `⚠️ El orgánico convierte por debajo de la pauta (${pct(org.convPct, 1)} vs ${pct(pauta.convPct, 1)}). Vale reforzar contenido/gestión de estos leads.`)
  }
  if (org.matShare) add('pos', 92, `📊 <b>${pct(org.matShare, 0)} de las matrículas</b> (${n0(org.matriculados)}) llegan sin pauta, aunque el orgánico es solo el ${pct(org.leadShare, 1)} de los leads.`)

  const topCanal = o.canales[0]
  if (topCanal && topCanal.matriculados) add('pos', 86, `🏆 <b>${topCanal.canal}</b> lidera el orgánico: ${n0(topCanal.matriculados)} matrículas de ${n0(topCanal.leads)} leads (${pct(topCanal.convPct, 1)}).`)

  const social = o.canales.find((c) => c.canal === 'Social orgánico')
  if (social && social.leads >= 50) add('neu', 78, `📱 <b>Social orgánico</b> trae ${n0(social.leads)} leads con ${pct(social.contactoPct, 0)} de contacto: comunidad activa sin invertir en ads.`)

  const chatgpt = o.fuentes.find((f) => /chatgpt/i.test(f.fuente))
  if (chatgpt && chatgpt.matriculados) add('pos', 74, `🤖 <b>ChatGPT</b> ya trajo ${n0(chatgpt.matriculados)} matrícula(s): aparecés en respuestas de IA. Cuidá tu presencia en buscadores y IA.`)

  const busq = o.canales.find((c) => c.canal === 'Búsqueda orgánica')
  if (busq && busq.leads) add('neu', 66, `🔎 <b>Búsqueda orgánica (SEO)</b>: ${n0(busq.leads)} leads y ${n0(busq.matriculados)} matrículas. Contenido y posicionamiento rinden.`)

  const estrella = o.programas.filter((p) => p.matriculados > 0)[0]
  if (estrella) add('pos', 70, `⭐ Programa con más tracción orgánica: <b>${limpiar(estrella.nombre)}</b> (${n0(estrella.matriculados)} matrículas orgánicas).`)

  const mejorSeg = [...o.segmentos].sort((a, b) => b.convPct - a.convPct)[0]
  if (mejorSeg && mejorSeg.matriculados) add('neu', 60, `⚖️ En orgánico, <b>${mejorSeg.nombre}</b> es el segmento que mejor convierte (${pct(mejorSeg.convPct, 1)}).`)

  if (pauta.leadShare >= 60) add('neu', 55, `🧹 <b>${pct(pauta.leadShare, 0)} de los leads</b> vienen de pauta (incluidos los formularios nativos). El orgánico es margen para bajar el costo de adquisición.`)

  return C.sort((a, b) => b.score - a.score).slice(0, 7).map(({ tipo, texto }) => ({ tipo, texto }))
}
