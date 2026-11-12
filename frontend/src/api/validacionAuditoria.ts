// validacionAuditoria.ts — la auditoría de Validación y lo que el motor de
// Hallazgos publica desde la Corrección 15-M (contrato
// CONTRATO_VALIDACION_M2.md, secciones 0 a 5; commit 89138df13).
//
// Cuatro rutas que el frontend no tenía:
//   POST /api/validacion/v2/auditoria            corre la auditoría (un job)
//   GET  /api/validacion/v2/auditoria/estado     si las reglas cambiaron desde la última
//   POST /api/validacion/v2/reglas_custom/probar cuántos casos marcaría una regla sin guardarla
//   GET  /api/validacion/v2/caso?id=             el caso completo de la última auditoría
//
// y los normalizadores de los campos nuevos de `GET /limpieza` y del detalle
// de una regla (`POST /instrumento/regla`): `cifras_hallazgos` con su grano,
// `identificacion_casos`, `aplicable` y `motivo_no_aplicable` por decisión,
// los avisos y las filas nuevas de la vista previa, `esperado`,
// `coincide_con` y `case_ids`.
//
// Del motor de Hallazgos (M4, CONTRATO_VALIDACION_M4.md; commit f734c42ae):
//   POST /api/validacion/v2/limpieza/decision/efecto  el efecto previsto de un borrador
// y los normalizadores de la narrativa única por regla (cola, detalle, caso),
// de a qué casos llega una decisión (`seguimiento`, `casos_nuevos`...), del
// contexto de cada caso en el detalle y de los campos nuevos del caso
// completo. El catálogo de reglas se vuelve a leer aquí solo para tomar sus
// `limites`, que su normalizador (validacionCatalogo.ts) no lee.
//
// Plumber escribe un escalar como vector de largo uno, una lista de uno como
// objeto suelto, `NULL` como `{}` y `NA` como `null` o "NA". Los
// normalizadores aceptan esas formas y devuelven `null` donde el motor no dio
// el dato: una cifra ausente no se vuelve 0, porque un 0 se lee como "no hay".

import { apiFetch, handle, headers } from "./core";
import { booleano, enteroONulo, escalar, lista, numeroONulo, registro, texto } from "./normalizarR";
import { normalizarCatalogoCompleto, type CatalogoCompleto, type OrigenDeRegla, type PiezaDelCatalogo } from "./validacionCatalogo";

function encabezados(baseNombre?: string | null, extra: Record<string, string> = {}): Record<string, string> {
  const h = headers(extra);
  if (baseNombre) h["X-Base-Nombre"] = baseNombre;
  return h;
}

function textoONulo(value: unknown): string | null {
  const v = escalar(value);
  if (v === "NA") return null;
  const t = texto(v);
  return t ? t : null;
}

function textos(value: unknown): string[] {
  const v = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  return v.map((x) => textoONulo(x)).filter((x): x is string => x !== null);
}

function vacio(value: unknown): boolean {
  const v = escalar(value);
  if (v === null || v === undefined || v === "NA") return true;
  if (Array.isArray(v)) return v.length === 0;
  return typeof v === "object" && Object.keys(v as object).length === 0;
}

// --- Cifras de Hallazgos -----------------------------------------------------

/** Nivel de una tabla de la auditoría: la principal cuenta encuestados; una hija, registros. */
export type NivelDeTabla = "encuestado" | "registro";

export type CifrasHallazgosPorTabla = {
  tabla: string;
  nivel: NivelDeTabla;
  /** Filas de la tabla. */
  n_registros: number | null;
  /** Pares (registro, regla) marcados en la tabla. */
  n_hallazgos: number | null;
  /** Registros distintos con al menos un hallazgo, sobre `n_registros`. */
  n_registros_con_hallazgos: number | null;
  /** Esos registros llevados a su encuestado de la principal. */
  n_encuestados_con_hallazgos: number | null;
  /** Registros con hallazgos que no se llevan a un encuestado. Nunca se suman a los encuestados. */
  n_registros_sin_encuestado: number | null;
};

/**
 * Cifras de la última auditoría de la base, con su grano (contrato M2,
 * `cifras_hallazgos`). "Hallazgos" son pares (fila, regla); "casos con
 * hallazgos" son encuestados de la tabla principal, sobre `n_casos_evaluados`.
 * El campo de compatibilidad `n_casos_con_hallazgos` no se expone: mezcla
 * grano cuando una hija no trae el id del envío.
 */
export type CifrasHallazgos = {
  n_hallazgos: number | null;
  /** Con 0, la pantalla dice "No hay reglas evaluadas" y no "0 casos con hallazgos". */
  n_reglas_evaluadas: number;
  n_reglas_con_casos: number | null;
  /** Filas de la tabla principal auditada: la base de `n_encuestados_con_hallazgos`. */
  n_casos_evaluados: number | null;
  n_encuestados_con_hallazgos: number | null;
  n_registros_sin_encuestado: number | null;
  por_tabla: CifrasHallazgosPorTabla[];
};

function porTabla(value: unknown): CifrasHallazgosPorTabla[] {
  return lista(value)
    .map((fila): CifrasHallazgosPorTabla | null => {
      const tabla = textoONulo(fila.tabla);
      if (!tabla) return null;
      const nivelCrudo = texto(fila.nivel);
      const nivel: NivelDeTabla =
        nivelCrudo === "encuestado" || nivelCrudo === "registro"
          ? nivelCrudo
          : tabla === "principal"
            ? "encuestado"
            : "registro";
      return {
        tabla,
        nivel,
        n_registros: enteroONulo(fila.n_registros),
        n_hallazgos: enteroONulo(fila.n_hallazgos),
        n_registros_con_hallazgos: enteroONulo(fila.n_registros_con_hallazgos),
        n_encuestados_con_hallazgos: enteroONulo(fila.n_encuestados_con_hallazgos),
        n_registros_sin_encuestado: enteroONulo(fila.n_registros_sin_encuestado),
      };
    })
    .filter((fila): fila is CifrasHallazgosPorTabla => fila !== null);
}

/** `null` sin auditoría o si el motor no publicó cuántas reglas evaluó. */
export function normalizarCifrasHallazgos(value: unknown): CifrasHallazgos | null {
  if (vacio(value)) return null;
  const r = registro(escalar(value));
  const nReglas = enteroONulo(r.n_reglas_evaluadas);
  if (nReglas === null) return null;
  return {
    n_hallazgos: enteroONulo(r.n_hallazgos),
    n_reglas_evaluadas: nReglas,
    n_reglas_con_casos: enteroONulo(r.n_reglas_con_casos),
    n_casos_evaluados: enteroONulo(r.n_casos_evaluados),
    n_encuestados_con_hallazgos: enteroONulo(r.n_encuestados_con_hallazgos),
    n_registros_sin_encuestado: enteroONulo(r.n_registros_sin_encuestado),
    por_tabla: porTabla(r.por_tabla),
  };
}

// --- Cómo se identifican los casos -------------------------------------------

/**
 * `columna_candidata`: por una columna de identidad; `numero_fila`: por su
 * número de fila ("Los casos se identifican por su número de fila");
 * `anterior`: solo en una decisión, el método con que se resolvieron sus casos.
 */
export type MetodoDeIdentificacion = "columna_candidata" | "numero_fila" | "anterior";

export type IdentificacionCasos = {
  metodo: MetodoDeIdentificacion;
  /** Con `columna_candidata`, la columna; con `numero_fila`, `_index` si lo hay. */
  columna: string | null;
  n_filas: number | null;
  /** Filas sin valor en la columna candidata, que se identifican por su número de fila. */
  n_filas_sin_llave: number | null;
};

const METODOS: readonly MetodoDeIdentificacion[] = ["columna_candidata", "numero_fila", "anterior"];

/** `null` sin auditoría o con un método que el contrato no conoce. */
export function normalizarIdentificacionCasos(value: unknown): IdentificacionCasos | null {
  if (vacio(value)) return null;
  const r = registro(escalar(value));
  const metodo = texto(r.metodo);
  if (!(METODOS as readonly string[]).includes(metodo)) return null;
  return {
    metodo: metodo as MetodoDeIdentificacion,
    columna: textoONulo(r.columna),
    n_filas: enteroONulo(r.n_filas),
    n_filas_sin_llave: enteroONulo(r.n_filas_sin_llave),
  };
}

// --- Decisiones: si se aplican -----------------------------------------------

/**
 * Por qué una decisión no llega a ninguna fila de la tabla principal auditada.
 * `llave_declarada` reúne los `llave_*`, que solo salen con la llave de caso
 * declarada encendida; `otro`, un código que el contrato no conoce (se
 * conserva el crudo en `motivo_crudo`).
 */
export type MotivoNoAplicable =
  | "columna_ausente"
  | "numeracion_anterior"
  | "auditoria_sin_fila_de_origen"
  | "regla_sin_casos"
  | "sin_filas_en_principal"
  | "sin_casos_al_decidir"
  | "llave_declarada"
  | "otro";

const MOTIVOS: readonly MotivoNoAplicable[] = [
  "columna_ausente",
  "numeracion_anterior",
  "auditoria_sin_fila_de_origen",
  "regla_sin_casos",
  "sin_filas_en_principal",
  "sin_casos_al_decidir",
];

/**
 * La causa en llano de que una decisión no se aplique, para escribir después
 * de "No se aplica porque". Los mismos textos que el motor
 * (`.limpieza_texto_no_aplicable`, limpieza_decision_engine.R), que solo los
 * publica en el efecto previsto (`texto_no_aplicable`); en `decision_draft`
 * llega el código.
 */
const TEXTO_DE_MOTIVO: Record<MotivoNoAplicable, string> = {
  columna_ausente: "la columna que identifica los casos ya no está en la base",
  numeracion_anterior:
    "sus casos se guardaron por número de fila contando solo los casos válidos, y esa numeración ya no coincide con la de la base recibida",
  auditoria_sin_fila_de_origen:
    "la última auditoría no conserva el número de fila de la base recibida; vuelve a correr la auditoría",
  regla_sin_casos: "la regla ya no marca casos en la última auditoría",
  sin_filas_en_principal: "sus casos no corresponden a ninguna fila de la tabla principal",
  sin_casos_al_decidir: "la regla no marcaba casos cuando se dio por lista",
  llave_declarada: "la llave que identifica los casos ya no sirve",
  otro: "el método con que se identificaron sus casos ya no sirve",
};

const TEXTO_DE_LLAVE: Record<string, string> = {
  llave_repetida: "la llave que identifica los casos repite valores",
  llave_con_vacios: "la llave que identifica los casos tiene filas sin valor",
  llave_ausente: "la llave que identifica los casos ya no está en la base",
};

/** La causa de un motivo; con `llave_*` usa el código crudo, que dice cuál de las tres. */
export function textoDeMotivoNoAplicable(motivo: MotivoNoAplicable, crudo?: string | null): string {
  if (motivo === "llave_declarada" && crudo && TEXTO_DE_LLAVE[crudo]) return TEXTO_DE_LLAVE[crudo];
  return TEXTO_DE_MOTIVO[motivo];
}

export type AplicabilidadDecision = {
  /** `true` si llega al menos a una fila; `false` si a ninguna; `null` si la base no tiene auditoría. */
  aplicable: boolean | null;
  motivo_no_aplicable: MotivoNoAplicable | null;
  motivo_crudo: string | null;
  /** Los casos que la regla marcaba cuando la decisión pasó a lista (solo registro). */
  target_case_ids_resueltos: string[];
  casos_resueltos_en: string | null;
  identificacion_casos: IdentificacionCasos | null;
};

function aplicableONulo(value: unknown): boolean | null {
  const v = escalar(value);
  if (v === true || v === "TRUE" || v === "true" || v === 1) return true;
  if (v === false || v === "FALSE" || v === "false" || v === 0) return false;
  return null;
}

function motivo(value: unknown): MotivoNoAplicable | null {
  const crudo = textoONulo(value);
  if (!crudo) return null;
  if ((MOTIVOS as readonly string[]).includes(crudo)) return crudo as MotivoNoAplicable;
  if (crudo.startsWith("llave_")) return "llave_declarada";
  return "otro";
}

// --- Decisiones: a qué casos llegan (contrato M4, sección 3) -----------------

/**
 * `congelada`: cambia datos y se aplica a la lista que la regla marcaba al
 * darla por lista; `sigue_a_la_regla`: ignorar, cubre lo que marque la última
 * auditoría; `casos_elegidos`: nombra sus casos; `por_congelar`: borrador que
 * cambia datos y se congela al pasar a lista; `sin_registro`: lista anterior
 * al registro, sigue a la auditoría.
 */
export type SeguimientoDecision = "congelada" | "sigue_a_la_regla" | "casos_elegidos" | "por_congelar" | "sin_registro";

const SEGUIMIENTOS: readonly SeguimientoDecision[] = ["congelada", "sigue_a_la_regla", "casos_elegidos", "por_congelar", "sin_registro"];

/** D-F3: una decisión sobre una regla de grupo repetido llega al encuestado entero. */
export type AlcanceDecision = "caso" | "encuestado";

export type SeguimientoDeDecision = {
  /** `null` si el motor no lo publicó (anterior a M4). */
  seguimiento: SeguimientoDecision | null;
  /** Casos de la lista al decidir; `null` sin lista. */
  n_casos_al_decidir: number | null;
  /** Solo en las congeladas: los que la regla marca hoy y no están en la lista. `null` en las demás. */
  casos_nuevos: string[] | null;
  /** Casos de la lista que la regla ya no marca; siguen en ella. */
  casos_que_ya_no_marca: string[];
  /** Casos distintos de la tabla principal a los que llega hoy. */
  n_casos_aplicados: number | null;
  alcance: AlcanceDecision | null;
};

function seguimientoLeido(value: unknown): SeguimientoDecision | null {
  const t = texto(value);
  return (SEGUIMIENTOS as readonly string[]).includes(t) ? (t as SeguimientoDecision) : null;
}

function alcanceLeido(value: unknown): AlcanceDecision | null {
  const t = texto(value);
  return t === "caso" || t === "encuestado" ? t : null;
}

/** `casos_nuevos` es `null` fuera de las congeladas: `null` y `[]` no son lo mismo. */
function textosONulo(value: unknown): string[] | null {
  if (value === null || value === undefined || value === "NA") return null;
  return textos(value);
}

/** Lo que el motor calcula al responder sobre una decisión (M4): no se guarda. */
export function normalizarSeguimiento(decision: unknown): SeguimientoDeDecision {
  const r = registro(decision);
  return {
    seguimiento: seguimientoLeido(r.seguimiento),
    n_casos_al_decidir: enteroONulo(r.n_casos_al_decidir),
    casos_nuevos: textosONulo(r.casos_nuevos),
    casos_que_ya_no_marca: textos(r.casos_que_ya_no_marca),
    n_casos_aplicados: enteroONulo(r.n_casos_aplicados),
    alcance: alcanceLeido(r.alcance),
  };
}

/** Lo que el motor calcula al responder sobre una decisión de `decision_draft` (no se guarda). */
export function normalizarAplicabilidad(decision: unknown): AplicabilidadDecision {
  const r = registro(decision);
  const aplicable = aplicableONulo(r.aplicable);
  // Una decisión aplicable no tiene motivo, aunque el motor mande uno.
  const motivoNormalizado = aplicable === false ? motivo(r.motivo_no_aplicable) : null;
  return {
    aplicable,
    motivo_no_aplicable: motivoNormalizado,
    motivo_crudo: motivoNormalizado ? textoONulo(r.motivo_no_aplicable) : null,
    target_case_ids_resueltos: textos(r.target_case_ids_resueltos),
    casos_resueltos_en: textoONulo(r.casos_resueltos_en),
    identificacion_casos: normalizarIdentificacionCasos(r.identificacion_casos),
  };
}

// --- Vista previa de la limpieza ---------------------------------------------

export type LadoDeVistaPrevia = {
  /** Filas de la base que se limpia (antes) o de la base limpia (después). */
  filas_base: number | null;
  /** Filas dentro del universo: la tabla principal auditada (antes) o la base limpia (después). */
  filas_evaluadas: number | null;
  /** Las que el caso válido deja fuera; siguen en la base limpia. */
  filas_fuera_universo: number | null;
  total_inconsistencias: number | null;
  reglas_con_casos: number | null;
  reglas_total: number | null;
};

export type VistaPreviaLimpieza = {
  before: LadoDeVistaPrevia;
  after: LadoDeVistaPrevia;
  /** Filas que de verdad salen de la base. */
  casos_excluidos: number | null;
  decisiones_listas: number | null;
  /** Avisos de la aplicación: una decisión que no se aplica, y por qué. */
  warnings: string[];
  error: string | null;
};

function lado(value: unknown): LadoDeVistaPrevia {
  const r = registro(escalar(value));
  return {
    filas_base: enteroONulo(r.filas_base),
    filas_evaluadas: enteroONulo(r.filas_evaluadas),
    filas_fuera_universo: enteroONulo(r.filas_fuera_universo),
    total_inconsistencias: enteroONulo(r.total_inconsistencias),
    reglas_con_casos: enteroONulo(r.reglas_con_casos),
    reglas_total: enteroONulo(r.reglas_total),
  };
}

/** `before_after_preview` de `GET /limpieza` o de `GET /limpieza/preview`; `null` si no vino. */
export function normalizarVistaPrevia(value: unknown): VistaPreviaLimpieza | null {
  if (vacio(value)) return null;
  const r = registro(escalar(value));
  return {
    before: lado(r.before),
    after: lado(r.after),
    casos_excluidos: enteroONulo(registro(escalar(r.impact)).cases_excluded),
    decisiones_listas: enteroONulo(r.decisions_ready),
    warnings: textos(r.warnings),
    error: textoONulo(r.preview_error),
  };
}

// --- Detalle de una regla: ids, lo esperado y las parejas --------------------

/**
 * Los ids de caso del detalle de una regla, en el orden de `casos`. Un id
 * `null` es una fila que el motor no pudo ubicar: no se le inventa uno, y esa
 * fila no se puede elegir para una decisión caso por caso.
 */
export function normalizarCaseIds(value: unknown): Array<string | null> {
  if (value === null || value === undefined) return [];
  const v = Array.isArray(value) ? value : [value];
  return v.map((x) => textoONulo(x));
}

/**
 * El enunciado de una fila (`esperado[]`). `choque` es lo esperado y `hecho`
 * lo que respondió. Desde M4 `texto` sale con comillas rectas y sin punto
 * medio ("AUD-009: respondió "17" en Edad, que no cumple..."); con un motor
 * anterior traía comillas angulares, y por eso la pantalla arma la línea con
 * `hecho` y `choque`.
 */
export type EnunciadoEsperado = {
  anomalia_tipo: string | null;
  /** M4: `restriccion`, `rango`, `salto_debe`, `faltante`... (contrato M4, sección 2). */
  subtipo: string | null;
  sujeto: string | null;
  hecho: string | null;
  choque: string | null;
  accion: string | null;
  texto: string | null;
};

/** Mismo largo que `casos`; `null` por fila si la regla no tiene tipo de anomalía o la fila no se ubicó. */
export function normalizarEsperado(value: unknown, nCasos: number): Array<EnunciadoEsperado | null> {
  const v = Array.isArray(value) ? value : vacio(value) ? [] : [value];
  return Array.from({ length: Math.max(0, nCasos) }, (_, i) => {
    const fila = v[i];
    if (vacio(fila)) return null;
    const r = registro(escalar(fila));
    const enunciado: EnunciadoEsperado = {
      anomalia_tipo: textoONulo(r.anomalia_tipo),
      subtipo: textoONulo(r.subtipo),
      sujeto: textoONulo(r.sujeto),
      hecho: textoONulo(r.hecho),
      choque: textoONulo(r.choque),
      accion: textoONulo(r.accion),
      texto: textoONulo(r.texto),
    };
    return Object.values(enunciado).some((x) => x !== null) ? enunciado : null;
  });
}

export type CoincidenciaCasiIgual = {
  id_caso: string;
  /** `n_coincidencias / n_comparables`, de 0 a 1. */
  similitud: number | null;
  /** Preguntas de la regla que al menos uno de los dos respondió. */
  n_comparables: number | null;
  n_coincidencias: number | null;
};

function coincidencias(fila: unknown): CoincidenciaCasiIgual[] {
  const v = Array.isArray(fila) ? fila : [fila];
  return v
    .map(registro)
    .map((r): CoincidenciaCasiIgual | null => {
      const id = textoONulo(r.id_caso);
      if (!id) return null;
      return {
        id_caso: id,
        similitud: numeroONulo(r.similitud),
        n_comparables: enteroONulo(r.n_comparables),
        n_coincidencias: enteroONulo(r.n_coincidencias),
      };
    })
    .filter((x): x is CoincidenciaCasiIgual => x !== null);
}

/**
 * `coincide_con`: `null` si la regla no es de respuestas casi iguales. Si lo
 * es, una entrada por fila de `casos`: la lista de casos con que coincide, o
 * `null` si la fila está marcada y no se le encontró pareja. `null` y `[]` no
 * son lo mismo y no se confunden aquí.
 */
export function normalizarCoincideCon(value: unknown, nCasos: number): Array<CoincidenciaCasiIgual[] | null> | null {
  // Sin `escalar`: `[null]` es una fila marcada sin pareja, no la ausencia del campo.
  if (!Array.isArray(value)) return null;
  return Array.from({ length: Math.max(0, nCasos) }, (_, i) => {
    const fila = value[i];
    if (fila === null || fila === undefined || fila === "NA") return null;
    if (Array.isArray(fila) && fila.length === 0) return [];
    if (typeof fila !== "object") return null;
    return coincidencias(fila);
  });
}

// --- Una sola narrativa por regla (contrato M4, sección 1) -------------------

/** La clase del catálogo; con un motor anterior se deduce del `hallazgo_kind`. */
export type ClaseDeHallazgo = "inconsistencia" | "caso_a_revisar";

/** La clase de la regla: la del catálogo o, con un motor anterior, la del `hallazgo_kind`. */
export function claseDeHallazgo(clase: unknown, kind?: unknown): ClaseDeHallazgo | null {
  const c = texto(clase);
  if (c === "inconsistencia" || c === "caso_a_revisar") return c;
  const k = texto(kind) || c;
  if (k === "caso_validar") return "caso_a_revisar";
  if (k.startsWith("inconsistencia")) return "inconsistencia";
  return null;
}

const ORIGENES_DE_REGLA: readonly OrigenDeRegla[] = ["formulario", "operativo", "propia"];

/** Las piezas de una frase del catálogo (`[{texto} | {pregunta, etiqueta, tipo} | {valor, codigo}]`). */
export function normalizarFrase(value: unknown): PiezaDelCatalogo[] {
  const crudo = (v: unknown): string => {
    const x = escalar(v);
    return typeof x === "string" ? x : typeof x === "number" && Number.isFinite(x) ? String(x) : "";
  };
  return lista(value)
    .map((p): PiezaDelCatalogo | null => {
      const pregunta = texto(p.pregunta);
      if (pregunta) {
        const etiqueta = texto(p.etiqueta);
        const tipo = texto(p.tipo);
        return {
          tipo: "pregunta",
          codigo: pregunta,
          etiqueta: etiqueta && etiqueta !== pregunta ? etiqueta : null,
          tipoPregunta: tipo === "unica" || tipo === "multiple" || tipo === "numerica" ? tipo : "texto",
        };
      }
      if (p.valor !== undefined && p.valor !== null) return { tipo: "valor", valor: crudo(p.valor), codigo: textoONulo(p.codigo) };
      const t = crudo(p.texto);
      return t ? { tipo: "texto", texto: t } : null;
    })
    .filter((p): p is PiezaDelCatalogo => p !== null);
}

/**
 * Nombre, frase, clase, familia y severidad de una regla, como los publica el
 * catálogo de M3 en la cola, el detalle y el caso. Lo que el motor no dio
 * queda en `null` (con un motor anterior a M4, todo).
 */
export type NarrativaDeRegla = {
  nombre: string | null;
  frase: PiezaDelCatalogo[];
  frase_completa: boolean;
  clase: ClaseDeHallazgo | null;
  familia: string | null;
  familia_nombre: string | null;
  /** `formulario`, `operativo` o `propia`. En la cola, `origen` es otra cosa ("Automática"). */
  origen_regla: OrigenDeRegla | null;
  /** Una sola por regla, la que la regla declara; `null` si la regla no está ni en el plan ni en la auditoría. */
  severidad: string | null;
  /** `false` si la regla de la auditoría ya no está en el plan o el catálogo no se leyó. */
  en_catalogo: boolean | null;
  id_catalogo: string | null;
  /** El "Detalle" que el equipo escribió en la regla propia; `null` si no escribió ninguno. */
  detalle: string | null;
};

export function normalizarNarrativa(value: unknown, campoNombre: "nombre" | "nombre_regla" = "nombre"): NarrativaDeRegla {
  const r = registro(value);
  const origen = texto(r.origen_regla);
  return {
    nombre: textoONulo(r[campoNombre]),
    frase: normalizarFrase(r.frase),
    frase_completa: r.frase_completa === undefined || r.frase_completa === null ? true : booleano(r.frase_completa),
    clase: claseDeHallazgo(r.clase, r.hallazgo_kind),
    familia: textoONulo(r.familia),
    familia_nombre: textoONulo(r.familia_nombre),
    origen_regla: (ORIGENES_DE_REGLA as readonly string[]).includes(origen) ? (origen as OrigenDeRegla) : null,
    severidad: textoONulo(r.severidad),
    en_catalogo: aplicableONulo(r.en_catalogo),
    id_catalogo: textoONulo(r.id_catalogo),
    detalle: textoONulo(r.detalle),
  };
}

// --- Contexto de cada caso en el detalle (contrato M4, sección 6) ------------

/** Una columna de contexto declarada; `null` si el estudio no declaró el rol (nunca se adivina por el nombre). */
export type ColumnaDeContexto = { variable: string; etiqueta: string | null; fuente: string | null } | null;

export type ColumnasDeContexto = {
  fecha_respuesta: ColumnaDeContexto;
  recopilador: ColumnaDeContexto;
  numero_encuesta: ColumnaDeContexto;
  digitador: ColumnaDeContexto;
  fecha_envio: ColumnaDeContexto;
  inicio: ColumnaDeContexto;
  fin: ColumnaDeContexto;
};

/** Lo de un caso que acompaña a sus respuestas: también los `metadatos` de `GET /caso`. */
export type ContextoDeCaso = {
  fecha_respuesta: string | null;
  recopilador: string | null;
  numero_encuesta: string | null;
  digitador: string | null;
  fecha_envio: string | null;
  /** Minutos de inicio a fin, con un decimal; `null` si falta uno o sale negativa. */
  duracion_min: number | null;
  n_respondidas: number | null;
  /** Preguntas de origen respuesta con columna en la tabla. */
  n_preguntas: number | null;
};

function columnaDeContexto(value: unknown): ColumnaDeContexto {
  if (vacio(value)) return null;
  const r = registro(escalar(value));
  const variable = textoONulo(r.variable);
  return variable ? { variable, etiqueta: textoONulo(r.etiqueta), fuente: textoONulo(r.fuente) } : null;
}

export function normalizarColumnasDeContexto(value: unknown): ColumnasDeContexto {
  const r = registro(escalar(value));
  return {
    fecha_respuesta: columnaDeContexto(r.fecha_respuesta),
    recopilador: columnaDeContexto(r.recopilador),
    numero_encuesta: columnaDeContexto(r.numero_encuesta),
    digitador: columnaDeContexto(r.digitador),
    fecha_envio: columnaDeContexto(r.fecha_envio),
    inicio: columnaDeContexto(r.inicio),
    fin: columnaDeContexto(r.fin),
  };
}

export function normalizarContextoDeCaso(value: unknown): ContextoDeCaso | null {
  if (vacio(value)) return null;
  const r = registro(escalar(value));
  return {
    fecha_respuesta: textoONulo(r.fecha_respuesta),
    recopilador: textoONulo(r.recopilador),
    numero_encuesta: textoONulo(r.numero_encuesta),
    digitador: textoONulo(r.digitador),
    fecha_envio: textoONulo(r.fecha_envio),
    duracion_min: numeroONulo(r.duracion_min),
    n_respondidas: enteroONulo(r.n_respondidas),
    n_preguntas: enteroONulo(r.n_preguntas),
  };
}

/** `contexto_por_caso` del detalle: mismo largo y orden que `casos`; `null` en la fila que no se ubicó. */
export function normalizarContextoPorCaso(value: unknown, nCasos: number): Array<ContextoDeCaso | null> {
  const v = Array.isArray(value) ? value : vacio(value) ? [] : [value];
  return Array.from({ length: Math.max(0, nCasos) }, (_, i) => normalizarContextoDeCaso(v[i]));
}

// --- Auditar -----------------------------------------------------------------

export type AuditoriaLanzada = {
  job_id: string;
  base_nombre: string | null;
  /** Reglas del paquete auditado: las del formulario activas más las propias activas. */
  n_reglas: number | null;
  n_plan: number | null;
  n_propias: number | null;
};

export function normalizarAuditoriaLanzada(value: unknown): AuditoriaLanzada {
  const r = registro(value);
  const jobId = textoONulo(r.job_id);
  if (!jobId) throw new Error("El motor no devolvió el trabajo de la auditoría.");
  return {
    job_id: jobId,
    base_nombre: textoONulo(r.base_nombre),
    n_reglas: enteroONulo(r.n_reglas),
    n_plan: enteroONulo(r.n_plan),
    n_propias: enteroONulo(r.n_propias),
  };
}

/** Lanza la auditoría de la base: el plan del formulario sin las desactivadas, más las reglas propias activas. */
export async function apiAuditar(baseNombre?: string | null): Promise<AuditoriaLanzada> {
  const crudo = await handle<unknown>(
    await apiFetch("/api/validacion/v2/auditoria", {
      method: "POST",
      headers: encabezados(baseNombre),
    }),
  );
  return normalizarAuditoriaLanzada(crudo);
}

// --- Estado de la auditoría --------------------------------------------------

/**
 * `vigente`: las reglas no cambiaron desde la última; `desactualizada`: sí;
 * `sin_huella`: auditoría anterior a la huella, con las mismas reglas por id;
 * `sin_auditoria`: hay reglas y nunca se auditó; `sin_reglas`: no hay qué auditar.
 */
export type EstadoDeAuditoria = "vigente" | "desactualizada" | "sin_huella" | "sin_auditoria" | "sin_reglas";

const ESTADOS_AUDITORIA: readonly EstadoDeAuditoria[] = ["vigente", "desactualizada", "sin_huella", "sin_auditoria", "sin_reglas"];

export type AuditoriaEstado = {
  estado: EstadoDeAuditoria;
  base_nombre: string | null;
  /** Fecha y hora UTC de la última auditoría; `null` si nunca se auditó. */
  auditada_en: string | null;
  n_reglas_vigentes: number | null;
  n_reglas_auditadas: number | null;
  cambios: { agregadas: string[]; quitadas: string[]; modificadas: string[] };
};

export function normalizarAuditoriaEstado(value: unknown): AuditoriaEstado {
  const r = registro(value);
  const crudo = texto(r.estado);
  if (!(ESTADOS_AUDITORIA as readonly string[]).includes(crudo)) {
    throw new Error(`El motor devolvió un estado de auditoría desconocido: "${crudo || "vacío"}".`);
  }
  const cambios = registro(escalar(r.cambios));
  return {
    estado: crudo as EstadoDeAuditoria,
    base_nombre: textoONulo(r.base_nombre),
    auditada_en: textoONulo(r.auditada_en),
    n_reglas_vigentes: enteroONulo(r.n_reglas_vigentes),
    n_reglas_auditadas: enteroONulo(r.n_reglas_auditadas),
    cambios: {
      agregadas: textos(cambios.agregadas),
      quitadas: textos(cambios.quitadas),
      modificadas: textos(cambios.modificadas),
    },
  };
}

export async function apiAuditoriaEstado(baseNombre?: string | null): Promise<AuditoriaEstado> {
  const crudo = await handle<unknown>(
    await apiFetch("/api/validacion/v2/auditoria/estado", {
      headers: encabezados(baseNombre),
    }),
  );
  return normalizarAuditoriaEstado(crudo);
}

// --- Probar una regla propia sin guardarla -----------------------------------

/** `evaluada`, `sin_datos` (la base no tiene respuestas), `variable_excluida` o el estado del motor que impidió evaluarla. */
export type EstadoDePrueba = "evaluada" | "sin_datos" | "variable_excluida" | "no_aplicable" | "desalineada" | "no_evaluada";

const ESTADOS_PRUEBA: readonly EstadoDePrueba[] = ["evaluada", "sin_datos", "variable_excluida", "no_aplicable", "desalineada", "no_evaluada"];

export type PapelEnLaPrueba = "revisada" | "comparada" | "condicion" | "filtro";

export type ValorDeEjemplo = {
  variable: string;
  valor: string | null;
  papel: PapelEnLaPrueba | null;
  /** La que la regla marca como la que falla en esa fila. */
  falla: boolean;
};

/** Patrón de una regla de batería: misma respuesta, un código repetido o vacías. */
export type PatronDeBateria = "iguales" | "codigo" | "vacias";

/**
 * Lo que mide el motor en un caso marcado por una batería (una fila): preguntas
 * de la batería, las contadas como respuesta, las vacías, las que tienen el
 * código y la respuesta común si todas las contadas son la misma.
 */
export type ResumenDeBateria = {
  patron: PatronDeBateria;
  n_items: number;
  n_contadas: number;
  n_vacias: number;
  n_codigo: number;
  /** `""` si la respuesta común es la vacía (vacías que cuentan); `null` si no hay una sola. */
  valor_comun: string | null;
};

export type EjemploDePrueba = {
  /** `null` si la fila no se pudo identificar. */
  id_caso: string | null;
  valores: ValorDeEjemplo[];
  /** Solo en una regla de batería. */
  bateria?: ResumenDeBateria;
  /** Solo en una regla de fechas u horas. */
  fechas?: ResumenDeFechas;
};

/** Estado de lectura de una fecha u hora en un caso. */
export type EstadoDeLectura = "leida" | "vacia" | "incompleta" | "ilegible";

/** Por qué marca una regla de fechas en un caso. */
export type MotivoDeFechas = "ilegible" | "antes" | "despues" | "orden" | "corta" | "larga";

export type LadoDeFechas = {
  /** Lo leído: "2026-10-08" o "13:45"; `null` si no se leyó. */
  texto: string | null;
  estado: EstadoDeLectura;
  /** El formato con que se leyó ("dd.mm.aaaa", "hora_minutos_ampm"); `null` si no se leyó. */
  formato: string | null;
  /** El texto de la base, tal cual; en una fecha u hora repartida, sus partes separadas por coma. */
  original: string | null;
};

/**
 * Lo que mide el motor en un caso de una regla de fechas (una fila): lo leído
 * en el inicio (o la única fecha) y en el fin, la diferencia (fin menos
 * inicio, en minutos u días) y el motivo de la marca.
 */
export type ResumenDeFechas = {
  unidad: "fecha" | "hora";
  patron: "rango" | "orden" | "duracion";
  motivo: MotivoDeFechas | null;
  inicio: LadoDeFechas;
  fin: LadoDeFechas | null;
  diferencia: number | null;
};

/**
 * Cómo se leyeron las respuestas de un momento, sobre las filas que evalúa la
 * auditoría (`n_filas`, sin el filtro): cuántas con cada formato y cuántas
 * vacías, incompletas o ilegibles. Las cuatro cifras suman `n_filas`.
 */
export type LecturaDeFechas = {
  momento: "fecha" | "inicio" | "fin";
  variables: string[];
  partes: string;
  /** El formato declarado, o "auto". */
  formato: string;
  formatos: { formato: string; n: number }[];
  n_leidas: number;
  n_vacias: number;
  n_incompletas: number;
  n_ilegibles: number;
  n_filas: number;
};

const ESTADOS_DE_LECTURA: readonly EstadoDeLectura[] = ["leida", "vacia", "incompleta", "ilegible"];
const MOTIVOS_DE_FECHAS: readonly MotivoDeFechas[] = ["ilegible", "antes", "despues", "orden", "corta", "larga"];

function ladoDeFechas(value: unknown): LadoDeFechas | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = registro(value);
  const estado = texto(r.estado);
  if (!(ESTADOS_DE_LECTURA as readonly string[]).includes(estado)) return null;
  return { texto: textoONulo(r.texto), estado: estado as EstadoDeLectura, formato: textoONulo(r.formato), original: textoONulo(r.original) };
}

/** Lo medido en un caso de fechas, o `undefined` si no llega o llega incompleto. */
export function normalizarResumenDeFechas(value: unknown): ResumenDeFechas | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const r = registro(value);
  const unidad = texto(r.unidad);
  const patron = texto(r.patron);
  const inicio = ladoDeFechas(r.inicio);
  if ((unidad !== "fecha" && unidad !== "hora") || !["rango", "orden", "duracion"].includes(patron) || !inicio) return undefined;
  const motivo = texto(r.motivo);
  return {
    unidad,
    patron: patron as ResumenDeFechas["patron"],
    motivo: (MOTIVOS_DE_FECHAS as readonly string[]).includes(motivo) ? (motivo as MotivoDeFechas) : null,
    inicio,
    fin: ladoDeFechas(r.fin),
    diferencia: numeroONulo(r.diferencia),
  };
}

/** La lectura de una regla de fechas; vacía si no llega. */
export function normalizarLecturaDeFechas(value: unknown): LecturaDeFechas[] {
  return lista(value)
    .map((l): LecturaDeFechas | null => {
      const momento = texto(l.momento);
      if (momento !== "fecha" && momento !== "inicio" && momento !== "fin") return null;
      return {
        momento,
        variables: textos(l.variables),
        partes: texto(l.partes) || "una",
        formato: texto(l.formato) || "auto",
        formatos: lista(l.formatos)
          .map((f) => ({ formato: texto(f.formato), n: enteroONulo(f.n) ?? 0 }))
          .filter((f) => f.formato !== ""),
        n_leidas: enteroONulo(l.n_leidas) ?? 0,
        n_vacias: enteroONulo(l.n_vacias) ?? 0,
        n_incompletas: enteroONulo(l.n_incompletas) ?? 0,
        n_ilegibles: enteroONulo(l.n_ilegibles) ?? 0,
        n_filas: enteroONulo(l.n_filas) ?? 0,
      };
    })
    .filter((l): l is LecturaDeFechas => l !== null);
}

const PATRONES_DE_BATERIA: readonly PatronDeBateria[] = ["iguales", "codigo", "vacias"];

function conResumenDeBateria(value: unknown): { bateria?: ResumenDeBateria } {
  const bateria = normalizarResumenDeBateria(value);
  return bateria ? { bateria } : {};
}

/** El resumen de una batería, o `undefined` si no llega o llega incompleto. */
export function normalizarResumenDeBateria(value: unknown): ResumenDeBateria | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const r = registro(value);
  const patron = texto(r.patron);
  const n_items = enteroONulo(r.n_items);
  if (!(PATRONES_DE_BATERIA as readonly string[]).includes(patron) || n_items === null) return undefined;
  return {
    patron: patron as PatronDeBateria,
    n_items,
    n_contadas: enteroONulo(r.n_contadas) ?? 0,
    n_vacias: enteroONulo(r.n_vacias) ?? 0,
    n_codigo: enteroONulo(r.n_codigo) ?? 0,
    valor_comun: typeof r.valor_comun === "string" ? r.valor_comun : null,
  };
}

export type PruebaDeRegla = {
  estado: EstadoDePrueba;
  evaluada: boolean;
  /** Por qué no se evaluó, en llano, cuando no se evaluó. */
  motivo: string | null;
  base_vacia: boolean;
  filtro_previo: boolean;
  /** Filas de la tabla principal que evalúa la auditoría. */
  n_filas: number | null;
  /** De esas, las que cumplen el "Solo revisar cuando"; es la base de `proporcion`. */
  n_base: number | null;
  /** De `n_base`, las que la regla marca. */
  n_casos: number | null;
  /** `n_casos / n_base`, de 0 a 1; `null` si `n_base` es 0. */
  proporcion: number | null;
  ejemplos: EjemploDePrueba[];
  /** Solo en una regla de fechas: cómo se leyó cada fecha u hora (vacía en los demás tipos). */
  lectura?: LecturaDeFechas[];
};

const PAPELES: readonly PapelEnLaPrueba[] = ["revisada", "comparada", "condicion", "filtro"];

export function normalizarPruebaDeRegla(value: unknown): PruebaDeRegla {
  const r = registro(value);
  const crudo = texto(r.estado);
  const estado: EstadoDePrueba = (ESTADOS_PRUEBA as readonly string[]).includes(crudo)
    ? (crudo as EstadoDePrueba)
    : "no_evaluada";
  return {
    estado,
    evaluada: booleano(r.evaluada),
    motivo: textoONulo(r.motivo),
    base_vacia: booleano(r.base_vacia),
    filtro_previo: booleano(r.filtro_previo),
    n_filas: enteroONulo(r.n_filas),
    n_base: enteroONulo(r.n_base),
    n_casos: enteroONulo(r.n_casos),
    proporcion: numeroONulo(r.proporcion),
    lectura: normalizarLecturaDeFechas(r.lectura),
    ejemplos: lista(r.ejemplos).map((ej) => ({
      ...conResumenDeBateria(ej.bateria),
      ...(() => {
        const fechas = normalizarResumenDeFechas(ej.fechas);
        return fechas ? { fechas } : {};
      })(),
      id_caso: textoONulo(ej.id_caso),
      valores: lista(ej.valores)
        .map((val): ValorDeEjemplo | null => {
          const variable = textoONulo(val.variable);
          if (!variable) return null;
          const papel = texto(val.papel);
          return {
            variable,
            valor: textoONulo(val.valor),
            papel: (PAPELES as readonly string[]).includes(papel) ? (papel as PapelEnLaPrueba) : null,
            falla: booleano(val.falla),
          };
        })
        .filter((x): x is ValorDeEjemplo => x !== null),
    })),
  };
}

/**
 * Cuántos casos marcaría una regla propia, sin guardarla. `signal` cancela el
 * pedido anterior cuando el borrador cambia antes de la respuesta.
 */
export async function apiReglaProbar(
  regla: Record<string, unknown>,
  baseNombre?: string | null,
  opciones: { signal?: AbortSignal } = {},
): Promise<PruebaDeRegla> {
  const crudo = await handle<unknown>(
    await apiFetch("/api/validacion/v2/reglas_custom/probar", {
      method: "POST",
      headers: encabezados(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify(regla),
      signal: opciones.signal,
    }),
  );
  return normalizarPruebaDeRegla(crudo);
}

// --- El caso completo --------------------------------------------------------

export type OpcionMarcada = {
  codigo: string;
  etiqueta: string | null;
  /** M4: un código especial declarado por el estudio. */
  especial?: boolean;
};

/** M4: `respuesta`, `calculada` (`calculate`, `hidden`) o `metadato` (`start`, `end`, `deviceid`...). */
export type OrigenDeRespuesta = "respuesta" | "calculada" | "metadato";

/**
 * M4: `respondida`; `vacia_por_salto` (su condición es falsa en el caso);
 * `vacia` (sin condición o con la condición verdadera); `relevancia_indeterminada`
 * (la condición no se pudo evaluar en el caso).
 */
export type EstadoDeRespuesta = "respondida" | "vacia_por_salto" | "vacia" | "relevancia_indeterminada";

const ORIGENES_RESPUESTA: readonly OrigenDeRespuesta[] = ["respuesta", "calculada", "metadato"];
const ESTADOS_RESPUESTA: readonly EstadoDeRespuesta[] = ["respondida", "vacia_por_salto", "vacia", "relevancia_indeterminada"];

export type VariableDelCaso = {
  variable: string;
  etiqueta: string | null;
  tipo: string | null;
  /** Por código, como texto; `null` si está vacía. */
  valor: string | null;
  /** La etiqueta de la opción en `select_one`. */
  valor_etiqueta: string | null;
  /** En `select_multiple`, una por código marcado. */
  opciones: OpcionMarcada[];
  /** `null` con un motor anterior a M4. */
  origen: OrigenDeRespuesta | null;
  estado: EstadoDeRespuesta | null;
  /** `true` si el valor es un código especial declarado por el estudio. */
  especial: boolean;
  especial_etiqueta: string | null;
  /** Preguntas de opciones: algún código no está entre ellas. `null` en las demás o sin las opciones leídas. */
  fuera_de_opciones: boolean | null;
};

export type SeccionDelCaso = {
  /** `name` del grupo del formulario; `null` para preguntas fuera de grupo. */
  seccion: string | null;
  etiqueta: string | null;
  variables: VariableDelCaso[];
  /** M4: preguntas de origen respuesta, cuántas tienen valor y cuántas quedaron vacías por salto. */
  n_preguntas: number | null;
  n_respondidas: number | null;
  n_vacias_por_salto: number | null;
};

/** Un registro marcado de un grupo repetido, en un hallazgo de una hija. */
export type RegistroDelHallazgo = { fila: number | null; indice: string | null; esperado: EnunciadoEsperado | null };

export type HallazgoDelCaso = NarrativaDeRegla & {
  id_regla: string;
  /** Desde M4, la clase del catálogo; el valor del motor (`inconsistencia_xlsform`, `caso_validar`...) va en `hallazgo_kind`. */
  hallazgo_kind: string | null;
  tipo_regla: string | null;
  tabla: string | null;
  variables: Array<{ variable: string; etiqueta: string | null }>;
  /** El enunciado del primer registro marcado. */
  esperado: EnunciadoEsperado | null;
  /** `null` en la tabla principal; en un grupo repetido, un elemento por registro marcado del encuestado. */
  registros: RegistroDelHallazgo[] | null;
};

export type AvisoDelCaso = { codigo: string; texto: string };

export type CasoCompleto = {
  id_caso: string;
  base_nombre: string | null;
  identificacion_casos: IdentificacionCasos | null;
  tabla: string | null;
  /** Posición (desde 1) en la tabla de la auditoría. */
  fila: number | null;
  n_filas_con_el_id: number | null;
  en_otras_tablas: Array<{ tabla: string; n_filas: number | null }>;
  auditada_en: string | null;
  /** `false` si el formulario no se pudo leer: entonces no hay secciones. */
  instrumento_leido: boolean;
  secciones: SeccionDelCaso[];
  hallazgos: HallazgoDelCaso[];
  /** M4: qué columnas de contexto declaró el estudio y los datos del caso. */
  contexto: ColumnasDeContexto;
  metadatos: ContextoDeCaso | null;
  codigos_especiales_declarados: Array<{ codigo: string; etiqueta: string | null }>;
  avisos: AvisoDelCaso[];
  catalogo_leido: boolean | null;
};

function enumerado<T extends string>(value: unknown, validos: readonly T[]): T | null {
  const t = texto(value);
  return (validos as readonly string[]).includes(t) ? (t as T) : null;
}

function enunciadoSuelto(value: unknown): EnunciadoEsperado | null {
  return vacio(value) ? null : normalizarEsperado([escalar(value)], 1)[0];
}

export function normalizarCaso(value: unknown): CasoCompleto {
  const r = registro(value);
  const id = textoONulo(r.id_caso);
  if (!id) throw new Error("El motor no devolvió el identificador del caso.");
  return {
    id_caso: id,
    base_nombre: textoONulo(r.base_nombre),
    identificacion_casos: normalizarIdentificacionCasos(r.identificacion_casos),
    tabla: textoONulo(r.tabla),
    fila: enteroONulo(r.fila),
    n_filas_con_el_id: enteroONulo(r.n_filas_con_el_id),
    en_otras_tablas: lista(r.en_otras_tablas)
      .map((t) => ({ tabla: textoONulo(t.tabla), n_filas: enteroONulo(t.n_filas) }))
      .filter((t): t is { tabla: string; n_filas: number | null } => t.tabla !== null),
    auditada_en: textoONulo(r.auditada_en),
    instrumento_leido: booleano(r.instrumento_leido),
    secciones: lista(r.secciones).map((s) => ({
      seccion: textoONulo(s.seccion),
      etiqueta: textoONulo(s.etiqueta),
      variables: lista(s.variables)
        .map((v): VariableDelCaso | null => {
          const variable = textoONulo(v.variable);
          if (!variable) return null;
          return {
            variable,
            etiqueta: textoONulo(v.etiqueta),
            tipo: textoONulo(v.tipo),
            valor: textoONulo(v.valor),
            valor_etiqueta: textoONulo(v.valor_etiqueta),
            opciones: lista(v.opciones)
              .map((o) => ({
                codigo: textoONulo(o.codigo),
                etiqueta: textoONulo(o.etiqueta),
                ...(o.especial === undefined ? {} : { especial: booleano(o.especial) }),
              }))
              .filter((o): o is OpcionMarcada => o.codigo !== null),
            origen: enumerado(v.origen, ORIGENES_RESPUESTA),
            estado: enumerado(v.estado, ESTADOS_RESPUESTA),
            especial: booleano(v.especial),
            especial_etiqueta: textoONulo(v.especial_etiqueta),
            fuera_de_opciones: aplicableONulo(v.fuera_de_opciones),
          };
        })
        .filter((x): x is VariableDelCaso => x !== null),
      n_preguntas: enteroONulo(s.n_preguntas),
      n_respondidas: enteroONulo(s.n_respondidas),
      n_vacias_por_salto: enteroONulo(s.n_vacias_por_salto),
    })),
    hallazgos: lista(r.hallazgos)
      .map((h): HallazgoDelCaso | null => {
        const idRegla = textoONulo(h.id_regla);
        if (!idRegla) return null;
        const registros = h.registros === null || h.registros === undefined || h.registros === "NA"
          ? null
          : lista(h.registros).map((x) => ({
              fila: enteroONulo(x.fila),
              indice: textoONulo(x.indice),
              esperado: enunciadoSuelto(x.esperado),
            }));
        return {
          ...normalizarNarrativa(h),
          id_regla: idRegla,
          // Un motor anterior a M4 mandaba el valor del motor en `clase`.
          hallazgo_kind: textoONulo(h.hallazgo_kind)
            ?? (texto(h.clase) === "inconsistencia" || texto(h.clase) === "caso_a_revisar" ? null : textoONulo(h.clase)),
          tipo_regla: textoONulo(h.tipo_regla),
          tabla: textoONulo(h.tabla),
          variables: lista(h.variables)
            .map((v) => ({ variable: textoONulo(v.variable), etiqueta: textoONulo(v.etiqueta) }))
            .filter((v): v is { variable: string; etiqueta: string | null } => v.variable !== null),
          esperado: enunciadoSuelto(h.esperado),
          registros,
        };
      })
      .filter((x): x is HallazgoDelCaso => x !== null),
    contexto: normalizarColumnasDeContexto(r.contexto),
    metadatos: normalizarContextoDeCaso(r.metadatos),
    codigos_especiales_declarados: lista(r.codigos_especiales_declarados)
      .map((c) => ({ codigo: textoONulo(c.codigo), etiqueta: textoONulo(c.etiqueta) }))
      .filter((c): c is { codigo: string; etiqueta: string | null } => c.codigo !== null),
    avisos: lista(r.avisos)
      .map((a) => ({ codigo: texto(a.codigo), texto: texto(a.texto) }))
      .filter((a) => a.texto),
    catalogo_leido: aplicableONulo(r.catalogo_leido),
  };
}

/** El caso completo de la última auditoría. 404 `E_CASO_NO_ENCONTRADO` si ningún caso tiene ese id. */
export async function apiCaso(
  idCaso: string,
  baseNombre?: string | null,
  opciones: { signal?: AbortSignal } = {},
): Promise<CasoCompleto> {
  const qs = new URLSearchParams({ id: idCaso });
  const crudo = await handle<unknown>(
    await apiFetch(`/api/validacion/v2/caso?${qs.toString()}`, {
      headers: encabezados(baseNombre),
      signal: opciones.signal,
    }),
  );
  return normalizarCaso(crudo);
}

// --- Efecto previsto de una decisión (contrato M4, sección 4) -----------------

/**
 * Lo que haría la decisión si se guardara lista, además de las demás listas.
 * Base de las cifras: los casos evaluados en la última auditoría; nivel caso.
 * No guarda nada ni marca el proyecto como modificado.
 */
export type EfectoDeDecision = SeguimientoDeDecision & {
  accion: string | null;
  variable: string | null;
  /** Filas que excluye o con al menos una celda que cambia. */
  n_filas: number | null;
  /** Celdas que cambian (0 al excluir o ignorar). */
  n_celdas: number | null;
  n_casos_cuentan_antes: number | null;
  n_casos_cuentan_despues: number | null;
  aplicable: boolean | null;
  motivo_no_aplicable: MotivoNoAplicable | null;
  /** La causa en llano, del motor; si no la mandó, la de `textoDeMotivoNoAplicable`. */
  texto_no_aplicable: string | null;
  base_cifras: string | null;
};

export function normalizarEfecto(value: unknown): EfectoDeDecision {
  const r = registro(value);
  const aplicable = aplicableONulo(r.aplicable);
  const motivoLeido = aplicable === false ? motivo(r.motivo_no_aplicable) : null;
  const textoMotor = aplicable === false ? textoONulo(r.texto_no_aplicable) : null;
  return {
    ...normalizarSeguimiento(r),
    accion: textoONulo(r.accion),
    variable: textoONulo(r.variable),
    n_filas: enteroONulo(r.n_filas),
    n_celdas: enteroONulo(r.n_celdas),
    n_casos_cuentan_antes: enteroONulo(r.n_casos_cuentan_antes),
    n_casos_cuentan_despues: enteroONulo(r.n_casos_cuentan_despues),
    aplicable,
    motivo_no_aplicable: motivoLeido,
    texto_no_aplicable: textoMotor
      ?? (motivoLeido ? textoDeMotivoNoAplicable(motivoLeido, textoONulo(r.motivo_no_aplicable)) : null),
    base_cifras: textoONulo(r.base_cifras),
  };
}

/**
 * El efecto previsto de un borrador (`POST /limpieza/decision/efecto`). El
 * cuerpo es el mismo que guardaría `POST /limpieza/decision`. `signal` cancela
 * el pedido anterior cuando el borrador cambia antes de la respuesta.
 */
export async function apiEfectoDeDecision(
  cuerpo: Record<string, unknown>,
  baseNombre?: string | null,
  opciones: { signal?: AbortSignal } = {},
): Promise<EfectoDeDecision> {
  const crudo = await handle<unknown>(
    await apiFetch("/api/validacion/v2/limpieza/decision/efecto", {
      method: "POST",
      headers: encabezados(baseNombre, { "Content-Type": "application/json" }),
      body: JSON.stringify(cuerpo),
      signal: opciones.signal,
    }),
  );
  return normalizarEfecto(crudo);
}

// --- Catálogo con los límites de rango y restricción (contrato M3) -----------

/**
 * Los límites de una regla de rango o de restricción, como los publica el
 * catálogo (`limites`). `null` en las demás. Los valores llegan como texto.
 */
export type LimitesDeRegla = {
  tipo: string | null;
  min: string | null;
  max: string | null;
  inclusive_min: boolean;
  inclusive_max: boolean;
  /** La restricción legible. */
  restriccion: string | null;
};

export function normalizarLimites(value: unknown): LimitesDeRegla | null {
  if (vacio(value)) return null;
  const r = registro(escalar(value));
  const limites: LimitesDeRegla = {
    tipo: textoONulo(r.tipo),
    min: textoONulo(r.min),
    max: textoONulo(r.max),
    inclusive_min: r.inclusive_min === undefined ? booleano(r.inclusive) : booleano(r.inclusive_min),
    inclusive_max: r.inclusive_max === undefined ? booleano(r.inclusive) : booleano(r.inclusive_max),
    restriccion: textoONulo(r.restriccion),
  };
  return limites.min === null && limites.max === null ? null : limites;
}

export type CatalogoDeHallazgos = {
  completo: CatalogoCompleto;
  /** Por id del motor (`id_motor`, el `source_id` de la cola). */
  limites: Record<string, LimitesDeRegla>;
};

/**
 * El catálogo de reglas para Hallazgos: el completo de Reglas y, del mismo
 * pedido, los límites que su normalizador no lee (`limites`), por id del motor.
 */
export async function apiCatalogoDeHallazgos(
  baseNombre?: string | null,
  opciones: { signal?: AbortSignal } = {},
): Promise<CatalogoDeHallazgos> {
  const crudo = await handle<unknown>(
    await apiFetch("/api/validacion/v2/reglas/catalogo", { headers: encabezados(baseNombre), signal: opciones.signal }),
  );
  const limites: Record<string, LimitesDeRegla> = {};
  for (const regla of lista(registro(crudo).reglas)) {
    const id = textoONulo(regla.id_motor) ?? textoONulo(regla.id);
    const l = normalizarLimites(regla.limites);
    if (id && l) limites[id] = l;
  }
  return { completo: normalizarCatalogoCompleto(crudo), limites };
}
