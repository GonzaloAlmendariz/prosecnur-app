/**
 * Carga › Revisión: cuándo la vista ya leyó lo que muestra.
 *
 * Revisión pinta tres lecturas del backend sobre la base elegida en «Base
 * revisada»: la revisión de esa base (`/api/carga/review`), el resumen del
 * estudio en multibase (`/api/carga/review/summary`) y la configuración del
 * universo de análisis. Mientras alguna no llegó para la base ACTUAL, la vista
 * no puede afirmar «Listo» ni «Sin incidencias», y el QA visual no puede darla
 * por lista: capturaría la frase de otra base o un estado a medio leer.
 *
 * Cada lectura se registra con la base para la que terminó (bien o con error:
 * un error también es un resultado que la vista muestra). Así un cambio de base
 * invalida la lectura anterior sin que nadie tenga que reiniciarla.
 */

export type CargaRevisionLectura = {
  /** Base cuya revisión ya terminó de leerse; `null` mientras se lee. */
  revision: string | null;
  /** El resumen multibase ya terminó de leerse. */
  resumen: boolean;
  /**
   * Base cuyo universo de análisis ya terminó de leerse (`""` = el filtro sin
   * base nombrada de un proyecto de base única).
   */
  universo: string | null;
};

export const CARGA_REVISION_SIN_LEER: CargaRevisionLectura = {
  revision: null,
  resumen: false,
  universo: null,
};

export type CargaRevisionLecturaEntrada = {
  isMultiBase: boolean;
  /** «Base revisada»; `""` es la base heredada de un proyecto de base única. */
  baseSeleccionada: string;
  /** Bases primarias que ofrece el selector (multibase). */
  basesPrimarias: readonly string[];
  /** Base única: hay formulario y respuestas, así que hay revisión que leer. */
  insumosListos: boolean;
  /**
   * La base con que se montó el filtro de universo, o `null` si no se montó
   * (no hay nada que esperar).
   */
  universoBase: string | null;
  lectura: CargaRevisionLectura;
};

export type CargaRevisionEstadoLectura = {
  /** Revisión y resumen ya describen la base elegida: el encabezado puede afirmar. */
  datosLeidos: boolean;
  /** Además el universo de análisis: la vista entera está lista para auditarse. */
  completa: boolean;
};

export function cargaRevisionEstadoLectura(entrada: CargaRevisionLecturaEntrada): CargaRevisionEstadoLectura {
  const { isMultiBase, baseSeleccionada: base, basesPrimarias, insumosListos, universoBase, lectura } = entrada;
  const universoLeido = universoBase === null || lectura.universo === universoBase;

  // Sin revisión que leer, lo que se ve (el vacío legítimo) ya es el resultado.
  if (isMultiBase ? basesPrimarias.length === 0 : !insumosListos) {
    return { datosLeidos: true, completa: universoLeido };
  }
  // Multibase con una base que no está en el selector: dura lo que tarda
  // Revisión en elegir una válida; nada de lo pintado es de una base real.
  if (isMultiBase && !basesPrimarias.includes(base)) {
    return { datosLeidos: false, completa: false };
  }

  const datosLeidos = lectura.revision === base && (!isMultiBase || lectura.resumen);
  return { datosLeidos, completa: datosLeidos && universoLeido };
}

/**
 * La base que muestra «Base revisada». Manda la dirección: un enlace al panel
 * de una fuente (`foco=<base>:<survey_id>`) trae su base y Revisión la adopta,
 * para que el selector y el panel hablen de lo mismo al recargar. Después, la
 * elección vigente; luego la base activa del estudio; por último la primera.
 */
export function baseRevisadaElegida(entrada: {
  actual: string;
  basesPrimarias: readonly string[];
  baseDeLaDireccion: string | null;
  baseActiva: string | null | undefined;
}): string {
  const { actual, basesPrimarias, baseDeLaDireccion, baseActiva } = entrada;
  if (baseDeLaDireccion && basesPrimarias.includes(baseDeLaDireccion)) return baseDeLaDireccion;
  if (basesPrimarias.includes(actual)) return actual;
  if (baseActiva && basesPrimarias.includes(baseActiva)) return baseActiva;
  return basesPrimarias[0] ?? "";
}
