import fs from 'fs'
import { CUENTAS } from '../src/cuentas.js'
import { SECCIONES } from '../src/report/buildPptx.js'
import { generarPdf } from '../src/report/buildPdf.js'
fs.mkdirSync('dist-report',{recursive:true})
for (const id of ['anahuac_gm','uees']) {
  const cfg = CUENTAS.find(c=>c.id===id)
  const data = JSON.parse(fs.readFileSync(`public/snapshots/${id}.json`,'utf8'))
  const doc = await generarPdf(data, cfg, SECCIONES.map(s=>s.id))
  const buf = Buffer.from(doc.output('arraybuffer'))
  const name = `dist-report/${cfg.nombre.replace(/\s+/g,'_')}_${data.fechaCorte}.pdf`
  fs.writeFileSync(name, buf)
  console.log('OK', name, (buf.length/1024).toFixed(0)+'KB', '· páginas:', doc.getNumberOfPages())
}
