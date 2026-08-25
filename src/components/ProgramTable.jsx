import { useState } from 'react'
import { n0 } from '../lib/format.js'
import { agruparPorCohorte } from '../lib/derive.js'

// Tabla de detalle por programa. Para diplomados, agrupa por cohorte si el dato existe.
export default function ProgramTable({ titulo, filas, agruparCohorte = false, cohorteFiltro = 'todas' }) {
  const [orden, setOrden] = useState({ campo: 'matriculados', dir: -1 })

  let fs = filas
  if (cohorteFiltro && cohorteFiltro !== 'todas') fs = fs.filter((f) => (f.cohorte || 'Sin cohorte') === cohorteFiltro)

  const sortFn = (a, b) => (a[orden.campo] - b[orden.campo]) * orden.dir || (typeof a[orden.campo] === 'string' ? String(a[orden.campo]).localeCompare(b[orden.campo]) : 0)
  const grupos = agruparCohorte
    ? agruparPorCohorte(fs).map((g) => ({ ...g, filas: [...g.filas].sort(sortFn) }))
    : [{ cohorte: null, filas: [...fs].sort(sortFn), subtotal: null }]

  const total = fs.reduce((a, f) => ({
    gestionados: a.gestionados + f.gestionados, noUtil: a.noUtil + f.noUtil,
    potenciales: a.potenciales + f.potenciales, matriculados: a.matriculados + f.matriculados, total: a.total + f.total,
  }), { gestionados: 0, noUtil: 0, potenciales: 0, matriculados: 0, total: 0 })

  const th = (campo, label) => (
    <th onClick={() => setOrden((o) => ({ campo, dir: o.campo === campo ? -o.dir : -1 }))} style={{ cursor: 'pointer' }}>
      {label}{orden.campo === campo ? (orden.dir === -1 ? ' ▾' : ' ▴') : ''}
    </th>
  )

  return (
    <div className="card">
      <div className="card-h">
        <h2>{titulo}</h2>
        <span className="hint">{fs.length} programas · {n0(total.matriculados)} matrículas</span>
      </div>
      <div className="card-b" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {th('nombre', 'Programa')}
                {th('gestionados', 'Gestionados')}
                {th('noUtil', 'No útil')}
                {th('potenciales', 'Potenciales')}
                {th('matriculados', 'Matriculados')}
                {th('total', 'Total')}
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <FragmentGroup key={g.cohorte || 'unico'} g={g} mostrarCohorte={agruparCohorte && g.cohorte} />
              ))}
              <tr className="total">
                <td>Total</td>
                <td>{n0(total.gestionados)}</td>
                <td>{n0(total.noUtil)}</td>
                <td>{n0(total.potenciales)}</td>
                <td>{n0(total.matriculados)}</td>
                <td>{n0(total.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function FragmentGroup({ g, mostrarCohorte }) {
  return (
    <>
      {mostrarCohorte && (
        <tr className="cohorte-h">
          <td>{g.cohorte}</td>
          <td>{n0(g.subtotal.gestionados)}</td>
          <td>{n0(g.subtotal.noUtil)}</td>
          <td>{n0(g.subtotal.potenciales)}</td>
          <td>{n0(g.subtotal.matriculados)}</td>
          <td>{n0(g.subtotal.total)}</td>
        </tr>
      )}
      {g.filas.map((f, i) => (
        <tr key={i}>
          <td>{f.nombre}</td>
          <td>{n0(f.gestionados)}</td>
          <td>{n0(f.noUtil)}</td>
          <td>{n0(f.potenciales)}</td>
          <td>{n0(f.matriculados)}</td>
          <td>{n0(f.total)}</td>
        </tr>
      ))}
    </>
  )
}
