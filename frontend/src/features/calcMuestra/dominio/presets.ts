/**
 * Perfiles del motor muestral.
 *
 * El motor no incorpora datos fijos de ningún proyecto: los datos activos
 * provienen del proyecto abierto o se editan manualmente. Este archivo aporta:
 *   - PERFIL_EJEMPLO: el caso de referencia verificado (estudio universitario
 *     en aulas, 2026) con el que se validó el método. Se marca `esEjemplo` y
 *     la UI lo señala siempre como ejemplo.
 *   - PLANTILLA_UNIVERSIDAD / PLANTILLA_ESCUELA: configuraciones genéricas
 *     (criterios, parámetros, modelo de datos) sin datos de población, para
 *     iniciar un proyecto desde cero.
 *
 * Las cifras del ejemplo están verificadas contra la documentación
 * metodológica del caso de referencia; los tests de motor.test.ts las usan
 * como golden del método.
 */
import type {
  ConfigEscenario2,
  CriterioAlumno,
  CriterioAula,
  FacultadDatos,
  ParametrosMuestra,
  PerfilInstitucional,
} from "./tipos";

/** f(id, nombre, N, segA, segB, mediana, media, alcanzables, pExito) */
function f(
  id: string,
  nombre: string,
  N: number,
  mujeres: number,
  hombres: number,
  estAulaMediana: number | null,
  estAulaMedia: number | null,
  alcanzables: number | null,
  pExito: number | null,
): FacultadDatos {
  return { id, nombre, N, mujeres, hombres, estAulaMediana, estAulaMedia, alcanzables, pExito };
}

/** Criterios de ALUMNO del método (genéricos; la variable exacta se mapea por proyecto). */
const CRITERIOS_ALUMNO: CriterioAlumno[] = [
  {
    id: "formacion",
    etiqueta: "Formación: pregrado",
    incluye: "Estudiantes de pregrado",
    excluye: "Posgrado, segundas especialidades, diplomados",
    variable: "formacion",
    capa: "marco",
    rol: "filtro",
    porQue: "Delimita la población al nivel formativo que el estudio representa.",
  },
  {
    id: "condicion",
    etiqueta: "Condición: matrícula regular",
    incluye: "Matriculados activos regulares del periodo",
    excluye: "Bajas, retiros, congelamientos, condiciones especiales",
    variable: "condicion",
    capa: "marco",
    rol: "filtro",
    porQue: "Solo la matrícula regular permite proyectar presencia en el salón durante la aplicación.",
  },
  {
    id: "edad",
    etiqueta: "Edad mínima: 18 años",
    incluye: "Mayores de edad",
    excluye: "Menores de 18",
    variable: "edad",
    capa: "marco",
    rol: "filtro",
    porQue: "Requisito de consentimiento informado adulto.",
  },
  {
    id: "unidad",
    etiqueta: "Unidad académica (estratifica)",
    incluye: "Las unidades objetivo del estudio",
    excluye: "Nada por sí misma: las no-unidades caen por formación/condición",
    variable: "unidad_academica",
    capa: "marco",
    rol: "estratifica",
    porQue: "Reparte la muestra en cuotas proporcionales; no excluye personas.",
  },
  {
    id: "ciclo",
    etiqueta: "Ciclo: 2.º en adelante",
    incluye: "Estudiantes con más de un periodo cursado",
    excluye: "Primer ciclo — se resuelve en el instrumento, no en la base",
    variable: "nivel_curricular",
    capa: "instrumento",
    rol: "confirmacion",
    porQue: "El ciclo registrado es poco fiable en ciclos iniciales; el instrumento lo confirma con una pregunta filtro y el N del marco se mantiene comparable entre periodos.",
  },
];

/** Criterios de AULA: 5 reglas base + 2 opcionales de prevalencia. */
const CRITERIOS_AULA: CriterioAula[] = [
  {
    id: "presencial",
    etiqueta: "Modalidad presencial",
    regla: "El curso-horario se dicta de forma presencial",
    variable: "modalidad",
    tipo: "base",
    porQue: "La aplicación es en un salón físico; las secciones virtuales no tienen punto de aplicación.",
  },
  {
    id: "tipo-curso",
    etiqueta: "Tipo de curso válido",
    regla: "Teórico, teórico-práctico o teórico-laboratorio",
    variable: "tipo_curso",
    tipo: "base",
    porQue: "Seminarios, tesis y asesorías no reúnen a un grupo estable en horario fijo.",
  },
  {
    id: "min-elegibles",
    etiqueta: "Mínimo de elegibles por curso-horario",
    regla: "matriculados_población ≥ umbral (elegibles, no total)",
    variable: "matriculados_población",
    tipo: "base",
    porQue: "Bajo el umbral, el rendimiento esperado no justifica la visita. El conteo es sobre elegibles: un curso-horario con 40 matriculados puede aportar solo 25.",
  },
  {
    id: "docente",
    etiqueta: "Docente estable",
    regla: "Al menos un docente contratado u ordinario",
    variable: "tipo_docente",
    tipo: "base",
    porQue: "La aplicación se coordina con el docente; la regla «al menos uno» consolida cursos-horario con varios docentes.",
  },
  {
    id: "nivel-unidad",
    etiqueta: "Nivel del curso según la unidad",
    regla: "El nivel del curso cae en el rango definido para su unidad académica",
    variable: "nivel_curso",
    tipo: "base",
    porQue: "Evita duplicar cursos-horario cuando los primeros niveles se cursan fuera de la unidad (p. ej. estudios generales). El rango se define por unidad en el mapa del proyecto.",
  },
  {
    id: "c7",
    etiqueta: "c7 · Prevalencia de población ≥ 80%",
    regla: "≥ 80% del curso-horario pertenece a la población objetivo",
    variable: "derivada del cruce",
    tipo: "opcional",
    porQue: "Endurece la calidad del curso-horario. Verificar el efecto sobre cobertura y cuotas antes de activarlo.",
  },
  {
    id: "c8",
    etiqueta: "c8 · Homogeneidad de ciclo ≥ 80%",
    regla: "≥ 80% del curso-horario está en el ciclo modal",
    variable: "derivada del cruce",
    tipo: "opcional",
    porQue: "Los cursos-horario mezclan ciclos de forma natural; este criterio suele reducir el marco de manera drástica. Verificar factibilidad por unidad antes de activarlo.",
  },
];

const PARAMETROS_BASE: ParametrosMuestra = {
  confianza: 0.95,
  margenError: 0.025,
  proporcion: 0.5,
  deff: 2,
  factorSobremuestra: 1.5,
  nDiseno: null,
};

const ESCENARIO2_BASE: ConfigEscenario2 = {
  escalones: [
    { nDesde: 1001, confianza: 0.95, margenError: 0.05 },
    { nDesde: 300, confianza: 0.95, margenError: 0.07 },
    { nDesde: 0, confianza: 0.9, margenError: 0.1 },
  ],
  deff: 1.5,
  factorSobremuestra: 1.2,
  proporcionFallback: 0.5,
  totalDiseno: null,
  sobremuestraOficial: null,
  tablaOficial: null,
};

/** Plantilla: universidad con dos bases relacionadas (estudiantes + cursos-horario). */
export const PLANTILLA_UNIVERSIDAD: PerfilInstitucional = {
  id: "plantilla-universidad",
  nombre: "Proyecto nuevo — universidad",
  siglas: "—",
  esEjemplo: false,
  etiquetaUnidad: "facultad",
  etiquetasSexo: ["Mujeres", "Hombres"],
  anio: new Date().getFullYear(),
  etapa: "propuesta",
  fuenteData: "por definir",
  modeloDatos: {
    bases: 2,
    descripcion: "Dos bases relacionadas: estudiantes (alumno × curso-horario) y cursos-horario (curso × docente), unidas por la llave curso-horario.",
    llaveCruce: "curso-horario",
    riesgo: "Reconciliar los conteos entre ambas bases al cruzarlas.",
  },
  facultades: [],
  universo: null,
  embudoAlumno: null,
  aulasTotales: null,
  embudoAula: null,
  marcoAulas: null,
  criteriosAlumno: CRITERIOS_ALUMNO.map((c) => ({ ...c })),
  criteriosAula: CRITERIOS_AULA.map((c) => ({ ...c })),
  mapaNivelPorFacultad: null,
  parametros: { ...PARAMETROS_BASE },
  escenario2: { ...ESCENARIO2_BASE, escalones: ESCENARIO2_BASE.escalones.map((e) => ({ ...e })) },
  resumenEstAula: "min_mediana_media",
  bolsaOpciones: [0, 1, 2],
  bolsaSugerida: 1,
  notas: [],
};

/** Plantilla: institución con una base plana (p. ej. escuela; incluye criterio de sede). */
export const PLANTILLA_ESCUELA: PerfilInstitucional = {
  ...PLANTILLA_UNIVERSIDAD,
  id: "plantilla-escuela",
  nombre: "Proyecto nuevo — base plana",
  etiquetaUnidad: "grado",
  modeloDatos: {
    bases: 1,
    descripcion: "Una base plana alumno × curso × docente, con deduplicación por código de alumno.",
    llaveCruce: null,
    riesgo: "Contar duplicando: deduplicar por código de alumno antes de todo conteo.",
  },
  criteriosAlumno: CRITERIOS_ALUMNO.map((c) => ({ ...c })),
  criteriosAula: [
    ...CRITERIOS_AULA.filter((c) => c.tipo === "base").map((c) => ({ ...c })),
    {
      id: "sede",
      etiqueta: "Sede",
      regla: "Solo las sedes definidas para el operativo",
      variable: "sede",
      tipo: "base",
      porQue: "En instituciones con filiales, el alcance de sedes se decide explícitamente.",
    },
    ...CRITERIOS_AULA.filter((c) => c.tipo === "opcional").map((c) => ({ ...c })),
  ],
};

/**
 * Caso de referencia (EJEMPLO): estudio universitario en aulas, 2026.
 * Datos verificados con los que se validó el método — 15 unidades, dos bases,
 * dos escenarios. La UI lo presenta siempre con la marca de ejemplo.
 */
const UNIDADES_EJEMPLO: FacultadDatos[] = [
  f("arquitectura", "Arquitectura y Urbanismo", 1080, 744, 336, 20, 27.6, 858, 0.30),
  f("arte-diseno", "Arte y Diseño", 1021, 792, 229, 15, 16.7, 974, 0.50),
  f("artes-escenicas", "Artes Escénicas", 590, 307, 283, 11, 16.1, 529, 0.50),
  f("contables", "Ciencias Contables", 183, 96, 87, 26, 24.9, 124, 0.20),
  f("ciencias-ingenieria", "Ciencias e Ingeniería", 4512, 1127, 3385, 25, 27.2, 4414, 0.20),
  f("ciencias-sociales", "Ciencias Sociales", 1287, 689, 598, 22, 22.6, 1042, 0.40),
  f("comunicacion", "Comunicación", 832, 531, 301, 22, 20.1, 785, 0.40),
  f("derecho", "Derecho", 2969, 1933, 1036, 33, 26.7, 2535, 0.50),
  f("educacion", "Educación", 197, 158, 39, 15, 16.2, 164, 0.60),
  f("generales-ciencias", "Estudios Generales Ciencias", 3355, 951, 2404, 34, 32.2, 3305, 0.20),
  f("generales-letras", "Estudios Generales Letras", 3327, 1932, 1395, 40, 36.0, 3322, 0.30),
  f("gastronomia", "Gastronomía y Turismo", 128, 80, 48, 16, 18.0, 118, 0.30),
  f("gestion", "Gestión y Alta Dirección", 986, 574, 412, 27, 26.4, 792, 0.30),
  f("letras-ch", "Letras y Ciencias Humanas", 225, 128, 97, 10, 10.3, 182, 0.30),
  f("psicologia", "Psicología", 673, 496, 177, 25, 47.9, 567, 0.50),
];

export const PERFIL_EJEMPLO: PerfilInstitucional = {
  id: "ejemplo-referencia",
  nombre: "Caso de referencia — estudio universitario por cursos-horario",
  siglas: "Ejemplo",
  esEjemplo: true,
  etiquetaUnidad: "facultad",
  etiquetasSexo: ["Mujeres", "Hombres"],
  anio: 2026,
  etapa: "propuesta",
  fuenteData: "data del periodo anterior (caso de referencia)",
  modeloDatos: {
    bases: 2,
    descripcion: "Dos bases relacionadas (estudiantes + cursos-horario) unidas por la llave curso-horario.",
    llaveCruce: "curso-horario",
    riesgo: "Reconciliar los conteos entre ambas bases al cruzarlas.",
  },
  facultades: UNIDADES_EJEMPLO,
  universo: 29090,
  embudoAlumno: [
    { id: "universo", label: "Todos los matriculados", conteo: 29090, porQue: "Base cruda: incluye todos los niveles formativos y condiciones.", sello: "verificado" },
    { id: "pregrado", label: "+ Pregrado", conteo: 25162, porQue: "Excluye posgrado, diplomados y segundas especialidades.", sello: "verificado" },
    { id: "regular", label: "+ Matrícula regular", conteo: 23242, porQue: "Excluye bajas, retiros y condiciones especiales.", sello: "verificado" },
    { id: "mayor-edad", label: "+ Edad ≥ 18", conteo: 21365, porQue: "Excluye menores de edad. El resultado es la población objetivo (N).", sello: "oficial" },
  ],
  aulasTotales: 5262,
  embudoAula: [
    { id: "total", label: "Cursos-horario únicos", conteo: 5262, porQue: "La base cruda trae varias filas por curso-horario (docentes, carreras); se colapsa a una fila por unidad.", sello: "verificado" },
    { id: "presencial", label: "+ Presencial", conteo: 4624, porQue: "Excluye 638 secciones no presenciales.", sello: "verificado" },
    { id: "tipo", label: "+ Tipo válido", conteo: 3902, porQue: "Excluye 722: seminarios, tesis, asesorías, prácticas.", sello: "verificado" },
    { id: "elegibles", label: "+ ≥ 10 elegibles", conteo: 3032, porQue: "Excluye 870 cursos-horario bajo el umbral de elegibles — el filtro de mayor efecto.", sello: "verificado" },
    { id: "docente", label: "+ Docente estable", conteo: 2961, porQue: "Excluye 71 cursos-horario sin docente contratado u ordinario.", sello: "verificado" },
    { id: "nivel", label: "+ Nivel por unidad", conteo: 2483, porQue: "Excluye 478 cursos-horario fuera del rango de nivel de su unidad. El resultado es el marco muestral.", sello: "verificado" },
  ],
  marcoAulas: 2483,
  criteriosAlumno: CRITERIOS_ALUMNO.map((c) => ({ ...c })),
  criteriosAula: CRITERIOS_AULA.map((c) => {
    if (c.id === "min-elegibles") return { ...c, regla: "matriculados_población ≥ 10 (elegibles, no total)" };
    if (c.id === "tipo-curso") {
      return { ...c, excepciones: "En este caso, la unidad de arte admite talleres y cursos artísticos: allí son la enseñanza principal." };
    }
    if (c.id === "c7") {
      return { ...c, impactoActivar: { aulas: 2056, coberturaPct: 0.86, facultadesRotas: [] } };
    }
    if (c.id === "c8") {
      return { ...c, impactoActivar: { aulas: 799, coberturaPct: 0.49, facultadesRotas: ["Educación", "Letras y Ciencias Humanas"] } };
    }
    return { ...c };
  }),
  mapaNivelPorFacultad: {
    "arquitectura": [{ min: 2, max: 10 }],
    "arte-diseno": [{ min: 2, max: 10 }],
    "artes-escenicas": [{ min: 2, max: 10 }],
    "educacion": [{ min: 2, max: 10 }],
    "gastronomia": [{ min: 2, max: 10 }],
    "contables": [{ min: 5, max: 10 }],
    "ciencias-ingenieria": [{ min: 5, max: 10 }],
    "ciencias-sociales": [{ min: 5, max: 10 }],
    "comunicacion": [{ min: 5, max: 10 }],
    "derecho": [{ min: 5, max: 10 }],
    "gestion": [{ min: 5, max: 10 }],
    "letras-ch": [{ min: 5, max: 10 }],
    "psicologia": [{ min: 5, max: 10 }],
    "generales-ciencias": [{ min: 2, max: 4 }],
    "generales-letras": [{ min: 0, max: 0 }],
  },
  parametros: {
    confianza: 0.95,
    margenError: 0.0247,
    proporcion: 0.3,
    deff: 2,
    factorSobremuestra: 1.5,
    nDiseno: 2500,
  },
  escenario2: {
    escalones: ESCENARIO2_BASE.escalones.map((e) => ({ ...e })),
    deff: 1.5,
    factorSobremuestra: 1.2,
    proporcionFallback: 0.3,
    // La suma de filas oficiales da 4,049; el diseño comunica 4,050 (cuadratura).
    totalDiseno: 4050,
    sobremuestraOficial: 4865,
    tablaOficial: {
      "arquitectura": { n: 373, W: 0.549, aulas: 23 },
      "arte-diseno": { n: 418, W: 0.463, aulas: 34 },
      "artes-escenicas": { n: 230, W: 0.486, aulas: 26 },
      "contables": { n: 52, W: 0.667, aulas: 3 },
      "ciencias-ingenieria": { n: 354, W: 2.416, aulas: 17 },
      "ciencias-sociales": { n: 443, W: 0.551, aulas: 25 },
      "comunicacion": { n: 233, W: 0.677, aulas: 14 },
      "derecho": { n: 511, W: 1.101, aulas: 23 },
      "educacion": { n: 70, W: 0.533, aulas: 6 },
      "generales-ciencias": { n: 346, W: 1.838, aulas: 13 },
      "generales-letras": { n: 441, W: 1.429, aulas: 15 },
      "gastronomia": { n: 59, W: 0.411, aulas: 5 },
      "gestion": { n: 212, W: 0.881, aulas: 10 },
      "letras-ch": { n: 68, W: 0.627, aulas: 9 },
      "psicologia": { n: 239, W: 0.534, aulas: 12 },
    },
  },
  resumenEstAula: "min_mediana_media",
  bolsaOpciones: [0, 1, 2],
  bolsaSugerida: 1,
  notas: [
    "Cobertura del cruce: 19,711 de 21,365 elegibles alcanzables (92.3%); factibilidad verificada en las 15 unidades.",
    "Referencia de campo del caso: 194 cursos-horario aplicados sobre 170 previstos (+14%) — sustento de la bolsa operativa.",
  ],
};

export const PERFILES: PerfilInstitucional[] = [PLANTILLA_UNIVERSIDAD, PLANTILLA_ESCUELA, PERFIL_EJEMPLO];

export function perfilPorId(id: string): PerfilInstitucional | null {
  return PERFILES.find((p) => p.id === id) ?? null;
}
