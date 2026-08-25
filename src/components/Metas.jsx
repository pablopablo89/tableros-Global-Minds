import { n0, pct, money, avance } from '../lib/format.js'

// Solo dashboard: leads vs meta + inversión, y matrículas vs meta + acumulado.
function Meter({ label, real, meta, sub }) {
  const hayMeta = meta != null && meta > 0
  const av = hayMeta ? avance(real, meta) : null
  const cls = av == null ? '' : av >= 100 ? 'up' : av >= 80 ? 'warn' : 'down'
  return (
    <div className="meter">
      <div className="m-top">
        <span className="k">{label}</span>
        <span>
          <b>{n0(real)}</b>{' '}
          {hayMeta ? <><span className="faint">/ {n0(meta)}</span> {av != null && <span className={cls}>· {pct(av, 0)}</span>}</> : <span className="faint small">objetivo pendiente</span>}
        </span>
      </div>
      <div className="track"><div className="fill" style={{ width: (hayMeta ? Math.min(100, av || 0) : 0) + '%' }} /></div>
      {sub && <div className="m-sub">{sub}</div>}
    </div>
  )
}

export default function Metas({ data, cfg }) {
  const m = data.metas || {}
  const leads = m.leads || {}
  const mat = m.matriculas || {}
  const v = m.inversionVentana
  const cpl = leads.inversion && v?.leads ? leads.inversion / v.leads : null
  const cob = m.coberturaInversion
  return (
    <div className="card">
      <div className="card-h">
        <h2>Objetivos e inversión</h2>
        {cob && <span className="hint">inversión {cob.desde} → {cob.hasta}</span>}
      </div>
      <div className="card-b grid cols-2">
        <div>
          <Meter label="Leads vs objetivo" real={leads.real} meta={leads.meta}
            sub={leads.inversion ? `Inversión ${money(leads.inversion, cfg.moneda)} · CPL ${money(cpl, cfg.moneda)}` : null} />
          {m.porSegmento && cfg.segmentos.map((s) => {
            const ps = m.porSegmento[s.id]
            if (!ps) return null
            return <Meter key={s.id} label={`Leads ${s.nombre}`} real={ps.leadsReal} meta={ps.leadsMeta} />
          })}
        </div>
        <div>
          <Meter label="Matrículas vs objetivo" real={mat.real} meta={mat.meta}
            sub={mat.acumulado != null ? `Acumulado del ciclo: ${n0(mat.acumulado)}` : null} />
          {m.porSegmento && cfg.segmentos.map((s) => {
            const ps = m.porSegmento[s.id]
            if (!ps) return null
            return <Meter key={s.id} label={`Matrículas ${s.nombre}`} real={ps.matReal} meta={ps.matMeta} />
          })}
        </div>
      </div>
    </div>
  )
}
