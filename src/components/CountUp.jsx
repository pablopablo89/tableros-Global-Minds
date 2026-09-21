import { useEffect, useRef, useState } from 'react'

// Número que se anima (cuenta) hacia su valor. En el primer render sube desde 0;
// cuando el valor cambia (ej. filtro de período) transiciona suave del valor anterior
// al nuevo. Respeta prefers-reduced-motion. `format` da el string final (n0, pct, money…).
const REDUCED = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false

export default function CountUp({ value, format = (v) => String(Math.round(v)), dur = 1100 }) {
  const to = Number(value) || 0
  const [disp, setDisp] = useState(REDUCED ? to : 0)
  const fromRef = useRef(REDUCED ? to : 0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (REDUCED) { setDisp(to); fromRef.current = to; return }
    const from = fromRef.current
    if (from === to) { setDisp(to); return }
    let start
    const step = (t) => {
      if (start == null) start = t
      const p = Math.min((t - start) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3) // easeOutCubic
      const cur = from + (to - from) * e
      setDisp(cur)
      fromRef.current = cur
      if (p < 1) rafRef.current = requestAnimationFrame(step)
      else { setDisp(to); fromRef.current = to }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [to, dur])

  return <>{format(disp)}</>
}
