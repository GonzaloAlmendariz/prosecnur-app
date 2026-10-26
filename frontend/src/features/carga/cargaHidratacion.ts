/**
 * Hidratación honesta de Carga (remasterización L4, maqueta L04).
 *
 * Carga tiene dos esperas encadenadas antes de poder decir algo verdadero:
 *
 * 1. El estado de sesión (`useSession().state`) llega después del primer
 *    render. Mientras es `null`, todo predicado de la página (`hasXlsform`,
 *    `isMultiBase`, conteos de bases) vale `false`/`0` por omisión y la vista
 *    pintaba «Pendiente · 0/1 base» sobre un estudio con 1.283 registros.
 * 2. En un estudio multibase, el detalle de las bases (`apiEstudioGet`) llega
 *    después del estado de sesión.
 *
 * Mientras cualquiera de las dos esté en vuelo la página está `leyendo`: pinta
 * la silueta de la vista (Skeleton del kit) y NO publica `data-audit-ready`,
 * para que el runner no capture un estado falso creyéndolo la pestaña.
 */

export type EstadoEstudioCarga = "inactivo" | "leyendo" | "listo" | "error";

export type HidratacionCarga =
  | { fase: "leyendo"; motivo: "sesion" | "estudio" }
  | { fase: "error"; motivo: "sesion" | "estudio" }
  | { fase: "lista" };

export function resolverHidratacionCarga({
  hayEstadoSesion,
  errorSesion = false,
  esMultiBase,
  estudio,
}: {
  /** `useSession().state !== null`. */
  hayEstadoSesion: boolean;
  /**
   * `useSession().error` sin estado: la lectura de sesión falló y nadie la
   * reintenta sola. Sin esta rama la página quedaba en «Abriendo el estudio»
   * con el cronómetro corriendo para siempre (QA L4, hallazgo P2).
   */
  errorSesion?: boolean;
  /** Resultado de la topología ya con el estado de sesión disponible. */
  esMultiBase: boolean;
  /** Estado de la lectura del estudio multibase. */
  estudio: EstadoEstudioCarga;
}): HidratacionCarga {
  if (!hayEstadoSesion) {
    return errorSesion ? { fase: "error", motivo: "sesion" } : { fase: "leyendo", motivo: "sesion" };
  }
  if (!esMultiBase) return { fase: "lista" };
  if (estudio === "listo") return { fase: "lista" };
  if (estudio === "error") return { fase: "error", motivo: "estudio" };
  // `inactivo` con multibase es el render intermedio antes de que el efecto
  // que pide el estudio arranque: también es lectura en curso.
  return { fase: "leyendo", motivo: "estudio" };
}

/**
 * Marca de readiness de la página. Solo con las bases hidratadas (o con un
 * error verdadero que la vista muestra) se publica la dirección de la pestaña.
 */
export function marcaReadinessCarga(
  hidratacion: HidratacionCarga,
  pestana: string,
): string | false {
  if (hidratacion.fase === "leyendo") return false;
  return `carga-${pestana}`;
}

/** Tiempo transcurrido como `m:ss` («0:03»). Negativos y no finitos → `0:00`. */
export function formatoTranscurrido(segundos: number): string {
  const total = Number.isFinite(segundos) ? Math.max(0, Math.floor(segundos)) : 0;
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  return `${minutos}:${String(resto).padStart(2, "0")}`;
}

/** Texto de la espera según qué se está leyendo. */
export function textoHidratacionCarga(motivo: "sesion" | "estudio"): string {
  return motivo === "sesion" ? "Abriendo el estudio" : "Leyendo las bases del estudio";
}
