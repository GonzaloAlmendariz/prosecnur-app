// Vista previa de la lámina activa como job (F6 §5.3, riesgo 7; contrato docs/qa/contrato-miniaturas-preview-f6-2026-10-11.md
// §2.2). El render en LibreOffice tarda 5–18 s; con `/preview-slide` síncrono, Plumber (mono-hilo) quedaba bloqueado ese
// tiempo. Aquí se lanza `POST /preview-slide-job`, se pollea `/api/jobs/<id>` con el poller endurecido de `useJob` y al
// `done` se devuelve `result_data`, que es exactamente la respuesta del síncrono.
//
// - Abortar (el coordinador reemplaza o cancela) detiene el poll y pide cancelar el job (best-effort; el backend además
//   cancela el job anterior de la misma lámina al recibir uno nuevo).
// - Si el endpoint del job no existe (404: backend anterior a A4) se cae al síncrono y se recuerda para los pedidos
//   siguientes. Cualquier otro error se propaga tal cual.
// Puro y con dependencias inyectables: tests en previewPorJob.test.ts.

import { ApiError } from "../../../../api/core";
import type { PreviewSlideOptions, PreviewSlideResponse, Slide } from "../../../../api/graficos";
import { jobResultDomainError, type JobProgress, type JobSnapshot } from "../../../../api/jobs";
import type { PreviewSlideJobStart } from "../../../../api/graficosMiniaturas";
import type { JobPollUpdate } from "../../../../hooks/useJob";

export type ProgresoPreview = {
  /** Texto corto del backend («Lámina s-… (1 de 1)») o uno propio mientras arranca. */
  mensaje: string;
  /** 0–100 cuando el backend lo informa; null si sólo se sabe que está corriendo. */
  porcentaje: number | null;
};

export type DepsPreviewPorJob = {
  lanzar: (slide: Slide, config: unknown, options: PreviewSlideOptions, request: { signal: AbortSignal }) => Promise<PreviewSlideJobStart>;
  sincrono: (slide: Slide, config: unknown, options: PreviewSlideOptions, request: { signal: AbortSignal }) => Promise<PreviewSlideResponse>;
  /** `iniciarJobPoll` de hooks/useJob (devuelve la función de parada). */
  poll: (jobId: string, onUpdate: (u: JobPollUpdate<PreviewSlideResponse>) => void) => () => void;
  cancelar: (jobId: string) => Promise<unknown>;
};

export type PedidoPreview = {
  slide: Slide;
  config: unknown;
  options: PreviewSlideOptions;
  signal: AbortSignal;
  onProgreso?: (p: ProgresoPreview) => void;
};

/** ¿El POST del job respondió que la ruta no existe? (Plumber: `E_NOT_FOUND`; proxies: `HTTP_404`). */
export function esRutaInexistente(e: unknown): boolean {
  return e instanceof ApiError && (e.code === "E_NOT_FOUND" || e.code === "HTTP_404");
}

/**
 * Avance del job de vista previa. Un job de UNA lámina (`total ≤ 1`) no tiene avance intermedio: el worker escribe
 * `current = 0, total = 1` (y `percent = 0`) durante todo el render, así que un porcentaje ahí sería un «0 %» fijo que
 * miente. Sin unidades intermedias se informa sólo que está corriendo (`porcentaje: null`).
 */
export function progresoDeJob(p: JobProgress | Record<string, never> | null | undefined): ProgresoPreview {
  const prog = (p ?? {}) as JobProgress;
  const total = Number(prog.total);
  const actual = Number(prog.current);
  const pct = Number(prog.percent);
  const mensaje = prog.phase === "done" ? "Listo" : "Dibujando la lámina";
  if (Number.isFinite(total) && total <= 1) return { mensaje, porcentaje: null };
  if (prog.phase === "done") return { mensaje, porcentaje: 100 };
  const porcentaje = Number.isFinite(pct)
    ? Math.max(0, Math.min(100, pct))
    : Number.isFinite(total) && total > 0 && Number.isFinite(actual) ? Math.max(0, Math.min(100, (actual / total) * 100)) : null;
  return { mensaje, porcentaje };
}

const abortada = () => new DOMException("La vista previa se reemplazó por otra.", "AbortError");

export function crearCargaPreviewPorJob(deps: DepsPreviewPorJob) {
  // Se recuerda por instancia (una por app): un backend sin la ruta no la gana a mitad de sesión.
  let jobDisponible = true;

  return async function cargar({ slide, config, options, signal, onProgreso }: PedidoPreview): Promise<PreviewSlideResponse> {
    if (signal.aborted) throw abortada();
    if (!jobDisponible) return deps.sincrono(slide, config, options, { signal });

    let inicio: PreviewSlideJobStart;
    try {
      onProgreso?.({ mensaje: "En cola", porcentaje: null });
      inicio = await deps.lanzar(slide, config, options, { signal });
    } catch (e) {
      if (esRutaInexistente(e)) {
        jobDisponible = false;
        return deps.sincrono(slide, config, options, { signal });
      }
      throw e;
    }
    const jobId = inicio.job_id;
    if (signal.aborted) {
      void deps.cancelar(jobId).catch(() => undefined);
      throw abortada();
    }

    return new Promise<PreviewSlideResponse>((resolver, rechazar) => {
      let parar: (() => void) | null = null;
      let terminado = false;
      const cerrar = () => {
        terminado = true;
        signal.removeEventListener("abort", alAbortar);
        parar?.();
      };
      function alAbortar() {
        if (terminado) return;
        cerrar();
        void deps.cancelar(jobId).catch(() => undefined);
        rechazar(abortada());
      }
      signal.addEventListener("abort", alAbortar);

      const detener = deps.poll(jobId, (u) => {
        if (terminado) return;
        if (u.failure) { cerrar(); rechazar(new Error(u.failure.message)); return; }
        const snap: JobSnapshot<PreviewSlideResponse> | undefined = u.snapshot;
        if (!snap) return;
        if (snap.status === "running") { onProgreso?.(progresoDeJob(snap.progress)); return; }
        cerrar();
        if (snap.status === "done") {
          const datos = snap.result_data;
          const errorDominio = jobResultDomainError(datos);
          if (errorDominio) { rechazar(new ApiError(errorDominio.code, errorDominio.message)); return; }
          if (!datos || typeof datos !== "object" || !("file_id" in datos)) {
            rechazar(new Error("La vista previa terminó sin resultado. Reintenta."));
            return;
          }
          // El job es de una lámina: un «100 %» entre el done y la imagen sería el mismo número que miente (ver arriba).
          onProgreso?.({ mensaje: "Listo", porcentaje: null });
          resolver(datos as PreviewSlideResponse);
          return;
        }
        if (snap.status === "cancelled") { rechazar(new Error("La vista previa se canceló. Reintenta.")); return; }
        const detalle = typeof snap.error === "string" ? snap.error.trim() : "";
        rechazar(new Error(detalle ? `No se pudo generar la vista previa: ${detalle}` : "No se pudo generar la vista previa. Reintenta."));
      });
      // Si el poll terminó de forma síncrona (tests), `cerrar` ya corrió con `parar` nulo: pararlo ahora.
      if (terminado) detener();
      else parar = detener;
    });
  };
}
