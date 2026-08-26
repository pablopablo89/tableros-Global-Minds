// Logo "+a educação" recreado en SVG (colores de marca). Si más adelante hay
// un asset oficial, se reemplaza por un <img>.
export default function PlusaLogo({ height = 26 }) {
  return (
    <svg height={height} viewBox="0 0 92 40" role="img" aria-label="+a educação" style={{ display: 'block' }}>
      {/* signo + */}
      <g fill="#E11D48">
        <rect x="1" y="11.5" width="27" height="7" rx="1.6" />
        <rect x="11" y="1.5" width="7" height="27" rx="1.6" />
      </g>
      {/* letra a */}
      <text x="33" y="27" fontFamily="'Space Grotesk', system-ui, sans-serif" fontWeight="700" fontSize="32" fill="#12B3A6">a</text>
      {/* wordmark */}
      <text x="2" y="37.5" fontFamily="'Space Grotesk', system-ui, sans-serif" fontWeight="500" fontSize="6.4" letterSpacing="2.6" fill="#5B6472">EDUCAÇÃO</text>
    </svg>
  )
}
