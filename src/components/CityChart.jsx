import { useState } from 'react'
import { n0 } from '../lib/format.js'

export default function CityChart({ data }) {
  const [verTodas, setVerTodas] = useState(false)
  const ciudades = [...(data.ciudades || [])].sort((a, b) => b.matriculados - a.matriculados)
  const max = ciudades[0]?.matriculados || 1
  const lista = verTodas ? ciudades : ciudades.slice(0, 15)
  return (
    <div className="card">
      <div className="card-h">
        <h2>Detalle por ciudad</h2>
        <button className="btn" style={{ padding: '5px 10px' }} onClick={() => setVerTodas((v) => !v)}>
          {verTodas ? 'Ver top 15' : `Ver todas (${ciudades.length})`}
        </button>
      </div>
      <div className="card-b">
        <div className="citybars">
          {lista.map((c) => (
            <div className="row" key={c.ciudad}>
              <span className="name" title={c.ciudad}>{c.ciudad}</span>
              <span className="bar" style={{ width: Math.max(2, (c.matriculados / max) * 100) + '%' }} />
              <span className="num">{n0(c.matriculados)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
