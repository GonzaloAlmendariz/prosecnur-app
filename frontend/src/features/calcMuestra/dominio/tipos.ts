/**
 * Capa de dominio del motor muestral — TIPOS.
 *
 * Modela el método de muestreo por aulas de forma parametrizable: todo lo que
 * en un caso concreto es un valor (criterios, umbrales, mapa de niveles por
 * unidad, parámetros, escalones del escenario 2, modelo de datos) aquí es
 * configuración, de modo que el mismo motor sirve para cualquier institución
 * educativa y cualquier proyecto con aplicación en aulas.
 *
 * Fuente de verdad del método: documentación metodológica del caso de
 * referencia. La capa visual (motor/) consume estos tipos; nunca al revés.
 */

/** Estado de confiabilidad de una cifra, según la leyenda de la documentación. */
export type SelloCifra = "oficial" | "verificado" | "resumen" | "corregido";

/** Etapa del estudio: con qué data se calcula lo que se muestra. */
export type EtapaEstudio = "propuesta" | "campo";

/**
 * Datos poblacionales de una unidad académica (facultad, escuela o grado).
 * `mujeres`/`hombres` son los dos segmentos de sexo del diseño; sus etiquetas
 * visibles viven en `PerfilInstitucional.etiquetasSexo`.
 */
export type FacultadDatos = {
  id: string;
  nombre: string;
  /** Población objetivo (elegibles) de la unidad. */
  N: number;
  mujeres: number;
  hombres: number;
  /** Mediana de matriculados_población por aula, en el marco depurado. */
  estAulaMediana: number | null;
  /** Media de matriculados_población por aula, en el marco depurado. */
  estAulaMedia: number | null;
  /**
   * Cota inferior del IC 95% (percentil 2.5%) del bootstrap de la media de
   * matriculados_población por aula. NA (null) si la facultad tiene <15
   * curso-horario: el bootstrap no da un intervalo fiable con tan pocas aulas.
   */
  estAulaLo95: number | null;
  /** Cota superior del IC 95% (percentil 97.5%) del mismo bootstrap; null igual. */
  estAulaHi95: number | null;
  /** Nº de curso-horario de la facultad en el marco (tamaño del bootstrap). */
  estAulaNCh: number | null;
  /** Elegibles alcanzables por el marco de aulas (cruce), si se conoce. */
  alcanzables: number | null;
  /** Proporción de éxito observada (prevalencia) para el escenario 2. */
  pExito: number | null;
};

/** Un peldaño de un embudo (universo → … → resultado). */
export type EmbudoPaso = {
  id: string;
  /** Etiqueta corta del filtro aplicado en este paso ("+ Pregrado"). */
  label: string;
  /** Conteo que queda DESPUÉS de aplicar el filtro. */
  conteo: number;
  /** Explicación llana de qué hace el filtro y por qué. */
  porQue: string;
  sello?: SelloCifra;
};

/** Dónde se aplica un criterio de alumno (las 3 capas del método). */
export type CapaCriterio = "marco" | "instrumento" | "procesamiento";

/** Criterio de inclusión sobre el ESTUDIANTE. */
export type CriterioAlumno = {
  id: string;
  etiqueta: string;
  /** Qué incluye / qué excluye, en llano. */
  incluye: string;
  excluye: string;
  /** Variable de la base que lo hace posible. */
  variable: string;
  /** Capa donde se aplica (la clave didáctica: ciclo 1 va al instrumento). */
  capa: CapaCriterio;
  /**
   * Rol dentro del método: "filtro" define la población; "estratifica" no
   * excluye a nadie (facultad); "confirmacion" se verifica en campo.
   */
  rol: "filtro" | "estratifica" | "confirmacion";
  porQue: string;
};

/** Criterio de inclusión sobre el AULA (curso-horario). */
export type CriterioAula = {
  id: string;
  etiqueta: string;
  regla: string;
  variable: string;
  /** Los 5 base siempre aplican; los opcionales (c7/c8) se activan a decisión. */
  tipo: "base" | "opcional";
  porQue: string;
  /** Excepciones por facultad (ej. taller/artístico solo en Arte y Diseño). */
  excepciones?: string;
  /**
   * Impacto medido de ACTIVAR un criterio opcional sobre el marco base:
   * aulas restantes, cobertura resultante y facultades cuya cuota se rompe.
   */
  impactoActivar?: {
    aulas: number;
    coberturaPct: number;
    facultadesRotas: string[];
  };
};

/** Rango de nivel del curso admitido para una facultad (mapa nivel-por-facultad). */
export type RangoNivel = { min: number; max: number };

/** Parámetros del cálculo de muestra (escenario global). */
export type ParametrosMuestra = {
  /** Nivel de confianza en (0,1), ej. 0.95. */
  confianza: number;
  /** Margen de error en (0,1), ej. 0.0247. */
  margenError: number;
  /** Proporción esperada del fenómeno, ej. 0.30. */
  proporcion: number;
  /** Efecto de diseño por conglomerados, ej. 2.0. */
  deff: number;
  /** Factor de sobremuestra sobre n (1.5 = +50%). */
  factorSobremuestra: number;
  /**
   * Cifra de diseño: n fijado operativamente (redondeo conservador del
   * despeje). Si es null, se usa el n calculado tal cual.
   */
  nDiseno: number | null;
};

/** Escalón del escenario 2: parámetros según el tamaño de la facultad. */
export type EscalonE2 = {
  /** Población mínima (inclusive) para caer en este escalón. */
  nDesde: number;
  confianza: number;
  margenError: number;
};

/** Configuración del escenario 2 (cada facultad como estrato propio). */
export type ConfigEscenario2 = {
  escalones: EscalonE2[];
  deff: number;
  factorSobremuestra: number;
  /** p por defecto si la facultad no tiene prevalencia observada. */
  proporcionFallback: number;
  /**
   * Cifra de diseño del total E2 (ej. 4,050): la suma de las filas oficiales
   * puede quedar 1 abajo por el redondeo (misma cuadratura que el E1).
   */
  totalDiseno: number | null;
  /** Sobremuestra oficial del diseño (ej. 4,865), si difiere del recomputado. */
  sobremuestraOficial: number | null;
  /**
   * Tabla oficial del diseño (si existe): n, W y aulas por facultad. El motor
   * también recomputa con la fórmula; la UI muestra ambos (cifra de diseño
   * vs despeje), igual que 2,500 vs 2,353 en el escenario 1.
   */
  tablaOficial: Record<string, { n: number; W: number | null; aulas: number | null }> | null;
};

/**
 * Cómo se resume "estudiantes por aula" (el divisor del cálculo de aulas):
 *  - "min_mediana_media": heurístico conservador mín(mediana, media),
 *  - "media" / "mediana": punto simple,
 *  - "li_bootstrap": cota inferior del IC 95% del bootstrap de la media (más
 *    conservador aún ⇒ divisor menor ⇒ más aulas). Con <15 CH el bootstrap no
 *    es fiable (estAulaLo95 es null) y el motor cae a mín(mediana, media).
 */
export type ResumenEstAula = "min_mediana_media" | "media" | "mediana" | "li_bootstrap";

/** Modelo de datos que entrega la institución. */
export type ModeloDatos = {
  /** 1 = base plana (UNSA/UNSAAC) · 2 = estudiantes + cursos-horario (PUCP). */
  bases: 1 | 2;
  descripcion: string;
  /** Llave de cruce cuando hay dos bases. */
  llaveCruce: string | null;
  /** Riesgo principal de ese formato (didáctico). */
  riesgo: string;
};

/**
 * Perfil institucional: TODO lo que el método necesita saber de una
 * institución. El motor completo es función de este objeto. Ningún perfil
 * con datos de un caso concreto se muestra sin `esEjemplo: true`.
 */
export type PerfilInstitucional = {
  id: string;
  nombre: string;
  siglas: string;
  /** true si los datos provienen del caso de referencia (no de un proyecto). */
  esEjemplo: boolean;
  /** Nombre de la unidad de estratificación: "facultad", "escuela", "grado". */
  etiquetaUnidad: string;
  /** Etiquetas visibles de los dos segmentos de sexo [A, B]. */
  etiquetasSexo: [string, string];
  anio: number;
  etapa: EtapaEstudio;
  /** Con qué data se calculó (ej. "data 2025-2"). */
  fuenteData: string;
  modeloDatos: ModeloDatos;
  facultades: FacultadDatos[];
  /** Universo bruto (todos los matriculados) si se conoce. */
  universo: number | null;
  /** Embudo de alumno medido sobre la base (si existe). */
  embudoAlumno: EmbudoPaso[] | null;
  /** Total de curso-horario únicos de la base (si se conoce). */
  aulasTotales: number | null;
  /** Embudo de aula medido sobre la base (si existe). */
  embudoAula: EmbudoPaso[] | null;
  /** Aulas del marco depurado (resultado del embudo de aula). */
  marcoAulas: number | null;
  criteriosAlumno: CriterioAlumno[];
  criteriosAula: CriterioAula[];
  mapaNivelPorFacultad: Record<string, RangoNivel[]> | null;
  parametros: ParametrosMuestra;
  escenario2: ConfigEscenario2 | null;
  resumenEstAula: ResumenEstAula;
  /** Opciones de bolsa operativa: aulas extra por facultad (ej. [0, 1, 2]). */
  bolsaOpciones: number[];
  /** Opción de bolsa sugerida (índice en bolsaOpciones). */
  bolsaSugerida: number;
  /** Notas de método específicas del perfil. */
  notas: string[];
};

/** Base de cálculo del nº de cursos-horario por facultad (§5.3). */
export type BaseCursosHorario = "total" | "elegible";

/** Decisiones del usuario sobre el perfil (lo editable del recorrido). */
export type DecisionesRecorrido = {
  parametros: ParametrosMuestra;
  /** Criterios de aula opcionales activados (ids, ej. ["c7"]). */
  opcionalesActivos: string[];
  /** Aulas extra por facultad elegidas para la bolsa. */
  bolsaExtraPorFacultad: number;
  /** Escenario elegido para la síntesis final. */
  escenario: "e1" | "e2";
  /**
   * Agregado operacional de la pestaña «Cursos-horario por facultad»: cursos-horario
   * extra (0, 1 o 2) a añadir a cada facultad, indexado por NOMBRE de facultad.
   * Persistido en el motor_recorrido (passthrough opaco del workspace, sin
   * whitelist backend). Clave = nombre tal como aparece en el marco.
   */
  aulasExtraPorFacultad: Record<string, number>;
  /** Base sobre la que se contextualizan los cursos-horario del marco (§5.3.d). */
  cursosHorarioBase: BaseCursosHorario;
  /** true si el usuario confirmó el plan definitivo de cursos-horario por facultad (§5.3.f). */
  cursosHorarioConfirmado: boolean;
  /**
   * Plan definitivo confirmado: cursos-horario finales por facultad (nombre → CH).
   * Fuente única que consume el gráfico rediseñado de Distribución (§5.4).
   */
  cursosHorarioFinal: Record<string, number>;
};

/** Una celda de la afijación: cuota de una facultad desglosada por sexo. */
export type CuotaFacultad = {
  facultadId: string;
  nombre: string;
  N: number;
  n: number;
  nMujeres: number;
  nHombres: number;
  /** Ajuste de cuadratura recibido (0 si no le tocó). */
  ajuste: number;
  sobremuestra: number;
  estAula: number | null;
  aulas: number | null;
};

/** Traza del ajuste de cuadratura (para enseñarlo, no solo aplicarlo). */
export type TrazaCuadratura = {
  sumaRedondeada: number;
  objetivo: number;
  faltante: number;
  facultadAjustada: string | null;
  sexoAjustado: "mujeres" | "hombres" | null;
};

/** Resultado integral del escenario 1 para un perfil + decisiones. */
export type ResultadoEscenario1 = {
  N: number;
  /** n que despeja la fórmula (con los parámetros dados). */
  nFormula: number;
  /** n efectivo usado (cifra de diseño si existe; si no, nFormula). */
  nDiseno: number;
  /** Margen de error implícito del n efectivo. */
  errorImplicito: number | null;
  cuotas: CuotaFacultad[];
  cuadratura: TrazaCuadratura;
  totalMujeres: number;
  totalHombres: number;
  sobremuestraTotal: number;
  aulasBase: number;
  /** Total de aulas con la bolsa elegida. */
  aulasConBolsa: number;
};

/** Resultado del escenario 2 por facultad. */
export type FilaEscenario2 = {
  facultadId: string;
  nombre: string;
  N: number;
  p: number;
  confianza: number;
  margenError: number;
  /** n recomputado con la fórmula. */
  nFormula: number;
  /** n de la tabla oficial (si el perfil la trae). */
  nOficial: number | null;
  W: number | null;
  aulasOficial: number | null;
};

export type ResultadoEscenario2 = {
  filas: FilaEscenario2[];
  totalFormula: number;
  /** Suma de las filas oficiales (puede diferir en 1 de la cifra de diseño). */
  totalOficial: number | null;
  /** Cifra de diseño del total (la que se comunica, ej. 4,050). */
  totalDiseno: number | null;
  aulasOficial: number | null;
  sobremuestraTotal: number;
};

/** Cobertura del cruce alumno × aula, por facultad. */
export type FilaCobertura = {
  facultadId: string;
  nombre: string;
  elegibles: number;
  alcanzables: number | null;
  pct: number | null;
  sobremuestra: number;
  factible: boolean | null;
};
