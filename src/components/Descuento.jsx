import { pct } from '../lib/format.js'

// Descuento promedio aplicado (%) sobre las matrículas, por segmento y total.
// Responde al filtro de período (usa data.descuento del corte). Sólo tablero.
export default function Descuento({ data, cfg }) {
  const d = data.descuento
  if (!d || d.promedio == null) {
    return (
      <div className="card">
        <div className="card-h"><h2>Descuento aplicado</h2></div>
        <div className="card-b"><p className="small faint" style={{ margin: 0 }}>Sin datos de descuento en este período.</p></div>
      </div>
    )
  }
  return (
    <div className="card">
      <div className="card-h">
        <h2>Descuento aplicado</h2>
        <span className="hint">promedio sobre matrículas{d.conDescuentoPct != null ? ` · ${pct(d.conDescuentoPct, 0)} con descuento` : ''}</span>
      </div>
      <div className="card-b">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Tipo</th><th>Descuento promedio</th></tr></thead>
            <tbody>
              {cfg.segmentos.map((s) => (
                d.porSegmento?.[s.id] != null && (
                  <tr key={s.id}><td>{s.nombre}</td><td>{pct(d.porSegmento[s.id], 1)}</td></tr>
                )
              ))}
              <tr className="total"><td>Total</td><td>{pct(d.promedio, 1)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
