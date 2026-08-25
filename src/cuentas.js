// Registro de cuentas (puro, sin dependencias de Vite → usable en Node y navegador).
// `cuenta` = identificador real en la API de NODS.
// `segmentos[].prefijo` = con qué empieza el nombre del programa en esa cuenta.

export const CUENTAS = [
  {
    id: 'anahuac_gm',
    nombre: 'Anáhuac GMP',
    subtitulo: 'Universidad Anáhuac México · GMP',
    cuenta: 'anahuac_gm',
    pais: 'México',
    moneda: 'MXN',
    acento: '#E1743F',
    acentoSuave: '#FBEDE4',
    segmentos: [
      { id: 'mas', nombre: 'Másters', prefijo: 'Master' },
      { id: 'dip', nombre: 'Diplomados', prefijo: 'Diplomado' },
    ],
  },
  {
    id: 'uees',
    nombre: 'UEES',
    subtitulo: 'Universidad Espíritu Santo · Ecuador',
    cuenta: 'uees',
    pais: 'Ecuador',
    moneda: 'USD',
    acento: '#7C2A86',
    acentoSuave: '#F1E6F3',
    segmentos: [
      { id: 'gmp', nombre: 'GMP', prefijo: 'GMP' },
      { id: 'dip', nombre: 'Diplomados', prefijo: 'DIPLOMADO' },
    ],
  },
]

export const ETAPAS_FUNNEL = [
  { id: 'noUtiles', label: 'No útiles' },
  { id: 'enGestion', label: 'En gestión' },
  { id: 'potenciales', label: 'Potenciales' },
  { id: 'matriculados', label: 'Matriculados' },
]
