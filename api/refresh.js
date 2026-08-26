// Dispara un refresco real: llama al Deploy Hook de Vercel, que rebuildeá el sitio
// corriendo scripts/refresh-live.mjs (trae datos frescos de NODS). Tarda ~1-2 min.
// Protegido por la clave de la app (x-app-key).
export default async function handler(req, res) {
  const appPassword = process.env.APP_PASSWORD
  if (appPassword) {
    const key = req.headers['x-app-key']
    if (!key || key !== appPassword) return res.status(401).json({ error: 'No autorizado' })
  }
  const hook = process.env.DEPLOY_HOOK_URL
  if (!hook) return res.status(500).json({ error: 'Falta DEPLOY_HOOK_URL en Vercel.' })
  try {
    const r = await fetch(hook, { method: 'POST' })
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status })
  } catch (e) {
    return res.status(502).json({ error: String(e) })
  }
}
