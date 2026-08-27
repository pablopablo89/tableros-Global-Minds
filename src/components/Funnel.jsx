import { n0, pct } from '../lib/format.js'
import { pasosFunnel } from '../lib/derive.js'

function lighten(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16)
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255
  r = Math.round(r + (255 - r) * amt); g = Math.round(g + (255 - g) * amt); b = Math.round(b + (255 - b) * amt)
  return `rgb(${r},${g},${b})`
}

function FunnelSVG({ pasos, acc }) {
  const W = 460, bandH = 46, gap = 24, edge = 18
  const innerW = W - edge * 2
  const cx = W / 2
  const max = Math.max(...pasos.map((p) => p.val), 1)
  const bw = (v) => (0.36 + 0.64 * (v / max)) * innerW
  const H = pasos.length * (bandH + gap) - gap + 4
  const light = lighten(acc, 0.28)

  const geo = pasos.map((p, i) => {
    const w = bw(p.val)
    return { ...p, w, x: cx - w / 2, y: i * (bandH + gap) }
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: '100%' }} role="img" aria-label="Funnel de conversión">
      <defs>
        <linearGradient id="funnelGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={acc} />
        </linearGradient>
      </defs>

      {/* cuellos (conectores) + conversión */}
      {geo.slice(0, -1).map((g, i) => {
        const nx = geo[i + 1]
        const y1 = g.y + bandH, y2 = nx.y
        const pts = `${g.x},${y1} ${g.x + g.w},${y1} ${nx.x + nx.w},${y2} ${nx.x},${y2}`
        const p = pasos[i + 1]
        return (
          <g key={'c' + i}>
            <polygon points={pts} fill={acc} opacity="0.16" />
            {p.conv != null && (
              <text x={cx} y={(y1 + y2) / 2 + 3.5} textAnchor="middle" fontSize="10.5" fill="var(--muted)">
                ↓ {pct(p.conv)} {p.base}
              </text>
            )}
          </g>
        )
      })}

      {/* bandas */}
      {geo.map((g) => (
        <g key={g.id}>
          <rect x={g.x} y={g.y} width={g.w} height={bandH} rx="10" fill="url(#funnelGrad)" />
          <text x={g.x + 16} y={g.y + bandH / 2 + 3.5} fontSize="9.5" letterSpacing="0.4" fill="#fff" opacity="0.82">
            {g.label.toUpperCase()}
          </text>
          <text x={g.x + g.w - 16} y={g.y + bandH / 2 + 5.5} textAnchor="end" fontSize="17" fontWeight="700" fill="#fff">
            {n0(g.val)}
          </text>
        </g>
      ))}
    </svg>
  )
}

export default function Funnel({ data, cfg }) {
  const pasos = pasosFunnel(data.funnel)
  return (
    <div className="card">
      <div className="card-h">
        <h2>Funnel de conversión</h2>
        <span className="hint">{n0(data.funnel.leadsTotales)} leads totales</span>
      </div>
      <div className="card-b">
        <div className="grid cols-2" style={{ alignItems: 'center' }}>
          <div>
            <FunnelSVG pasos={pasos} acc={cfg.acento} />
            {data.funnel.notas?.map((nota, i) => (
              <div key={i} className="small faint" style={{ marginTop: 6 }}>{nota}</div>
            ))}
          </div>
          <div className="segcards">
            {data.segmentos.map((s) => (
              <div key={s.id} className="segcard">
                <div className="sc-h">{s.nombre}</div>
                <div className="sc-row"><span className="k">Leads</span><span className="v">{n0(s.leads)}</span></div>
                <div className="sc-row"><span className="k">Contacto</span><span className="v">{pct(s.contactoPct, 0)}</span></div>
                <div className="sc-row"><span className="k">Potenciales</span><span className="v">{n0(s.potenciales)}</span></div>
                <div className="sc-row"><span className="k">Matriculados</span><span className="v">{n0(s.matriculados)}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
