# Tablero de Reportes NODS | +a

Tablero web (Vite + React) para **Anáhuac GMP** (`anahuac_gm`) y **UEES** (`uees`),
alimentado por la API de NODS, con generación de reporte **.pptx** configurable.
Diseño con identidad NODS | +a educação.

## Qué muestra

- **Pestañas por cuenta** (Anáhuac GMP, UEES) — extensible desde `src/cuentas.js`.
- **Funnel** de conversión (leads → no útiles / en gestión → potenciales → matriculados) + segmentos.
- **Insights automáticos** ("data wow": ritmo vs objetivo, ingreso del ciclo, CPL/ROAS,
  precio como freno, oportunidades de gestión, concentración geográfica…). Sólo en el tablero.
- **Objetivos e inversión** (leads/matrículas vs objetivo, acumulado, CPL, inversión de Meta Ads).
- **Evolución diaria** acumulada de matrículas y leads vs objetivo.
- **Leads por semana** (última cerrada + en curso, lun–dom, por segmento).
- **Detalle por programa** — Másters/GMP y **Diplomados agrupados por cohorte**.
- **Ciudades**, **motivos de no compra** y **ticket promedio**.
- **Filtros**: rango de fechas, semana y cohorte.
- **Reporte .pptx** configurable (elegís qué láminas incluir; opcional: objetivos/inversión).
- **Acceso con contraseña** + proxy serverless que guarda el token de la API.

## Arquitectura de datos

La API de NODS entrega datos **crudos y muy grandes** (p. ej. `meta`/Meta Ads ~8 MB por mes,
`consulta_base` decenas de miles de leads). Por eso el tablero no consume los endpoints crudos
directo desde el navegador. Hay dos modos:

1. **snapshot (default):** un proceso agrega los datos crudos al modelo compacto del tablero
   (`src/agg/aggregate.js`) y guarda `public/snapshots/<cuenta>.json` (~25–90 KB). La app los lee
   al instante. Es lo que se despliega.
2. **live:** la función `api/nods.js` hace la misma agregación en el servidor, bajo demanda
   (requiere credenciales de la API + tolera la latencia). Se activa con `VITE_DATA_MODE=live`.

El **mapeo de la API** (validado contra los PDFs de referencia) está en `src/agg/aggregate.js`:
- Funnel/segmentos/tipificaciones/ciudades ← `consulta_base` (leads con `descripcion_sub`,
  `gestionado_neotel`, `descripcion_db`=cohorte, `txtprogramainteres`=programa).
- Matriculados/ticket/ingresos/series diarias ← `matriculas` (`fecha_de_pago`, `precio_con_descuento`).
- Objetivos ← `objetivos` (`objetivo_leads`/`objetivo_matriculas` semanales).
- Inversión ← `meta` (`amount_spent`).

## Correr en local

```bash
npm install
npm run dev
```

Arranca en modo **snapshot** con los snapshots ya incluidos (datos reales del ciclo).

## Regenerar snapshots (refresco de datos)

Los snapshots se generan con `scripts/gen-snapshot.mjs` a partir de los datos crudos:

```bash
node scripts/gen-snapshot.mjs <cuenta> <matriculas.json> <consulta_base.json> [meta.json] [objetivos.json]
```

Para **auto-refrescar en producción** hay que poder llamar la API de NODS desde un proceso
programado (GitHub Action diaria que regenera y commitea, o Vercel Cron + `api/nods`). Ambas
opciones requieren: **URL base de la API + token/API key**. Con eso se completa el ciclo diario.

## Deploy en Vercel (privado)

1. Subir el repo a GitHub.
2. Vercel → **New Project** → importar (framework Vite autodetectado).
3. **Environment Variables**: `APP_PASSWORD` (clave de acceso). Para modo live además
   `VITE_DATA_MODE=live`, `NODS_API_BASE`, `NODS_API_TOKEN` o `NODS_API_KEY`.
4. Deploy. La privacidad la da la pantalla de contraseña + `noindex`.

## Estructura

```
api/nods.js            serverless: agrega en vivo (modo live)
scripts/gen-snapshot.mjs  generador de snapshots (modo snapshot)
src/cuentas.js         registro de cuentas y segmentos
src/agg/aggregate.js   AGREGACIÓN: crudos → modelo compacto (compartido)
src/data/useAccountData.js  hook: lee snapshot o /api/nods
src/lib/               formato, semanas, derivados, insights
src/components/        UI del dashboard
src/report/            generador .pptx + modal de selección de secciones
public/snapshots/      snapshots agregados por cuenta
```
