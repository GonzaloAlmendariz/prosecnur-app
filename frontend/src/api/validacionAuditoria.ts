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
// Plumber escribe un escalar como vector de largo uno, una lista de uno como
// objeto suelto, `NULL` como `{}` y `NA` como `null` o "NA". Los
// normalizadores aceptan esas formas y devuelven `null` donde el motor no dio
// el dato: una cifra ausente no se vuelve 0, porque un 0 se lee como "no hay".

import { apiFetch, handle, headers } from "./core";
import { booleano, enteroONulo, escalar, lista, numeroONulo, registro, texto } from "./normalizarR";

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
  | "llave_declarada"
  | "otro";

const MOTIVOS: readonly MotivoNoAplicable[] = [
  "columna_ausente",
  "numeracion_anterior",
  "auditoria_sin_fila_de_origen",
  "regla_sin_casos",
  "sin_filas_en_principal",
];

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
 * lo que respondió. `texto` sale del motor con comillas angulares y punto
 * medio: no se muestra tal cual (aviso de redacción del contrato M2).
 */
export type EnunciadoEsperado = {
  anomalia_tipo: string | null;
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

export type EjemploDePrueba = {
  /** `null` si la fila no se pudo identificar. */
  id_caso: string | null;
  valores: ValorDeEjemplo[];
};

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
    ejemplos: lista(r.ejemplos).map((ej) => ({
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

export type OpcionMarcada = { codigo: string; etiqueta: string | null };

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
};

export type SeccionDelCaso = {
  /** `name` del grupo del formulario; `null` para preguntas fuera de grupo. */
  seccion: string | null;
  etiqueta: string | null;
  variables: VariableDelCaso[];
};

export type HallazgoDelCaso = {
  id_regla: string;
  nombre: string | null;
  /** `hallazgo_kind` de la cola: `inconsistencia_xlsform`, `inconsistencia_usuario` o `caso_validar`. */
  clase: string | null;
  tipo_regla: string | null;
  tabla: string | null;
  variables: Array<{ variable: string; etiqueta: string | null }>;
};

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
};

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
              .map((o) => ({ codigo: textoONulo(o.codigo), etiqueta: textoONulo(o.etiqueta) }))
              .filter((o): o is OpcionMarcada => o.codigo !== null),
          };
        })
        .filter((x): x is VariableDelCaso => x !== null),
    })),
    hallazgos: lista(r.hallazgos)
      .map((h): HallazgoDelCaso | null => {
        const idRegla = textoONulo(h.id_regla);
        if (!idRegla) return null;
        return {
          id_regla: idRegla,
          nombre: textoONulo(h.nombre),
          clase: textoONulo(h.clase),
          tipo_regla: textoONulo(h.tipo_regla),
          tabla: textoONulo(h.tabla),
          variables: lista(h.variables)
            .map((v) => ({ variable: textoONulo(v.variable), etiqueta: textoONulo(v.etiqueta) }))
            .filter((v): v is { variable: string; etiqueta: string | null } => v.variable !== null),
        };
      })
      .filter((x): x is HallazgoDelCaso => x !== null),
  };
}

/** El caso completo de la última auditoría. 404 `E_CASO_NO_ENCONTRADO` si ningún caso tiene ese id. */
export async function apiCaso(idCaso: string, baseNombre?: string | null): Promise<CasoCompleto> {
  const qs = new URLSearchParams({ id: idCaso });
  const crudo = await handle<unknown>(
    await apiFetch(`/api/validacion/v2/caso?${qs.toString()}`, {
      headers: encabezados(baseNombre),
    }),
  );
  return normalizarCaso(crudo);
}
