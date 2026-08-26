// Carga la portada del deck (public/covers/<cuenta>.png) como data URL.
// Funciona en navegador (fetch) y en Node/tests (lectura de archivo).
export async function coverDataUrl(cfg) {
  const file = `${cfg.id}.png`
  if (typeof fetch !== 'undefined' && typeof document !== 'undefined') {
    try {
      const r = await fetch(`/covers/${file}`)
      if (!r.ok) return null
      const blob = await r.blob()
      return await new Promise((res) => {
        const fr = new FileReader()
        fr.onload = () => res(fr.result)
        fr.onerror = () => res(null)
        fr.readAsDataURL(blob)
      })
    } catch { return null }
  }
  // Node
  try {
    const fs = await import('fs')
    const path = await import('path')
    const p = path.join(process.cwd(), 'public', 'covers', file)
    const b = fs.readFileSync(p)
    return 'data:image/png;base64,' + b.toString('base64')
  } catch { return null }
}
