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
    // Bases (id de NODS) con el programa CERRADO: sus potenciales no cuentan (el
    // programa reabre ~en un año). base 5 = "Diplomados 2026_1". Quitar al reabrir.
    basesCerradas: [5],
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
  {
    id: 'uniandes',
    nombre: 'Uniandes',
    subtitulo: 'Universidad de los Andes · Colombia',
    cuenta: 'uniandes',
    pais: 'Colombia',
    moneda: 'COP',
    acento: '#B7791F',
    acentoSuave: '#F6ECD6',
    // Uniandes no tiene split Máster/Diplomado (tipo_programa vacío) → un solo segmento
    // con todos los programas (prefijo '' matchea cualquiera).
    segmentos: [
      { id: 'prog', nombre: 'Programas', prefijo: '' },
    ],
    // Sólo la cohorte NUEVA (2026-2): matrículas con cohorte 2026-02 y leads de la base
    // "Cohorte 2026-3" (id 212), que es la base de captación de esta cohorte en NODS.
    cohorteActiva: { matricula: '2026-02', leadBaseIds: [212], label: 'Cohorte 2026-2' },
  },
]

export const ETAPAS_FUNNEL = [
  { id: 'noUtiles', label: 'No útiles' },
  { id: 'enGestion', label: 'En gestión' },
  { id: 'potenciales', label: 'Potenciales' },
  { id: 'matriculados', label: 'Matriculados' },
]
