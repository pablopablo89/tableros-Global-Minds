// Config del navegador. Reexporta el registro puro de cuentas y agrega flags de entorno.
export { CUENTAS, ETAPAS_FUNNEL } from './cuentas.js'

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}
export const USE_SEED = (env.VITE_USE_SEED ?? 'true') !== 'false'
export const REQUIRE_PASSWORD = (env.VITE_REQUIRE_PASSWORD ?? 'true') !== 'false'
