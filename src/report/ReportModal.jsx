import { useState } from 'react'
import { SECCIONES, generarPptx } from './buildPptx.js'
import { generarPdf } from './buildPdf.js'

export default function ReportModal({ data, cfg, periodo, onClose }) {
  // La lámina de objetivos es sólo del ciclo completo: se oculta al filtrar por período.
  const secciones = SECCIONES.filter((s) => !(periodo && s.id === 'objetivos'))
  const [sel, setSel] = useState(secciones.filter((s) => s.base).map((s) => s.id))
  const [formato, setFormato] = useState('pptx')
  const [gen, setGen] = useState(false)

  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const descargar = async () => {
    setGen(true)
    try {
      const orden = secciones.filter((s) => sel.includes(s.id)).map((s) => s.id)
      if (formato === 'pdf') await generarPdf(data, cfg, orden, periodo)
      else await generarPptx(data, cfg, orden, periodo)
      onClose()
    } catch (e) {
      alert('No se pudo generar el reporte: ' + e)
    } finally {
      setGen(false)
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-h">Generar reporte — {cfg.nombre}</div>
        <div className="m-b">
          {periodo
            ? <p className="small" style={{ marginTop: 0, padding: '8px 10px', background: cfg.acentoSuave, borderRadius: 8 }}>📅 Reporte del período: <b>{periodo.label}</b>. Los datos salen de ese corte. La lámina de objetivos (sólo del ciclo) no se incluye.</p>
            : <p className="small muted" style={{ marginTop: 0 }}>Elegí formato y qué láminas incluir. Las base replican tu presentación; las opcionales suman información del tablero.</p>}

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {['pptx', 'pdf'].map((f) => (
              <button key={f} className={'btn' + (formato === f ? ' primary' : '')} onClick={() => setFormato(f)} style={{ flex: 1, justifyContent: 'center', textTransform: 'uppercase' }}>
                {f}
              </button>
            ))}
          </div>

          {secciones.map((s) => (
            <label className="check" key={s.id}>
              <input type="checkbox" checked={sel.includes(s.id)} onChange={() => toggle(s.id)} />
              <span>
                {s.label} {!s.base && <span className="opt-sub">· opcional</span>}
                {s.sub && <div className="opt-sub">{s.sub}</div>}
              </span>
            </label>
          ))}
        </div>
        <div className="m-f">
          <button className="btn" onClick={onClose} disabled={gen}>Cancelar</button>
          <button className="btn primary" onClick={descargar} disabled={gen || !sel.length}>
            {gen ? 'Generando…' : `Descargar .${formato}`}
          </button>
        </div>
      </div>
    </div>
  )
}
