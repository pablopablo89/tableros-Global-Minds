import { n0, fechaCorta } from '../lib/format.js'

// Evolución semanal: barras = neto de la semana (con número), línea = acumulado,
// punteada = objetivo acumulado. Acotada al ciclo.
function WeeklyChart({ titulo, serie, color }) {
  const W = 580, H = 230, padL = 46, padR = 46, padT = 18, padB = 40
  if (!serie || serie.length === 0) {
    return <div className="card"><div className="card-h"><h2>{titulo}</h2></div><div className="card-b faint small">Sin datos del ciclo.</div></div>
  }
  const nMax = Math.max(...serie.map((p) => p.neto), 1)
  const accMax = Math.max(...serie.map((p) => Math.max(p.acumulado, p.objetivoAcum || 0)), 1)
  const bw = (W - padL - padR) / serie.length
  const xC = (i) => padL + bw * i + bw / 2
  const yN = (v) => (H - padB) - (v / nMax) * (H - padT - padB)     // barras (neto)
  const yA = (v) => (H - padB) - (v / accMax) * (H - padT - padB)   // líneas (acumulado)

  const linA = serie.map((p, i) => `${i ? 'L' : 'M'}${xC(i).toFixed(1)},${yA(p.acumulado).toFixed(1)}`).join(' ')
  const hayObj = serie.some((p) => p.objetivoAcum > 0)
  const linO = hayObj ? serie.map((p, i) => `${i ? 'L' : 'M'}${xC(i).toFixed(1)},${yA(p.objetivoAcum).toFixed(1)}`).join(' ') : null
  const ultimo = serie[serie.length - 1]

  const step = Math.max(1, Math.ceil(serie.length / 8))
  const mostrarNeto = bw > 16

  return (
    <div className="card">
      <div className="card-h">
        <h2>{titulo}</h2>
        <span className="hint">acum. {n0(ultimo.acumulado)}{hayObj ? ` / obj ${n0(ultimo.objetivoAcum)}` : ''}</span>
      </div>
      <div className="card-b">
        <div className="table-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: '100%' }} role="img">
            {/* eje neto (izq) */}
            {[0, 0.5, 1].map((fr, i) => {
              const v = Math.round(nMax * fr)
              return <g key={'n' + i}><line x1={padL} x2={W - padR} y1={yN(v)} y2={yN(v)} stroke="var(--line)" strokeWidth="1" /><text x={padL - 6} y={yN(v) + 3} textAnchor="end" fontSize="9" fill="var(--faint)">{n0(v)}</text></g>
            })}
            {/* barras neto */}
            {serie.map((p, i) => {
              const h = (H - padB) - yN(p.neto)
              return (
                <g key={i}>
                  <rect x={xC(i) - bw * 0.3} y={yN(p.neto)} width={bw * 0.6} height={Math.max(0, h)} fill={color} opacity="0.85" rx="2" />
                  {mostrarNeto && p.neto > 0 && <text x={xC(i)} y={yN(p.neto) - 3} textAnchor="middle" fontSize="8" fill="var(--muted)">{n0(p.neto)}</text>}
                </g>
              )
            })}
            {/* línea acumulado */}
            <path d={linA} fill="none" stroke="var(--ink)" strokeWidth="2" />
            <text x={W - padR + 4} y={yA(ultimo.acumulado) + 3} fontSize="9" fill="var(--ink)">{n0(ultimo.acumulado)}</text>
            {linO && <><path d={linO} fill="none" stroke="var(--down, #C0544B)" strokeWidth="1.5" strokeDasharray="5 4" /><text x={W - padR + 4} y={yA(ultimo.objetivoAcum) + 3} fontSize="9" fill="var(--down, #C0544B)">obj</text></>}
            {/* eje X semanas */}
            {serie.map((p, i) => (i % step === 0 ? <text key={'x' + i} x={xC(i)} y={H - 22} textAnchor="middle" fontSize="8" fill="var(--faint)">{fechaCorta(p.semana)}</text> : null))}
            {/* leyenda */}
            <text x={padL} y={H - 6} fontSize="8" fill="var(--faint)">barras: neto semanal · línea: acumulado{hayObj ? ' · punteada: objetivo' : ''}</text>
          </svg>
        </div>
      </div>
    </div>
  )
}

export default function DailyChart({ data, cfg }) {
  const d = data.daily || {}
  return (
    <div className="grid cols-2" style={{ alignItems: 'start' }}>
      <WeeklyChart titulo="Matrículas por semana" serie={d.matriculas} color={cfg.acento} />
      <WeeklyChart titulo="Leads por semana" serie={d.leads} color={cfg.acento} />
    </div>
  )
}
