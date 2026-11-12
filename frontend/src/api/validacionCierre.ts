// validacionCierre.ts — el cierre de la base que publica `GET /api/validacion/v2/limpieza`
// desde el motor M5 (contrato CONTRATO_VALIDACION_M5.md; commit d31e2f65d): el
// campo `cierre` con la cadena de casos, las decisiones aplicadas por grupo y
// los cuatro archivos del cierre con su estado.
//
// No hay ruta nueva: la pestaña Cierre ya pide `GET /limpieza` (`apiV2Limpieza`)
// y lee aquí su campo `cierre`. Después de cerrar, `summary.total_casos_excluidos`
// y `summary.total_celdas_corregidas` se miden sobre la base ya limpia y valen 0:
// la pantalla lee estas cifras, no las de `summary`.
//
// Plumber escribe un escalar como vector de largo uno, una lista de uno como
// objeto suelto, `NULL` como `{}` y `NA` como `null` o "NA". Una cifra ausente
// queda `null`, nunca 0: un 0 se lee como "no hubo".

import { booleano, enteroONulo, escalar, lista, numeroONulo, registro, texto } from "./normalizarR";

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

/** `true`, `false` o `null` si el motor no lo pudo medir. */
function booleanoONulo(value: unknown): boolean | null {
  const v = escalar(value);
  if (v === null || v === undefined || v === "NA") return null;
  if (typeof v === "object") return null;
  return booleano(v);
}

function deLista<T extends string>(value: unknown, validos: readonly T[]): T | null {
  const t = textoONulo(value);
  return t !== null && (validos as readonly string[]).includes(t) ? (t as T) : null;
}

// --- 1. Cadena de casos ------------------------------------------------------

export type AvisoDeCadena = { codigo: string; texto: string };

export type CadenaDeCasos = {
  /** `al_cerrar`: cifras guardadas al cerrar; `prevista`: vista previa con la base abierta. */
  momento: "al_cerrar" | "prevista" | null;
  recibidos: number | null;
  /** El motor no registra de cuántas fuentes viene la base: siempre `null` hoy. */
  n_fuentes: number | null;
  fuera: {
    retirados_fuera_de_la_app: number | null;
    pruebas: number | null;
    sin_clasificar: number | null;
    por_reglas_de_carga: number | null;
    fuera_de_la_auditoria: number | null;
  };
  excluidos_en_limpieza: number | null;
  cuentan: number | null;
  /** `cuentan / recibidos`, de 0 a 1. */
  proporcion: number | null;
  /** La resta llega a `cuentan`; `null` si un tramo no se pudo medir. */
  cuadra: boolean | null;
  filtro_de_pruebas: boolean;
  depuracion_externa: boolean;
  base_promovida: boolean;
  /** El grano y el denominador, en palabras del motor. */
  base: string | null;
  avisos: AvisoDeCadena[];
};

export function normalizarCadenaDeCasos(value: unknown): CadenaDeCasos | null {
  const r = registro(escalar(value));
  if (Object.keys(r).length === 0) return null;
  const fuera = registro(escalar(r.fuera));
  return {
    momento: deLista(r.momento, ["al_cerrar", "prevista"] as const),
    recibidos: enteroONulo(r.recibidos),
    n_fuentes: enteroONulo(r.n_fuentes),
    fuera: {
      retirados_fuera_de_la_app: enteroONulo(fuera.retirados_fuera_de_la_app),
      pruebas: enteroONulo(fuera.pruebas),
      sin_clasificar: enteroONulo(fuera.sin_clasificar),
      por_reglas_de_carga: enteroONulo(fuera.por_reglas_de_carga),
      fuera_de_la_auditoria: enteroONulo(fuera.fuera_de_la_auditoria),
    },
    excluidos_en_limpieza: enteroONulo(r.excluidos_en_limpieza),
    cuentan: enteroONulo(r.cuentan),
    proporcion: numeroONulo(r.proporcion),
    cuadra: booleanoONulo(r.cuadra),
    filtro_de_pruebas: booleano(r.filtro_de_pruebas),
    depuracion_externa: booleano(r.depuracion_externa),
    base_promovida: booleano(r.base_promovida),
    base: textoONulo(r.base),
    avisos: lista(r.avisos)
      .map((a) => ({ codigo: texto(a.codigo), texto: texto(a.texto) }))
      .filter((a) => a.codigo || a.texto),
  };
}

// --- 2. Decisiones aplicadas --------------------------------------------------

export type EfectoAplicado = "excluye" | "cambia_valores" | "sin_cambios" | "no_se_aplica";

export const EFECTOS_APLICADOS: readonly EfectoAplicado[] = ["excluye", "cambia_valores", "sin_cambios", "no_se_aplica"];

export type DecisionAplicada = {
  decision_id: string;
  /** Cruza con `decision_queue[].source_id` para el nombre y la clase. */
  source_id: string;
  action_type: string;
  target_variable: string | null;
  rationale: string | null;
  decidida_en: string | null;
  efecto: EfectoAplicado | null;
  n_filas_excluidas: number | null;
  n_filas_ya_excluidas: number | null;
  n_celdas_cambiadas: number | null;
  /** Solo `sin_cambios`: casos que la decisión revisó. */
  n_casos_revisados: number | null;
  aplicable: boolean | null;
  motivo_no_aplicable: string | null;
};

export type GrupoAplicado = {
  efecto: EfectoAplicado;
  n_decisiones: number;
  /** Casos excluidos, valores cambiados o revisiones de casos; `null` en "no se aplica". */
  cifra: number | null;
  unidad: string | null;
};

export type DecisionesAplicadas = {
  regla_atribucion: string | null;
  decisiones: DecisionAplicada[];
  /** Los cuatro, en orden; el que no vino queda con 0 decisiones. */
  grupos: GrupoAplicado[];
  totales: {
    n_casos_excluidos: number | null;
    n_celdas_cambiadas: number | null;
    cuadra_con_motor: boolean | null;
  };
};

function normalizarDecisionAplicada(r: Record<string, unknown>): DecisionAplicada | null {
  const decisionId = textoONulo(r.decision_id);
  const sourceId = textoONulo(r.source_id);
  if (!decisionId || !sourceId) return null;
  return {
    decision_id: decisionId,
    source_id: sourceId,
    action_type: texto(r.action_type),
    target_variable: textoONulo(r.target_variable),
    rationale: textoONulo(r.rationale),
    decidida_en: textoONulo(r.decidida_en),
    efecto: deLista(r.efecto, EFECTOS_APLICADOS),
    n_filas_excluidas: enteroONulo(r.n_filas_excluidas),
    n_filas_ya_excluidas: enteroONulo(r.n_filas_ya_excluidas),
    n_celdas_cambiadas: enteroONulo(r.n_celdas_cambiadas),
    n_casos_revisados: enteroONulo(r.n_casos_revisados),
    aplicable: booleanoONulo(r.aplicable),
    motivo_no_aplicable: textoONulo(r.motivo_no_aplicable),
  };
}

export function normalizarDecisionesAplicadas(value: unknown): DecisionesAplicadas | null {
  const r = registro(escalar(value));
  if (Object.keys(r).length === 0) return null;
  const crudos = lista(r.grupos);
  const grupos = EFECTOS_APLICADOS.map((efecto): GrupoAplicado => {
    const g = crudos.find((x) => textoONulo(x.efecto) === efecto);
    return {
      efecto,
      n_decisiones: enteroONulo(g?.n_decisiones) ?? 0,
      cifra: g ? enteroONulo(g.cifra) : null,
      unidad: g ? textoONulo(g.unidad) : null,
    };
  });
  const totales = registro(escalar(r.totales));
  return {
    regla_atribucion: textoONulo(r.regla_atribucion),
    decisiones: lista(r.decisiones).map(normalizarDecisionAplicada).filter((d): d is DecisionAplicada => d !== null),
    grupos,
    totales: {
      n_casos_excluidos: enteroONulo(totales.n_casos_excluidos),
      n_celdas_cambiadas: enteroONulo(totales.n_celdas_cambiadas),
      cuadra_con_motor: booleanoONulo(totales.cuadra_con_motor),
    },
  };
}

// --- 3. Archivos del cierre ---------------------------------------------------

export type ClaveDeArchivoDelCierre = "base_limpia" | "registro" | "revision" | "paquete_metodologico";

export const CLAVES_DE_ARCHIVO: readonly ClaveDeArchivoDelCierre[] = ["base_limpia", "registro", "revision", "paquete_metodologico"];

export type EstadoDeArchivoDelCierre = "al_dia" | "desactualizado" | "no_generado";

export type CausaDeDesactualizado = "cambiaron_las_decisiones" | "cambio_la_auditoria";

export type ArchivoDelCierre = {
  clave: ClaveDeArchivoDelCierre;
  nombre: string;
  archivo: string | null;
  formato: string | null;
  /** `null` con `causa_estado` cuando el motor no sabe sobre qué decisiones se generó. */
  estado: EstadoDeArchivoDelCierre | null;
  causas: CausaDeDesactualizado[];
  causa_estado: string | null;
  generado_en: string | null;
  file_id: string | null;
  /** El archivo sigue en esta sesión (los entregables no viajan en el `.pulso`). */
  disponible: boolean;
  guardado_en: string | null;
  /** Solo el paquete: las extensiones de lo que trae el ZIP. */
  contenido: string[];
};

const NOMBRE_POR_CLAVE: Record<ClaveDeArchivoDelCierre, string> = {
  base_limpia: "Base limpia",
  registro: "Registro de limpieza",
  revision: "Revisión de limpieza",
  paquete_metodologico: "Paquete metodológico",
};

function normalizarArchivo(r: Record<string, unknown>): ArchivoDelCierre | null {
  const clave = deLista(r.clave, CLAVES_DE_ARCHIVO);
  if (!clave) return null;
  return {
    clave,
    nombre: textoONulo(r.nombre) ?? NOMBRE_POR_CLAVE[clave],
    archivo: textoONulo(r.archivo),
    formato: textoONulo(r.formato)?.toLowerCase() ?? null,
    estado: deLista(r.estado, ["al_dia", "desactualizado", "no_generado"] as const),
    causas: textos(r.causas).filter((c): c is CausaDeDesactualizado => c === "cambiaron_las_decisiones" || c === "cambio_la_auditoria"),
    causa_estado: textoONulo(r.causa_estado),
    generado_en: textoONulo(r.generado_en),
    file_id: textoONulo(r.file_id),
    disponible: booleano(r.disponible),
    guardado_en: textoONulo(r.guardado_en),
    contenido: textos(r.contenido).map((c) => c.toLowerCase()),
  };
}

// --- El cierre entero ---------------------------------------------------------

export type CierreDeLimpieza = {
  estado: "cerrada" | "abierta";
  cerrada_en: string | null;
  /** Por qué no hay cifras (base cerrada antes de M5, sin vista previa). */
  causa_sin_cifras: string | null;
  cadena_casos: CadenaDeCasos | null;
  decisiones_aplicadas: DecisionesAplicadas | null;
  /** En el orden del motor: base limpia, registro, revisión y paquete. */
  archivos: ArchivoDelCierre[];
};

/**
 * El campo `cierre` de `GET /limpieza`. `null` si el motor no lo publica (un
 * motor anterior a M5) o si su estado no se reconoce: la pantalla dice que no
 * hay cifras del cierre en lugar de mostrar ceros.
 */
export function normalizarCierre(value: unknown): CierreDeLimpieza | null {
  const r = registro(escalar(value));
  const estado = deLista(r.estado, ["cerrada", "abierta"] as const);
  if (!estado) return null;
  const archivos = lista(r.archivos).map(normalizarArchivo).filter((a): a is ArchivoDelCierre => a !== null);
  return {
    estado,
    cerrada_en: textoONulo(r.cerrada_en),
    causa_sin_cifras: textoONulo(r.causa_sin_cifras),
    cadena_casos: normalizarCadenaDeCasos(r.cadena_casos),
    decisiones_aplicadas: normalizarDecisionesAplicadas(r.decisiones_aplicadas),
    archivos: CLAVES_DE_ARCHIVO.map((c) => archivos.find((a) => a.clave === c)).filter((a): a is ArchivoDelCierre => a !== undefined),
  };
}
