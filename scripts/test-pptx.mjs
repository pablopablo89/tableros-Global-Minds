// Prueba de generación del reporte pptx en Node con un snapshot real.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { CUENTAS } from '../src/cuentas.js'
import { SECCIONES, generarPptx } from '../src/report/buildPptx.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cuentaId = process.argv[2] || 'anahuac_gm'
const cfg = CUENTAS.find((c) => c.id === cuentaId)
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'snapshots', `${cuentaId}.json`), 'utf8'))

// todas las secciones (incluida la opcional de objetivos)
const seleccion = SECCIONES.map((s) => s.id)
process.chdir(path.join(__dirname, '..', 'dist-report'))
const nombre = await generarPptx(data, cfg, seleccion)
console.log('OK generado:', nombre)
