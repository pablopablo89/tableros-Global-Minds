// Clasificación de canal de adquisición a partir de (utm_source, utm_medium).
// Puro y sin dependencias → se usa en la agregación (Node) y en el navegador.
//
// Macro-categorías, pensadas como un mercadólogo:
//   • pauta    → hay dinero detrás. Incluye paid_social / cpc / paid, los
//                FORMULARIOS NATIVOS de Meta (medium=nativo) y las cargas
//                manuales (source "alta manual"): todo eso proviene de campañas
//                pagas (confirmado por el usuario). No es alcance orgánico.
//   • organico → alcance GANADO sin pauta: social orgánico, búsqueda orgánica,
//                directo, referral de sitios, email/CRM propio, eventos.
//   • sin      → sin señal de origen (source y medium vacíos o basura).

const lc = (s) => String(s == null ? '' : s).toLowerCase().trim()

export function clasificarCanal(source, medium) {
  const s = lc(source), m = lc(medium)

  // 1) Pauta: medium pago.
  if (/paid|cpc/.test(m)) {
    const search = (/google|bing/.test(s) || m.includes('cpc')) && !m.includes('social')
    return { macro: 'pauta', canal: search ? 'Search (Ads)' : 'Social (Ads)' }
  }

  // 2) Formularios nativos de Meta → pauta (lead-form instantáneo de campañas pagas).
  if (m === 'nativo' || m === 'form nativo' || m === 'carga nativa' || m === 'navito')
    return { macro: 'pauta', canal: 'Formulario nativo' }

  // 3) Carga manual → pauta (también proviene de campañas pagas).
  if (s === 'alta manual' || m === 'carga manual') return { macro: 'pauta', canal: 'Carga manual' }

  // 4) Orgánico: alcance ganado, sin pauta.
  if (/instagram|facebook|(^| )fb($| )|(^| )ig($| )|linkedin|l\.facebook|m\.facebook|lm\.facebook/.test(s))
    return { macro: 'organico', canal: 'Social orgánico' }
  if (/google|bing/.test(s) && /organic/.test(m)) return { macro: 'organico', canal: 'Búsqueda orgánica' }
  if (s === '(direct)' || (!s && /none|direct/.test(m))) return { macro: 'organico', canal: 'Directo' }
  if (/referral/.test(m) || /chatgpt|teams|onecdn|microsoft/.test(s)) return { macro: 'organico', canal: 'Referral / sitios' }
  if (/mail|correo|alumni/.test(s + ' ' + m)) return { macro: 'organico', canal: 'Email / CRM' }
  if (/evento|aeropuerto|offline|countdown/.test(s + ' ' + m)) return { macro: 'organico', canal: 'Eventos / offline' }

  // 5) Sin clasificar.
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

export const MACROS = ['organico', 'pauta', 'sin']
export const MACRO_LABEL = { organico: 'Orgánico', pauta: 'Pauta (Ads)', sin: 'Sin clasificar' }
export const MACRO_COLOR = { organico: '#2E9E6B', pauta: '#6A2AC0', sin: '#CBD2DC' }
export const MACRO_DESC = {
  organico: 'Alcance ganado sin pauta (social orgánico, búsqueda, directo, referral, email, eventos).',
  pauta: 'Campañas pagas: Meta Ads y Google Ads, incluidos formularios nativos y cargas manuales (paid_social, cpc, paid, nativo, alta manual).',
  sin: 'Leads sin señal de origen (source y medium vacíos).',
}
