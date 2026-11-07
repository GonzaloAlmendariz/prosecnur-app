// La propuesta del motor como job (H13: tardaba de 25 a 60 s síncrona y dejaba a Plumber tomado). Se lanza
// `POST /api/graficos/resumenes/propuesta/job`, se sigue con el poller de `useJob` y al `done` `result_data` es la
// respuesta del síncrono. Mismo patrón que la vista previa (miniaturas/previewPorJob.ts):
// - abortar corta el poll y pide cancelar el job (best-effort);
// - un error de dominio en `result_data` (`{ok: false, error}`) se lanza como ApiError, para que el hook lo diga igual
//   que el del síncrono;
// - si la ruta del job no existe (backend anterior) se cae al síncrono y se recuerda para los pedidos siguientes.
// Puro y con dependencias inyectables: tests en propuestaPorJob.test.ts.

import { ApiError } from "../../../../api/core";
import {
  normalizarPropuestaResumen,
  type PedidoPropuesta,
  type PropuestaResumen,
  type PropuestaResumenJobStart,
} from "../../../../api/graficosPropuesta";
import { jobResultDomainError } from "../../../../api/jobs";
import type { JobPollUpdate } from "../../../../hooks/useJob";
import { esRutaInexistente } from "../miniaturas/previewPorJob";

export type DepsPropuestaPorJob = {
  lanzar: (pedido: PedidoPropuesta) => Promise<PropuestaResumenJobStart>;
  sincrono: (pedido: PedidoPropuesta) => Promise<PropuestaResumen>;
  /** `iniciarJobPoll` de hooks/useJob (devuelve la función de parada). */
  poll: (jobId: string, onUpdate: (u: JobPollUpdate<unknown>) => void) => () => void;
  cancelar: (jobId: string) => Promise<unknown>;
};

const abortada = () => new DOMException("La propuesta se reemplazó por otra.", "AbortError");

export function crearCargaPropuestaPorJob(deps: DepsPropuestaPorJob) {
  // Se recuerda por instancia (una por app): un backend sin la ruta no la gana a mitad de sesión.
  let jobDisponible = true;

  return async function cargar(pedido: PedidoPropuesta & { signal: AbortSignal }): Promise<PropuestaResumen> {
    const { signal } = pedido;
    if (signal.aborted) throw abortada();
    if (!jobDisponible) return deps.sincrono(pedido);

    let inicio: PropuestaResumenJobStart;
    try {
      inicio = await deps.lanzar(pedido);
    } catch (e) {
      if (esRutaInexistente(e)) {
        jobDisponible = false;
        // Reemplazado mientras se lanzaba: no se pide el síncrono de un pedido que ya nadie espera.
        if (signal.aborted) throw abortada();
        return deps.sincrono(pedido);
      }
      throw e;
    }
    const { jobId } = inicio;
    if (signal.aborted) {
      void deps.cancelar(jobId).catch(() => undefined);
      throw abortada();
    }

    return new Promise<PropuestaResumen>((resolver, rechazar) => {
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
        const snap = u.snapshot;
        if (!snap || snap.status === "running") return;
        cerrar();
        if (snap.status === "done") {
          const error = jobResultDomainError(snap.result_data);
          if (error) { rechazar(new ApiError(error.code, error.message)); return; }
          if (!snap.result_data || typeof snap.result_data !== "object") {
            rechazar(new Error("La propuesta terminó sin resultado. Reintenta."));
            return;
          }
          resolver(normalizarPropuestaResumen(snap.result_data));
          return;
        }
        if (snap.status === "cancelled") { rechazar(new Error("La propuesta se canceló. Reintenta.")); return; }
        const detalle = typeof snap.error === "string" ? snap.error.trim() : "";
        rechazar(new Error(detalle ? `El motor no pudo armar la propuesta: ${detalle}` : "El motor no pudo armar la propuesta. Reintenta."));
      });
      // Si el poll terminó de forma síncrona (cache o tests), `cerrar` ya corrió con `parar` nulo: pararlo ahora.
      if (terminado) detener();
      else parar = detener;
    });
  };
}
