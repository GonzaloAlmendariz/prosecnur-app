/**
 * Polling de jobs largos de Cálculo de muestra (comparar métodos, sorteo de
 * cursos-horario, reportes). Lógica extraída de CalcMuestraPage para poder
 * testearla sin montar la página, con dos endurecimientos (F6):
 *
 *  - 404: los jobs viven en memoria del backend; tras un reinicio el job ya
 *    no existe y el 404 era tratado como transitorio PARA SIEMPRE. Ahora N
 *    404 consecutivos cortan con un mensaje claro.
 *  - Si se fija un techo de tiempo explícito, al rendirse se pide la
 *    cancelación del job (best-effort) para no dejar el worker huérfano.
 *
 * EL RELOJ YA NO MATA EL TRABAJO (decisión de Gonzalo, 2026-08-21). Antes el
 * polling se rendía a los 30 minutos y, al hacerlo, cancelaba el job. Medido
 * con los archivos reales: comparar los cuatro métodos sobre un marco de 3.490
 * cursos-horario tarda ~75 minutos, así que el techo cancelaba trabajo bueno
 * justo en los marcos de tamaño normal —«lo normal es que salgan entre 3.500 y
 * 4.500 cursos-horario»—. Su instrucción, textual: «si la comparación dura
 * mucho mucho tiempo, y hay un tope, bueno, hay que admitir que pase el tope,
 * no pasa nada. La idea es de que el contador sea honesto con cómo vamos».
 *
 * De ahí las dos mitades de este módulo: el proceso termina cuando el backend
 * dice que terminó —o cuando el usuario cancela—, y mientras tanto el contador
 * declara el avance real, lo que falta y que lleva más de lo previsto.
 */
import { ApiError, apiJobCancel, apiJobStatus, type JobSnapshot } from "../../../api/client";

export const CM_JOB_POLL_INTERVAL_MS = 1500;
/**
 * Ritmo de preguntas cuando el trabajo ya se hizo largo. Un job de una hora no
 * necesita 40 preguntas por minuto: pasado el umbral, se espacia.
 */
export const CM_JOB_POLL_INTERVAL_LARGO_MS = 5000;
export const CM_JOB_ESPACIAR_TRAS_MS = 5 * 60_000;
/**
 * A partir de aquí el proceso lleva más de lo previsto. NO se mata: se dice.
 * Es la diferencia entre un contador honesto y uno que calla.
 */
export const CM_JOB_AVISO_LARGO_MS = 30 * 60_000;
/**
 * Techo duro heredado. Sigue disponible para quien quiera fijarlo a mano
 * (`timeoutMs`), pero ya NO es el comportamiento por defecto de `esperarJob`.
 */
export const CM_JOB_POLL_TIMEOUT_MS = 30 * 60_000;
/** 404 consecutivos tolerados antes de dar el job por perdido (backend reiniciado). */
export const CM_JOB_MAX_NOT_FOUND = 5;

export function cmFormatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Fases en las que la fracción publicada mide el trabajo COMPLETO del job.
 *
 * El resto de fases cuentan una etapa: el comparador publica «corrida 8 de 17»
 * dentro de CADA método y hay cuatro, así que extrapolar esa fracción da el
 * fin del método, no el de la comparación. Prometerlo como total sería un
 * contador deshonesto por cuatro — justo lo contrario de lo que este módulo
 * arregló hoy.
 *
 * La lista es corta y explícita a propósito: ante una fase desconocida se
 * asume ETAPA, que como mucho subestima lo que falta en vez de prometer un
 * final que no llega.
 */
const CM_FASES_DEL_TOTAL = new Set(["comparar", "construir", "seleccionar"]);

export function cmJobFase(snap: JobSnapshot): string | null {
  const p = snap.progress;
  if (!p || typeof p !== "object") return null;
  const fase = (p as Record<string, unknown>).phase;
  return typeof fase === "string" && fase.trim() ? fase.trim() : null;
}

/** true si lo que falta, según la fracción publicada, es el job entero. */
export function cmFraccionEsDelTotal(snap: JobSnapshot): boolean {
  const fase = cmJobFase(snap);
  return fase != null && CM_FASES_DEL_TOTAL.has(fase);
}

export function cmJobStageMessage(snap: JobSnapshot): string | null {
  const progress = snap.progress;
  if (progress && typeof progress === "object" && "message" in progress && typeof progress.message === "string" && progress.message) {
    return progress.message;
  }
  return null;
}

/**
 * Qué fracción del trabajo va hecha, entre 0 y 1, o null si el job no lo
 * declara. Se lee de `percent` y, si no viene, de `current/total` — el motor
 * escribe cualquiera de las dos (job_progress_writer en api/R/jobs.R).
 */
export function cmJobFraccion(snap: JobSnapshot): number | null {
  const p = snap.progress;
  if (!p || typeof p !== "object") return null;
  const pct = (p as Record<string, unknown>).percent;
  if (typeof pct === "number" && Number.isFinite(pct) && pct >= 0) {
    return Math.min(1, pct / 100);
  }
  const current = (p as Record<string, unknown>).current;
  const total = (p as Record<string, unknown>).total;
  if (typeof current === "number" && typeof total === "number" && total > 0 && current >= 0) {
    return Math.min(1, current / total);
  }
  return null;
}

/**
 * Cuánto falta, en milisegundos, extrapolando el ritmo medio hasta ahora.
 *
 * Devuelve null mientras la estimación no valga nada: sin fracción declarada,
 * recién arrancado (los primeros segundos incluyen la carga de los datos y
 * darían un número absurdo), o ya terminado. Es una estimación y el texto la
 * presenta como tal — no se anuncia un minuto exacto que el motor no prometió.
 */
export function cmJobEta(elapsedMs: number, fraccion: number | null): number | null {
  if (fraccion === null) return null;
  if (fraccion < 0.02 || fraccion >= 1) return null;
  if (elapsedMs < 20_000) return null;
  return Math.max(0, Math.round((elapsedMs * (1 - fraccion)) / fraccion));
}

/**
 * La línea que ve el usuario mientras espera: qué se está haciendo, en qué va,
 * cuánto lleva, cuánto falta y —si se pasó de lo previsto— que sigue vivo.
 */
export function cmTextoProgreso(args: {
  label: string;
  stage: string | null;
  elapsedMs: number;
  fraccion: number | null;
  /** true si la fracción mide el job entero; false si mide una etapa. */
  fraccionEsDelTotal?: boolean;
  avisoLargoMs?: number;
}): string {
  const { label, stage, elapsedMs, fraccion } = args;
  const avisoLargoMs = args.avisoLargoMs ?? CM_JOB_AVISO_LARGO_MS;
  const partes = [`${label}${stage ? ` — ${stage}` : ""}`, cmFormatElapsed(elapsedMs)];
  const eta = cmJobEta(elapsedMs, fraccion);
  // Se dice de QUÉ falta ese tiempo. Un «faltan ~00:48» junto a «corrida 8 de
  // 17» se lee como el fin del trabajo, y son las 17 de UN método de cuatro.
  if (eta !== null) {
    partes.push(
      args.fraccionEsDelTotal
        ? `faltan ~${cmFormatElapsed(eta)}`
        : `~${cmFormatElapsed(eta)} en esta etapa`,
    );
  }
  if (elapsedMs > avisoLargoMs) {
    partes.push(`más de ${Math.round(avisoLargoMs / 60_000)} min, sigue trabajando`);
  }
  return partes.join(" · ");
}

export function cmJobErrorText(snap: JobSnapshot): string {
  return typeof snap.error === "string" && snap.error
    ? snap.error
    : "el proceso terminó con error en el worker.";
}

// Error de control: el usuario canceló el job deliberadamente (no es un fallo
// del worker). Se distingue para mostrar un estado limpio "Cancelado" en vez
// del banner rojo de error.
export class JobCancelledError extends Error {
  constructor(label: string) {
    super(`${label}: cancelado por el usuario.`);
    this.name = "JobCancelledError";
  }
}

/** true si el error es el 404 de un job que ya no existe en el backend. */
export function esJobNoEncontrado(e: unknown): boolean {
  return e instanceof ApiError && (e.code === "E_JOB_NOT_FOUND" || e.code === "HTTP_404");
}

export type EsperarJobOpciones = {
  /** true cuando el usuario pidió cancelar: el loop corta en el próximo tick. */
  cancelRequested?: () => boolean;
  /** Recibe la línea de progreso lista para el banner. */
  onProgress?: (texto: string) => void;
  /** Inyectables para tests (por defecto: API real, Date.now y setTimeout). */
  status?: (jobId: string) => Promise<JobSnapshot>;
  cancel?: (jobId: string) => Promise<unknown>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /**
   * Techo duro OPCIONAL. Por defecto no hay: el trabajo termina cuando el
   * backend dice que terminó o cuando el usuario cancela, nunca por reloj.
   */
  timeoutMs?: number;
  intervalMs?: number;
  /** Ritmo espaciado una vez que el trabajo se hizo largo. */
  intervalLargoMs?: number;
  espaciarTrasMs?: number;
  avisoLargoMs?: number;
  maxNotFound?: number;
};

/**
 * Espera un job del backend polleando GET /api/jobs/<id>. Resuelve con el
 * snapshot "done"; lanza JobCancelledError si el usuario canceló o el backend
 * reporta "cancelled", y Error con el mensaje real del worker si falla o si el
 * job desapareció del backend (404 consecutivos). Sólo se rinde por tiempo si
 * quien llama fija un `timeoutMs` explícito, y en ese caso cancela el job.
 */
export async function esperarJob(
  jobId: string,
  label: string,
  opciones: EsperarJobOpciones = {},
): Promise<JobSnapshot> {
  const status = opciones.status ?? apiJobStatus;
  const cancel = opciones.cancel ?? apiJobCancel;
  const sleep = opciones.sleep ?? ((ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));
  const now = opciones.now ?? Date.now;
  const timeoutMs = opciones.timeoutMs ?? Infinity;
  const intervalMs = opciones.intervalMs ?? CM_JOB_POLL_INTERVAL_MS;
  const intervalLargoMs = opciones.intervalLargoMs ?? CM_JOB_POLL_INTERVAL_LARGO_MS;
  const espaciarTrasMs = opciones.espaciarTrasMs ?? CM_JOB_ESPACIAR_TRAS_MS;
  const avisoLargoMs = opciones.avisoLargoMs ?? CM_JOB_AVISO_LARGO_MS;
  const maxNotFound = opciones.maxNotFound ?? CM_JOB_MAX_NOT_FOUND;
  const start = now();
  let notFoundSeguidos = 0;
  for (;;) {
    // El usuario pidió cancelar: cortamos el polling de inmediato (el backend
    // sigue abortando el worker en su tiempo) y señalamos cancelación limpia.
    if (opciones.cancelRequested?.()) throw new JobCancelledError(label);
    const transcurrido = now() - start;
    if (Number.isFinite(timeoutMs) && transcurrido > timeoutMs) {
      // Techo pedido a mano: no abandonar sin cancelar — si el polling se
      // rinde, el job también, para no dejar el worker huérfano.
      try {
        await cancel(jobId);
      } catch {
        // Best-effort: si el cancel no llega, al menos dejamos de pollear.
      }
      throw new Error(
        `${label}: superó los ${Math.round(timeoutMs / 60_000)} minutos de espera. Se pidió cancelar el job en el backend; revisa su estado y reintenta.`,
      );
    }
    let snap: JobSnapshot | null = null;
    try {
      snap = await status(jobId);
      notFoundSeguidos = 0;
    } catch (e) {
      if (esJobNoEncontrado(e)) {
        // F6: un 404 aislado puede ser transitorio, pero N seguidos significan
        // que el job ya no existe (los jobs viven en memoria del backend).
        notFoundSeguidos += 1;
        if (notFoundSeguidos >= maxNotFound) {
          throw new Error(`${label}: el backend se reinició y el job ya no existe. Vuelve a lanzar el proceso.`);
        }
      }
      // Otros errores de red/backend: transitorios, se reintenta en el próximo tick.
    }
    if (snap) {
      if (snap.status === "done") return snap;
      if (snap.status === "cancelled") throw new JobCancelledError(label);
      if (snap.status === "error") {
        throw new Error(`${label}: ${cmJobErrorText(snap)}`);
      }
      opciones.onProgress?.(
        cmTextoProgreso({
          label,
          stage: cmJobStageMessage(snap),
          elapsedMs: now() - start,
          fraccion: cmJobFraccion(snap),
          fraccionEsDelTotal: cmFraccionEsDelTotal(snap),
          avisoLargoMs,
        }),
      );
    }
    await sleep(transcurrido > espaciarTrasMs ? intervalLargoMs : intervalMs);
  }
}
