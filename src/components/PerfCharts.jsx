import { n0, pct, money, fechaCorta } from '../lib/format.js'

/* ================= Gauge (dona) de cumplimiento ================= */
// Semicírculo: fondo gris + arco de avance. % grande en el centro.
export function Gauge({ titulo, real, meta, acc }) {
  const p = meta ? (real / meta) * 100 : null
  const W = 200, H = 118, cx = W / 2, cy = 104, r = 82, sw = 16
  const frac = p == null ? 0 : Math.min(Math.max(p, 0), 100) / 100
  const color = p == null ? acc : p >= 100 ? '#2E9E6B' : p >= 80 ? acc : '#C6902F'
  const pol = (ang) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)]
  const A0 = Math.PI, A1 = Math.PI + Math.PI * frac
  const [x0, y0] = pol(A0), [x1, y1] = pol(A1), [xb, yb] = pol(2 * Math.PI)
  const arc = (x0, y0, x1, y1, big) => `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${big} 1 ${x1.toFixed(1)},${y1.toFixed(1)}`
  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 220 }} role="img" aria-label={titulo}>
        <path d={arc(x0, y0, xb, yb, 1)} fill="none" stroke="var(--surface-2)" strokeWidth={sw} strokeLinecap="round" />
        {frac > 0 && <path d={arc(x0, y0, x1, y1, frac > 0.5 ? 1 : 0)} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />}
        <text x={cx} y={cy - 20} textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--ink)">{p == null ? '—' : `${Math.round(p)}%`}</text>
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="11" fill="var(--faint)">{n0(real)}{meta != null ? ` / ${n0(meta)}` : ''}</text>
      </svg>
      <div className="small muted" style={{ marginTop: -6 }}>{titulo}</div>
    </div>
  )
}

/* ================= Matriz creativos: ángulo × formato ================= */
// Cada celda = matrículas de ese ángulo en ese formato; intensidad = conversión.
export function MatrizCreativos({ combos, acc }) {
  const formatos = [...new Set(combos.map((c) => c.formato))].sort((a, b) => ORD(a) - ORD(b))
  const angulos = [...new Set(combos.map((c) => c.angulo))]
  // ordenar ángulos por matrículas totales
  const matAng = (a) => combos.filter((c) => c.angulo === a).reduce((s, c) => s + c.matriculados, 0)
  angulos.sort((a, b) => matAng(b) - matAng(a))
  const cell = (a, f) => combos.find((c) => c.angulo === a && c.formato === f)
  const maxConv = Math.max(...combos.filter((c) => c.matriculados > 0).map((c) => c.convPct), 0.01)
  const { r, g, b } = hexRgb(acc)
  const totF = (f) => combos.filter((c) => c.formato === f).reduce((s, c) => s + c.matriculados, 0)
  return (
    <div className="table-wrap">
      <table className="matriz">
        <thead>
          <tr>
            <th className="corner">Ángulo \ Formato</th>
            {formatos.map((f) => <th key={f}>{f === 'Sin dato' ? 'Sin fmt.' : f}</th>)}
            <th className="tot">Total</th>
          </tr>
        </thead>
        <tbody>
          {angulos.map((a) => (
            <tr key={a}>
              <td className="rowh">{a}</td>
              {formatos.map((f) => {
                const c = cell(a, f)
                const m = c ? c.matriculados : 0
                const op = c && c.matriculados > 0 ? 0.14 + 0.72 * (c.convPct / maxConv) : 0
                return (
                  <td key={f} style={{ background: op ? `rgba(${r},${g},${b},${op.toFixed(3)})` : 'transparent', color: op > 0.55 ? '#fff' : 'var(--ink)' }}>
                    {c && (c.matriculados > 0 || c.leads > 0) ? <><b>{n0(m)}</b><span className="cc">{pct(c.convPct, 1)}</span></> : <span className="faint">·</span>}
                  </td>
                )
              })}
              <td className="tot">{n0(matAng(a))}</td>
            </tr>
          ))}
          <tr className="totr">
            <td className="rowh">Total</td>
            {formatos.map((f) => <td key={f}>{n0(totF(f))}</td>)}
            <td className="tot">{n0(combos.reduce((s, c) => s + c.matriculados, 0))}</td>
          </tr>
        </tbody>
      </table>
      <div className="legend" style={{ marginTop: 8 }}>
        <span className="li"><span className="sw" style={{ background: `rgba(${r},${g},${b},0.2)` }} /> baja conversión</span>
        <span className="li"><span className="sw" style={{ background: acc }} /> alta conversión</span>
        <span className="li faint">número = matrículas · % = conversión</span>
      </div>
    </div>
  )
}

/* ================= Demografía (género + edad, desde Meta Ads) ================= */
export function Demografia({ demo, acc, moneda }) {
  if (!demo) return null
  const gen = demo.genero || []
  const edad = demo.edad || []
  const COL = { Mujeres: '#E1467A', Hombres: '#2F6BE1', 'Sin dato': '#B7BECB' }
  const maxE = Math.max(...edad.map((e) => e.leadsAds), 1)
  const cplMax = Math.max(...edad.map((e) => e.cpl || 0), 0.01)
  const W = 560, H = 210, padL = 34, padR = 40, padT = 16, padB = 42
  const bw = (W - padL - padR) / (edad.length || 1)
  const xC = (i) => padL + bw * i + bw / 2
  const yBar = (v) => (H - padB) - (v / maxE) * (H - padT - padB)
  const yCpl = (v) => (H - padB) - (v / cplMax) * (H - padT - padB)
  return (
    <div className="grid cols-2" style={{ alignItems: 'start' }}>
      {/* Género: barra apilada + tarjetas */}
      <div className="card">
        <div className="card-h"><h2>Por género</h2><span className="hint">leads de pauta</span></div>
        <div className="card-b">
          <div style={{ display: 'flex', height: 34, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
            {gen.map((x) => (
              <div key={x.genero} title={`${x.genero}: ${pct(x.share, 1)}`} style={{ width: `${x.share}%`, background: COL[x.genero] || acc, color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                {x.share >= 12 ? pct(x.share, 0) : ''}
              </div>
            ))}
          </div>
          <div className="grid cols-3" style={{ marginTop: 12, gap: 10 }}>
            {gen.map((x) => (
              <div key={x.genero} className="m" style={{ borderTop: `3px solid ${COL[x.genero] || acc}` }}>
                <div className="mk">{x.genero}</div>
                <div className="mv" style={{ fontSize: 20 }}>{n0(x.leadsAds)}</div>
                <div className="ms">CPL {x.cpl != null ? money(x.cpl, moneda) : '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Edad: barras volumen + puntos CPL */}
      <div className="card">
        <div className="card-h"><h2>Por edad</h2><span className="hint">barra = leads · punto = CPL</span></div>
        <div className="card-b">
          <div className="table-wrap">
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: '100%' }} role="img" aria-label="Leads y CPL por edad">
              {[0, 0.5, 1].map((fr, i) => {
                const v = Math.round(maxE * fr)
                return <g key={i}><line x1={padL} x2={W - padR} y1={yBar(v)} y2={yBar(v)} stroke="var(--line)" /><text x={padL - 5} y={yBar(v) + 3} textAnchor="end" fontSize="9" fill="var(--faint)">{n0(v)}</text></g>
              })}
              {edad.map((e, i) => {
                const h = (H - padB) - yBar(e.leadsAds)
                return (
                  <g key={e.edad}>
                    <rect x={xC(i) - bw * 0.28} y={yBar(e.leadsAds)} width={bw * 0.56} height={Math.max(0, h)} rx="3" fill={acc} opacity="0.85" />
                    <text x={xC(i)} y={yBar(e.leadsAds) - 4} textAnchor="middle" fontSize="9" fill="var(--muted)">{n0(e.leadsAds)}</text>
                    <text x={xC(i)} y={H - 26} textAnchor="middle" fontSize="9" fill="var(--faint)">{e.edad}</text>
                    {e.cpl != null && <circle cx={xC(i)} cy={yCpl(e.cpl)} r="3.5" fill="var(--ink)" />}
                    {e.cpl != null && <text x={xC(i)} y={yCpl(e.cpl) - 6} textAnchor="middle" fontSize="8" fill="var(--ink)">{money(e.cpl, moneda)}</text>}
                  </g>
                )
              })}
              <text x={padL} y={H - 8} fontSize="8" fill="var(--faint)">barras: leads de pauta · puntos: costo por lead</text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================= Pauta Meta: inversión (barras) + CPL (línea) por semana ================= */
export function MetaSerie({ serie, acc, moneda }) {
  const s = (serie || []).filter((x) => x.inversion > 0 || x.leadsAds > 0)
  if (!s.length) return <div className="card"><div className="card-b faint small">Sin datos de pauta del ciclo.</div></div>
  const W = 600, H = 240, padL = 54, padR = 56, padT = 16, padB = 40
  const invMax = Math.max(...s.map((x) => x.inversion), 1)
  const cplMax = Math.max(...s.map((x) => x.cpl || 0), 0.01)
  const bw = (W - padL - padR) / s.length
  const xC = (i) => padL + bw * i + bw / 2
  const yInv = (v) => (H - padB) - (v / invMax) * (H - padT - padB)
  const yCpl = (v) => (H - padB) - (v / cplMax) * (H - padT - padB)
  const lin = s.map((p, i) => `${i ? 'L' : 'M'}${xC(i).toFixed(1)},${yCpl(p.cpl || 0).toFixed(1)}`).join(' ')
  const step = Math.max(1, Math.ceil(s.length / 10))
  const totInv = s.reduce((a, x) => a + x.inversion, 0)
  const totLeads = s.reduce((a, x) => a + x.leadsAds, 0)
  return (
    <div className="card">
      <div className="card-h"><h2>Inversión y CPL por semana</h2><span className="hint">{money(totInv, moneda)} · {n0(totLeads)} leads · CPL {money(totLeads ? totInv / totLeads : 0, moneda)}</span></div>
      <div className="card-b"><div className="table-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: '100%' }} role="img" aria-label="Inversión y CPL por semana">
          {[0, 0.5, 1].map((fr, i) => { const v = invMax * fr; return <g key={i}><line x1={padL} x2={W - padR} y1={yInv(v)} y2={yInv(v)} stroke="var(--line)" /><text x={padL - 6} y={yInv(v) + 3} textAnchor="end" fontSize="8.5" fill="var(--faint)">{money(v, moneda)}</text></g> })}
          {[0, cplMax].map((v, i) => <text key={'c' + i} x={W - padR + 6} y={yCpl(v) + 3} fontSize="8.5" fill="var(--ink)">{money(v, moneda)}</text>)}
          {s.map((p, i) => { const h = (H - padB) - yInv(p.inversion); return <rect key={i} x={xC(i) - bw * 0.32} y={yInv(p.inversion)} width={bw * 0.64} height={Math.max(0, h)} rx="2" fill={acc} opacity="0.8" /> })}
          <path d={lin} fill="none" stroke="var(--ink)" strokeWidth="2" />
          {s.map((p, i) => p.cpl != null ? <circle key={'d' + i} cx={xC(i)} cy={yCpl(p.cpl)} r="2.6" fill="var(--ink)" /> : null)}
          {s.map((p, i) => (i % step === 0 ? <text key={'x' + i} x={xC(i)} y={H - 22} textAnchor="middle" fontSize="8" fill="var(--faint)">{fechaCorta(p.semana)}</text> : null))}
          <text x={padL} y={H - 6} fontSize="8" fill="var(--faint)">barras: inversión (izq) · línea: CPL (der)</text>
        </svg>
      </div></div>
    </div>
  )
}

/* ================= Programa × semana (CPL) ================= */
export function ProgramaSemana({ data, moneda, selKey }) {
  const semanas = (data?.semanas || []).filter((w) => (data.programas || []).some((p) => p.semanas[w]))
  let progs = data?.programas || []
  if (selKey) progs = progs.filter((p) => p.key === selKey)
  progs = progs.filter((p) => p.totLeads > 0)
  if (!progs.length || !semanas.length) return <div className="card"><div className="card-b faint small">Sin datos de pauta por programa.</div></div>
  const cplCol = (() => { // escala de color por CPL (verde barato → rojo caro)
    const all = []; for (const p of progs) for (const w of semanas) if (p.semanas[w]?.cpl != null) all.push(p.semanas[w].cpl)
    const mn = Math.min(...all, 0), mx = Math.max(...all, 1)
    return (v) => { if (v == null) return 'transparent'; const t = mx > mn ? (v - mn) / (mx - mn) : 0; const r = Math.round(120 + t * 110), g = Math.round(180 - t * 110); return `rgba(${r},${g},90,0.28)` }
  })()
  return (
    <div className="card">
      <div className="card-h"><h2>CPL por programa y semana</h2><span className="hint">color: barato → caro</span></div>
      <div className="table-wrap">
        <table className="data" style={{ fontSize: 12 }}>
          <thead><tr><th>Programa</th>{semanas.map((w) => <th key={w}>{fechaCorta(w)}</th>)}<th>Total</th></tr></thead>
          <tbody>
            {progs.map((p, i) => (
              <tr key={i}>
                <td title={p.nombre}>{limpiarNom(p.nombre)}</td>
                {semanas.map((w) => { const c = p.semanas[w]; return <td key={w} style={{ background: c ? cplCol(c.cpl) : 'transparent' }}>{c && c.cpl != null ? money(c.cpl, moneda) : '·'}</td> })}
                <td><b>{p.cpl != null ? money(p.cpl, moneda) : '—'}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-b small faint" style={{ paddingTop: 10 }}>Cada celda = costo por lead de ese programa en esa semana (inversión ÷ leads de pauta). Total = CPL del ciclo.</div>
    </div>
  )
}

/* helpers */
const limpiarNom = (n) => String(n).replace(/^(Master|Diplomado|GMP|DIPLOMADO)\s*[-–]\s*/i, '').trim()
const ORDEN = { Video: 0, Imagen: 1, GIF: 2, Carrusel: 3, 'Sin dato': 9 }
const ORD = (f) => (ORDEN[f] ?? 8)
function hexRgb(hex) { const n = parseInt(String(hex).replace('#', ''), 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 } }
