import { n0, fechaCorta } from '../lib/format.js'
import { rangosSemana } from '../lib/weeks.js'

// Leads de la última semana (cerrada) y de la semana en curso, por segmento.
export default function WeeklyLeads({ data, cfg }) {
  const ls = data.leadsSemana || {}
  const rangos = ls.rango || rangosSemana()
  const demo = ls.demo
  const rango = (r) => `${fechaCorta(r.inicio)} – ${fechaCorta(r.fin)}`

  const Box = ({ titulo, r, campo }) => (
    <div className="weekbox">
      <div className="wtitle">{titulo}</div>
      <div className="wrange">{rango(r)} · lun a dom</div>
      {cfg.segmentos.map((s) => (
        <div key={s.id} className="wline">
          <span className="k">{s.nombre}</span>
          <span className="v">{n0(ls[s.id]?.[campo])}</span>
        </div>
      ))}
      <div className="wline" style={{ borderTopStyle: 'solid' }}>
        <span className="k"><b>Total</b></span>
        <span className="v">{n0(cfg.segmentos.reduce((a, s) => a + (ls[s.id]?.[campo] || 0), 0))}</span>
      </div>
    </div>
  )

  return (
    <div className="card">
      <div className="card-h">
        <h2>Leads por semana</h2>
        {demo && <span className="badge-demo">valores demo · pendiente API</span>}
      </div>
      <div className="card-b">
        <div className="weekly">
          <Box titulo="Última semana" r={rangos.anterior} campo="ultima" />
          <Box titulo="Semana en curso" r={rangos.actual} campo="actual" />
        </div>
      </div>
    </div>
  )
}
