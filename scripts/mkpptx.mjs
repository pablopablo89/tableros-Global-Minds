import fs from 'fs'
import { CUENTAS } from '../src/cuentas.js'
import { SECCIONES, generarPptx } from '../src/report/buildPptx.js'
// en node, writeFile escribe a disco
for (const id of ['uees']) {
  const cfg = CUENTAS.find(c=>c.id===id)
  const data = JSON.parse(fs.readFileSync(`public/snapshots/${id}.json`,'utf8'))
  const n = await generarPptx(data, cfg, SECCIONES.map(s=>s.id))
  console.log('OK pptx', n)
}
