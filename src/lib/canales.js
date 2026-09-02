// Clasificación de canal de adquisición a partir de (utm_source, utm_medium).
// Puro y sin dependencias → se usa en la agregación (Node) y en el navegador.
//
// Tres macro-categorías, pensadas como un mercadólogo:
//   • pauta    → hay dinero detrás (paid_social / cpc / paid). Meta Ads, Google Ads.
//   • organico → alcance GANADO sin pauta: social orgánico, búsqueda orgánica,
//                directo, referral de sitios, email/CRM propio, eventos.
//   • base     → bases cargadas al sistema (medium=nativo, "form nativo", carga/alta
//                manual). Son listas propias o compradas, NO alcance orgánico: por eso
//                se separan para no inflar el dato de orgánico.
//   • sin      → sin señal de origen (source y medium vacíos o basura).

const lc = (s) => String(s == null ? '' : s).toLowerCase().trim()

export function clasificarCanal(source, medium) {
  const s = lc(source), m = lc(medium)

  // 1) Pauta: cualquier medium pago.
  if (/paid|cpc/.test(m)) {
    const search = (/google|bing/.test(s) || m.includes('cpc')) && !m.includes('social')
    return { macro: 'pauta', canal: search ? 'Search (Ads)' : 'Social (Ads)' }
  }

  // 2) Bases cargadas / carga manual (datos propios, sin alcance real).
  if (s === 'alta manual') return { macro: 'base', canal: 'Alta manual' }
  if (m === 'nativo' || m === 'form nativo' || m === 'carga manual' || m === 'navito')
    return { macro: 'base', canal: 'Base cargada' }

  // 3) Orgánico: alcance ganado, sin pauta.
  if (/instagram|facebook|(^| )fb($| )|(^| )ig($| )|linkedin|l\.facebook|m\.facebook|lm\.facebook/.test(s))
    return { macro: 'organico', canal: 'Social orgánico' }
  if (/google|bing/.test(s) && /organic/.test(m)) return { macro: 'organico', canal: 'Búsqueda orgánica' }
  if (s === '(direct)' || (!s && /none|direct/.test(m))) return { macro: 'organico', canal: 'Directo' }
  if (/referral/.test(m) || /chatgpt|teams|onecdn|microsoft/.test(s)) return { macro: 'organico', canal: 'Referral / sitios' }
  if (/mail|correo|alumni/.test(s + ' ' + m)) return { macro: 'organico', canal: 'Email / CRM' }
  if (/evento|aeropuerto|offline|countdown/.test(s + ' ' + m)) return { macro: 'organico', canal: 'Eventos / offline' }

  // 4) Sin clasificar.
  return { macro: 'sin', canal: 'Sin clasificar' }
}

// Etiqueta legible de la FUENTE cruda (para el desglose "de dónde viene el orgánico").
export function fuenteLabel(source, medium) {
  const s = lc(source)
  const map = {
    'instagram.com': 'Instagram', 'instagram': 'Instagram', 'ig': 'Instagram',
    'facebook.com': 'Facebook', 'm.facebook.com': 'Facebook', 'l.facebook.com': 'Facebook',
    'lm.facebook.com': 'Facebook', 'fb': 'Facebook', 'fb-sitelink': 'Facebook',
    'google': 'Google', 'bing': 'Bing', 'linkedin': 'LinkedIn',
    'chatgpt.com': 'ChatGPT', '(direct)': 'Directo', 'mail': 'Email',
    'sitio-uees': 'Sitio UEES', 'uees.edu.ec': 'Sitio UEES', 'evento': 'Evento', 'offline': 'Offline',
  }
  if (map[s]) return map[s]
  if (!s || s === '(null)' || s === 'null') {
    const m = lc(medium)
    if (/direct|none/.test(m)) return 'Directo'
    if (/mail|correo|alumni/.test(m)) return 'Email'
    if (/referral/.test(m)) return 'Referral'
    return '(sin fuente)'
  }
  return source // valor original si no lo conocemos
}

export const MACROS = ['organico', 'pauta', 'base', 'sin']
export const MACRO_LABEL = { organico: 'Orgánico', pauta: 'Pauta (Ads)', base: 'Bases cargadas', sin: 'Sin clasificar' }
export const MACRO_COLOR = { organico: '#2E9E6B', pauta: '#6A2AC0', base: '#97A0AF', sin: '#CBD2DC' }
export const MACRO_DESC = {
  organico: 'Alcance ganado sin pauta (social orgánico, búsqueda, directo, referral, email, eventos).',
  pauta: 'Campañas pagas: Meta Ads y Google Ads (paid_social, cpc, paid).',
  base: 'Bases cargadas al sistema (medium “nativo” o alta manual): listas propias o compradas, no alcance orgánico.',
  sin: 'Leads sin señal de origen (source y medium vacíos).',
}
