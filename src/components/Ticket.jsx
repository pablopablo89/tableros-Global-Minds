import { money } from '../lib/format.js'

export default function Ticket({ data, cfg }) {
  return (
    <div className="card">
      <div className="card-h"><h2>Ticket promedio</h2></div>
      <div className="card-b">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Tipo</th><th>Ticket promedio</th></tr></thead>
            <tbody>
              {(data.ticket || []).map((t, i) =>
                t.tipo.toLowerCase() === 'total' ? (
                  <tr className="total" key={i}><td>{t.tipo}</td><td>{money(t.valor, cfg.moneda)}</td></tr>
                ) : (
                  <tr key={i}><td>{t.tipo}</td><td>{money(t.valor, cfg.moneda)}</td></tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
