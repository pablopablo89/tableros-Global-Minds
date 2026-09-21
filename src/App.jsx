import { useState, useRef, useEffect } from 'react'
import Gate from './auth/Gate.jsx'
import { CUENTAS } from './config.js'
import AccountView from './components/AccountView.jsx'

export default function App() {
  const [activa, setActiva] = useState(CUENTAS[0].id)
  const cuenta = CUENTAS.find((c) => c.id === activa) || CUENTAS[0]

  return (
    <Gate>
      <div
        className="app"
        style={{ '--acc': cuenta.acento, '--acc-soft': cuenta.acentoSuave }}
      >
        <div className="topbar">
          <img className="headerimg" src="/covers/header.png" alt="NODS | +a educação" />
          <div className="tabsbar">
            <AccountSwitcher cuentas={CUENTAS} activa={activa} onPick={setActiva} />
          </div>
        </div>
        <main className="main">
          <AccountView key={cuenta.id} cuenta={cuenta} />
        </main>
      </div>
    </Gate>
  )
}

// Selector de cuenta como desplegable: colapsado sólo muestra la cuenta ACTIVA, así se
// puede compartir pantalla sin exponer las demás universidades. Las otras aparecen sólo
// al abrirlo (acción deliberada del usuario).
function AccountSwitcher({ cuentas, activa, onPick }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const cur = cuentas.find((c) => c.id === activa) || cuentas[0]

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="acctsw" ref={ref}>
      <button className="acctsw-btn" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open} style={{ '--dot': cur.acento }}>
        <span className="dot" />
        <span className="nm">{cur.nombre}</span>
        <svg className={'chev' + (open ? ' up' : '')} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="acctsw-menu" role="listbox">
          {cuentas.map((c) => (
            <button
              key={c.id}
              role="option"
              aria-selected={c.id === activa}
              className={'acctsw-item' + (c.id === activa ? ' sel' : '')}
              onClick={() => { onPick(c.id); setOpen(false) }}
              style={{ '--dot': c.acento }}
            >
              <span className="dot" />
              <span className="nm">{c.nombre}</span>
              {c.id === activa && <span className="tick">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
