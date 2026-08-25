import { generarInsights } from '../lib/insights.js'

export default function Insights({ data, cfg }) {
  const items = generarInsights(data, cfg)
  return (
    <div className="card">
      <div className="card-h"><h2>Insights</h2><span className="hint">lectura automática</span></div>
      <div className="card-b insights">
        {items.map((it, i) => (
          <div key={i} className={'insight ' + it.tipo}>
            <span className="dot" />
            <span className="txt" dangerouslySetInnerHTML={{ __html: it.texto }} />
          </div>
        ))}
      </div>
    </div>
  )
}
