// =============================================================================
// warmupTiempo.ts — el tiempo del warm start (Meta B, L23)
// =============================================================================
// El arranque en frío es intencional y con un proyecto real tarda minutos.
// Lo que se le debe a quien espera es tiempo, no un porcentaje: cuánto lleva,
// cuánto falta cuando hay con qué saberlo y cuánto tomó cada fase.
//
// La estimación sale de la apertura anterior del mismo proyecto, que el backend
// anota al terminar cada warmup (`api/R/project_warmup_duraciones.R`). Sin
// apertura anterior no hay restante: se muestra sólo el transcurrido.
// =============================================================================

export type WarmupEstimacion = {
  /** Duración total de la apertura anterior con el mismo juego de módulos. */
  totalMs: number | null;
  /** Cuándo fue esa apertura (ISO), si el backend lo dijo. */
  at: string | null;
  /** Última duración conocida de cada fase de backend, por id de tarea. */
  fasesMs: Record<string, number>;
};

export const SIN_ESTIMACION: WarmupEstimacion = Object.freeze({
  totalMs: null,
  at: null,
  fasesMs: Object.freeze({}) as Record<string, number>,
}) as WarmupEstimacion;

function msPositivo(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function esObjeto(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Lee la estimación tal como la publica el backend (en la respuesta de
 * `POST /api/project/warmup` o en `plan.estimacion`). Defensivo: `null`
 * serializado como `{}` o un `tareas_ms` vacío como `[]` no son errores, son
 * «sin apertura anterior».
 */
export function normalizarEstimacionWarmup(raw: unknown): WarmupEstimacion {
  if (!esObjeto(raw)) return SIN_ESTIMACION;
  const ultima = esObjeto(raw.ultima_apertura) ? raw.ultima_apertura : null;
  const totalMs = ultima ? msPositivo(ultima.elapsed_ms) : null;
  const at = ultima && typeof ultima.at === "string" && ultima.at.trim() ? ultima.at.trim() : null;
  const fasesMs: Record<string, number> = {};
  if (esObjeto(raw.tareas_ms)) {
    for (const [id, value] of Object.entries(raw.tareas_ms)) {
      const ms = msPositivo(value);
      if (id && ms !== null) fasesMs[id] = ms;
    }
  }
  if (totalMs === null && !Object.keys(fasesMs).length) return SIN_ESTIMACION;
  return { totalMs, at: totalMs === null ? null : at, fasesMs };
}

/** Reloj `m:ss` (o `h:mm:ss`), el formato de un cronómetro. */
export function formatReloj(ms: number | null | undefined): string {
  const value = Number(ms ?? 0);
  const total = Number.isFinite(value) && value > 0 ? Math.floor(value / 1000) : 0;
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const ss = String(segundos).padStart(2, "0");
  if (horas > 0) return `${horas}:${String(minutos).padStart(2, "0")}:${ss}`;
  return `${minutos}:${ss}`;
}

/**
 * Lo que falta según la apertura anterior. `null` cuando no hay con qué
 * estimar o cuando el transcurrido ya la superó: en ese caso no se inventa
 * una cifra nueva, se deja de prometer.
 */
export function restanteMs(estimacion: WarmupEstimacion, transcurridoMs: number): number | null {
  if (estimacion.totalMs === null) return null;
  const falta = estimacion.totalMs - Math.max(0, transcurridoMs);
  return falta >= 1000 ? falta : null;
}

export type RelojWarmup = {
  transcurrido: string;
  /** `~1:10`, o `null` si no hay estimación vigente. */
  restante: string | null;
  /** Duración de la apertura anterior, cuando ya no sirve como restante. */
  anterior: string | null;
};

export function relojWarmup(estimacion: WarmupEstimacion, transcurridoMs: number): RelojWarmup {
  const falta = restanteMs(estimacion, transcurridoMs);
  return {
    transcurrido: formatReloj(transcurridoMs),
    restante: falta === null ? null : `~${formatReloj(falta)}`,
    anterior: falta === null && estimacion.totalMs !== null ? formatReloj(estimacion.totalMs) : null,
  };
}

export type FaseEstado = "pending" | "running" | "ready" | "skipped" | "timeout" | "error";

/**
 * Rótulo corto de duración de una fase: la que tomó si terminó, la que lleva
 * si está en curso y la de la vez anterior (`~0:40`) si todavía espera.
 */
export function duracionFase({
  status,
  elapsedMs,
  inicioMs,
  ahoraMs,
  previaMs,
}: {
  status: FaseEstado;
  elapsedMs?: number | null;
  inicioMs?: number | null;
  ahoraMs: number;
  previaMs?: number | null;
}): string {
  if (status === "ready" || status === "error" || status === "timeout") {
    const ms = msPositivo(elapsedMs);
    // Una fase de menos de un segundo terminó: se lee «0:01», no «0:00».
    return ms === null ? "" : formatReloj(Math.max(1000, ms));
  }
  if (status === "running") {
    if (typeof inicioMs === "number" && Number.isFinite(inicioMs)) {
      return formatReloj(Math.max(0, ahoraMs - inicioMs));
    }
    return "";
  }
  if (status === "pending") {
    const ms = msPositivo(previaMs);
    return ms === null ? "" : `~${formatReloj(ms)}`;
  }
  return "";
}

// -----------------------------------------------------------------------------
// Estado del reloj de un warm start: cuándo empezó, con qué se estima y cuándo
// arrancó cada fase en curso. Un reducer en vez de tres `useState` sueltos.
// -----------------------------------------------------------------------------

export type TiempoWarmup = {
  inicioMs: number | null;
  estimacion: WarmupEstimacion;
  /** Momento en que cada fase se vio en curso por primera vez. */
  inicios: Record<string, number>;
};

export type AccionTiempoWarmup =
  | { tipo: "iniciar"; ahoraMs: number }
  | { tipo: "estimar"; estimacion: WarmupEstimacion }
  | { tipo: "fase"; id: string; ahoraMs: number }
  | { tipo: "reiniciar" };

export const TIEMPO_WARMUP_INICIAL: TiempoWarmup = {
  inicioMs: null,
  estimacion: SIN_ESTIMACION,
  inicios: {},
};

export function tiempoWarmupReducer(estado: TiempoWarmup, accion: AccionTiempoWarmup): TiempoWarmup {
  switch (accion.tipo) {
    case "iniciar":
      return { inicioMs: accion.ahoraMs, estimacion: SIN_ESTIMACION, inicios: {} };
    case "estimar":
      // Una estimación vacía no pisa una que ya se tenía (el plan llega antes
      // que el arranque del job y ambos la publican).
      if (accion.estimacion === SIN_ESTIMACION && estado.estimacion !== SIN_ESTIMACION) return estado;
      return { ...estado, estimacion: accion.estimacion };
    case "fase":
      if (!accion.id || accion.id in estado.inicios) return estado;
      return { ...estado, inicios: { ...estado.inicios, [accion.id]: accion.ahoraMs } };
    case "reiniciar":
      return TIEMPO_WARMUP_INICIAL;
    default:
      return estado;
  }
}
