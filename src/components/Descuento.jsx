import { n0, pct } from '../lib/format.js'

// Distribución de descuentos: por cada nivel de descuento, cuántas matrículas lo
// usaron y qué % del total representa. Responde al filtro de período. Sólo tablero.
export default function Descuento({ data, cfg }) {
  const d = data.descuento
  const dist = d?.distribucion || []
  if (!dist.length) {
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
        <span className="hint">promedio {pct(d.promedio, 1)} · {n0(d.muestra)} matrículas</span>
      </div>
      <div className="card-b">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Descuento</th><th>Matrículas</th><th>% de uso</th></tr></thead>
            <tbody>
              {dist.map((r) => (
                <tr key={r.descuento}>
                  <td>{pct(r.descuento, 0)}</td>
                  <td>{n0(r.matriculas)}</td>
                  <td>{pct(r.uso, 1)}</td>
                </tr>
              ))}
              <tr className="total"><td>Total</td><td>{n0(d.muestra)}</td><td>100%</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
