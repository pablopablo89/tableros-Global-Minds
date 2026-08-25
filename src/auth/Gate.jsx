import { useState } from 'react'
import { REQUIRE_PASSWORD } from '../config.js'

// Gate de contraseña a nivel app. La clave se guarda en sessionStorage y se
// reenvía al proxy (/api/nods) como x-app-key. En modo seed no valida contra red;
// en modo API real, la primera llamada 401 revierte el acceso.
export default function Gate({ children }) {
  const yaEntro = () => {
    try { return sessionStorage.getItem('nods_ok') === '1' } catch { return false }
  }
  const [ok, setOk] = useState(!REQUIRE_PASSWORD || yaEntro())
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')

  if (ok) return children

  // Clave esperada (configurada en Vercel como VITE_APP_PASSWORD). Si no hay
  // ninguna configurada, es modo demo y acepta cualquier clave.
  const esperada = import.meta.env.VITE_APP_PASSWORD

  const entrar = (e) => {
    e.preventDefault()
    if (!pwd.trim()) { setErr('Ingresá la clave'); return }
    if (esperada && pwd !== esperada) { setErr('Clave incorrecta'); return }
    try {
      sessionStorage.setItem('nods_app_key', pwd)
      sessionStorage.setItem('nods_ok', '1')
    } catch {}
    setOk(true)
  }

  return (
    <div className="gate">
      <form className="box" onSubmit={entrar}>
        <div className="grad" />
        <h1>Tablero de Reportes</h1>
        <p>NODS · en alianza con +a educação</p>
        <input
          type="password"
          placeholder="Clave de acceso"
          value={pwd}
          onChange={(e) => { setPwd(e.target.value); setErr('') }}
          autoFocus
        />
        {err && <div className="err">{err}</div>}
        <button className="btn primary" style={{ width: '100%', justifyContent: 'center' }}>Entrar</button>
        {!esperada && <p className="small faint" style={{ marginTop: 14, marginBottom: 0 }}>Modo demo · sin clave configurada</p>}
      </form>
    </div>
  )
}
