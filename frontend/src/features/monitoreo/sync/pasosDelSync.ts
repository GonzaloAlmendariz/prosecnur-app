/**
 * «Actualizando, paso N de M» (estándar de Monitoreo §2a y §2b, L38).
 *
 * El job de sync escribe `step`/`steps` en su archivo de progreso
 * (`job_progress_writer` en `api/R/jobs.R`): las N fuentes son los pasos 1..N y
 * el paso N + 1 une el snapshot y recalcula. Las fases que vienen después del
 * worker (`merge`, `metadata`, `save`) no los repiten, así que el paso se
 * conserva: nunca retrocede y nunca se inventa. Sin `step`/`steps` —un backend
 * anterior— la píldora dice «Actualizando», sin número.
 */

export type ProgresoDelSync = {
  percent: number | null;
  phase: string;
  message: string;
  paso?: number;
  pasos?: number;
};

function entero(valor: unknown): number | null {
  const n = typeof valor === "string" ? Number(valor.trim()) : Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Lee el progreso crudo de `/api/jobs/:id`; `null` si no trae nada legible. */
export function normalizarProgresoDelJob(crudo: unknown): ProgresoDelSync | null {
  if (!crudo || typeof crudo !== "object") return null;
  const raw = crudo as Record<string, unknown>;
  if (!("phase" in raw) && !("percent" in raw) && !("message" in raw) && !("step" in raw)) return null;
  const percent = Number(raw.percent);
  const progreso: ProgresoDelSync = {
    percent: raw.percent != null && Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : null,
    phase: typeof raw.phase === "string" ? raw.phase : "",
    message: typeof raw.message === "string" ? raw.message : "",
  };
  const paso = entero(raw.step);
  const pasos = entero(raw.steps);
  if (paso != null && pasos != null && paso <= pasos) {
    progreso.paso = paso;
    progreso.pasos = pasos;
  }
  return progreso;
}

/**
 * Une el progreso nuevo con el anterior: el porcentaje y el paso no
 * retroceden, y un tick sin paso conserva el último conocido.
 */
export function fusionarProgreso(previo: ProgresoDelSync | null, siguiente: ProgresoDelSync): ProgresoDelSync {
  const percent = siguiente.percent == null
    ? previo?.percent ?? null
    : Math.max(previo?.percent ?? 0, siguiente.percent);
  const fusion: ProgresoDelSync = {
    percent,
    phase: siguiente.phase || previo?.phase || "",
    message: siguiente.message || previo?.message || "",
  };
  const mismoTotal = previo?.pasos != null && siguiente.pasos != null && previo.pasos === siguiente.pasos;
  if (siguiente.paso != null && siguiente.pasos != null) {
    fusion.paso = mismoTotal ? Math.max(previo?.paso ?? 0, siguiente.paso) : siguiente.paso;
    fusion.pasos = siguiente.pasos;
  } else if (previo?.paso != null && previo.pasos != null) {
    fusion.paso = previo.paso;
    fusion.pasos = previo.pasos;
  }
  return fusion;
}
