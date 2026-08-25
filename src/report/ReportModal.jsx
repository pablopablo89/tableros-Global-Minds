import { useState } from 'react'
import { SECCIONES, generarPptx } from './buildPptx.js'
import { generarPdf } from './buildPdf.js'

export default function ReportModal({ data, cfg, onClose }) {
  const [sel, setSel] = useState(SECCIONES.filter((s) => s.base).map((s) => s.id))
  const [formato, setFormato] = useState('pptx')
  const [gen, setGen] = useState(false)

  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const descargar = async () => {
    setGen(true)
    try {
      const orden = SECCIONES.filter((s) => sel.includes(s.id)).map((s) => s.id)
      if (formato === 'pdf') await generarPdf(data, cfg, orden)
      else await generarPptx(data, cfg, orden)
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
          <p className="small muted" style={{ marginTop: 0 }}>Elegí formato y qué láminas incluir. Las base replican tu presentación; las opcionales suman información del tablero.</p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {['pptx', 'pdf'].map((f) => (
              <button key={f} className={'btn' + (formato === f ? ' primary' : '')} onClick={() => setFormato(f)} style={{ flex: 1, justifyContent: 'center', textTransform: 'uppercase' }}>
                {f}
              </button>
            ))}
          </div>

          {SECCIONES.map((s) => (
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
