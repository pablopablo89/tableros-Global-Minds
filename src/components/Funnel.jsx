import { n0, pct } from '../lib/format.js'
import { pasosFunnel } from '../lib/derive.js'

export default function Funnel({ data, cfg }) {
  const pasos = pasosFunnel(data.funnel)
  return (
    <div className="card">
      <div className="card-h">
        <h2>Funnel de conversión</h2>
        <span className="hint">{n0(data.funnel.leadsTotales)} leads totales</span>
      </div>
      <div className="card-b">
        <div className="grid cols-2" style={{ alignItems: 'start' }}>
          <div className="funnel">
            {pasos.map((p) => (
              <div key={p.id}>
                <div className="step" style={{ width: p.w + '%', opacity: p.id === 'leadsTotales' ? 1 : 0.92 }}>
                  <div className="s-lbl">{p.label}</div>
                  <div className="s-val">{n0(p.val)}</div>
                </div>
                {p.conv != null && <div className="conv">↳ {pct(p.conv)} {p.base}</div>}
              </div>
            ))}
            {data.funnel.notas?.map((nota, i) => (
              <div key={i} className="small faint" style={{ marginTop: 8 }}>{nota}</div>
            ))}
          </div>
          <div className="segcards">
            {data.segmentos.map((s) => (
              <div key={s.id} className="segcard">
                <div className="sc-h">{s.nombre}</div>
                <div className="sc-row"><span className="k">Leads</span><span className="v">{n0(s.leads)}</span></div>
                <div className="sc-row"><span className="k">Contacto</span><span className="v">{pct(s.contactoPct)}</span></div>
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
