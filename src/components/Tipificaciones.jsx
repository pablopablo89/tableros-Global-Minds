import { n0, pct } from '../lib/format.js'

function Tabla({ nombre, filas }) {
  const total = filas.reduce((a, f) => a + f.leads, 0)
  const ordenadas = [...filas].sort((a, b) => b.leads - a.leads)
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr><th>Tipificación · {nombre}</th><th>Leads</th><th>%</th></tr>
        </thead>
        <tbody>
          {ordenadas.map((f, i) => (
            <tr key={i}>
              <td>{f.motivo}</td>
              <td>{n0(f.leads)}</td>
              <td>{pct(total ? (f.leads / total) * 100 : 0)}</td>
            </tr>
          ))}
          <tr className="total"><td>Total</td><td>{n0(total)}</td><td>100,00%</td></tr>
        </tbody>
      </table>
    </div>
  )
}

export default function Tipificaciones({ data, cfg }) {
  return (
    <div className="card">
      <div className="card-h"><h2>Motivos de no compra</h2></div>
      <div className="card-b grid cols-2">
        {cfg.segmentos.map((s) => (
          <Tabla key={s.id} nombre={s.nombre} filas={data.tipificaciones?.[s.id] || []} />
        ))}
      </div>
    </div>
  )
}
