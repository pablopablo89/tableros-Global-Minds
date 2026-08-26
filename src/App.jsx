import { useState } from 'react'
import Gate from './auth/Gate.jsx'
import { CUENTAS } from './config.js'
import AccountView from './components/AccountView.jsx'
import PlusaLogo from './components/PlusaLogo.jsx'

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
          <div className="grad" />
          <div className="inner">
            <div className="brand">
              <img src="/nods-logo.png" alt="NODS" />
              <span className="div" />
              <PlusaLogo height={26} />
            </div>
            <nav className="tabs">
              {CUENTAS.map((c) => (
                <button
                  key={c.id}
                  className={'tab' + (c.id === activa ? ' active' : '')}
                  onClick={() => setActiva(c.id)}
                  style={c.id === activa ? { background: c.acento } : undefined}
                >
                  {c.nombre}
                </button>
              ))}
            </nav>
          </div>
        </div>
        <main className="main">
          <AccountView key={cuenta.id} cuenta={cuenta} />
        </main>
      </div>
    </Gate>
  )
}
