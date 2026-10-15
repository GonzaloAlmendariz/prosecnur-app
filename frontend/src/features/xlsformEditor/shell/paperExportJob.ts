// =============================================================================
// shell/paperExportJob.ts — espera del job de exportación del formulario
// =============================================================================
// export-pdf y export-word dejaron de ser síncronos: devuelven un JobStart y el
// archivo sale de `result_data` del job. Aquí se envuelve el poller endurecido
// de la casa (`iniciarJobPoll`: reintentos, 404 de job perdido, timeout) en
// una promesa, porque `onExportForm` es un `await` secuencial (exportar →
// guardar en el proyecto → avisar). Dependencias inyectables para Vitest.
// =============================================================================

import { ApiError, type JobProgress, normalizeXlsformPaperExportResult, type XlsformPaperExportResult } from "../../../api/client";
import { iniciarJobPoll, type JobPollerDeps } from "../../../hooks/useJob";

/** Fase legible del job («Armando el modelo», «Dibujando», «Guardando»). */
export function faseDeExport(progress: JobProgress | Record<string, never> | null | undefined): string {
  if (!progress || typeof progress !== "object") return "";
  const raw = progress as JobProgress;
  return typeof raw.message === "string" ? raw.message.trim() : "";
}

/** Texto del `busy` del editor: «Exportando Word… Dibujando». */
export function textoExportando(label: string, fase: string): string {
  return fase ? `Exportando ${label}… ${fase}` : `Exportando ${label}…`;
}

export type EsperarExportOpciones = {
  onFase?: (fase: string) => void;
  pollDeps?: JobPollerDeps<unknown>;
};

export function esperarExportPapel(
  jobId: string,
  opciones: EsperarExportOpciones = {},
): Promise<XlsformPaperExportResult> {
  return new Promise<XlsformPaperExportResult>((resolve, reject) => {
    let stop: (() => void) | null = null;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
      // `stop` llega después del primer tick: si el job terminó en el primer
      // poll todavía es null aquí.
      queueMicrotask(() => stop?.());
    };
    stop = iniciarJobPoll<unknown>(
      jobId,
      (update) => {
        if (update.failure) {
          const message = update.failure.message;
          finish(() => reject(new Error(message)));
          return;
        }
        const snap = update.snapshot;
        if (!snap) return;
        if (snap.status === "running") {
          const fase = faseDeExport(snap.progress);
          if (fase) opciones.onFase?.(fase);
          return;
        }
        if (snap.status === "done") {
          try {
            const result = normalizeXlsformPaperExportResult(snap.result_data);
            finish(() => resolve(result));
          } catch (e) {
            finish(() => reject(e instanceof Error ? e : new ApiError("E_EXPORT_JOB_RESULT", String(e))));
          }
          return;
        }
        if (snap.status === "cancelled") {
          finish(() => reject(new Error("La exportación se canceló.")));
          return;
        }
        // status "error": el worker murió; el mensaje viaja en snap.error.
        const msg = typeof snap.error === "string" && snap.error.trim()
          ? snap.error
          : "La exportación terminó con error sin detalle. Reintenta.";
        finish(() => reject(new Error(msg)));
      },
      opciones.pollDeps,
    );
  });
}
