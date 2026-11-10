// El job de "Confirmar y adaptar respuestas", seguido fuera del componente
// (ADR 0133, fase 5). Reemplaza a `JobProgress`: el avance va al contenedor de
// entregables (una sola señal en movimiento) y a la bandeja "Entregables".
//
// Vive fuera de React por la misma razón que `aplicarCodificacion`: al terminar
// el job la página remonta Adaptar, y cambiar de pestaña también lo desmonta.
// Un job se sigue una sola vez aunque el panel se monte varias veces; el
// resultado llega al store keyed por base aunque nadie lo esté mirando.

import { apiJobCancel } from "../../../api/jobs";
import { useBandejaEntregables } from "../../../components/entregables/bandejaStore";
import { avanceDelJob } from "../../../components/entregables/generacionModelo";
import { iniciarJobPoll } from "../../../hooks/useJob";
import { useAplicarAvisosStore } from "../aplicarAvisosStore";
import { MODULO_PROCESAMIENTO, TITULO_ADAPTACION, archivosDeAdaptacion, estadoDeAdaptacion, type EntradaAdaptacion } from "./modeloEntrega";

const seguidos = new Set<string>();

export type AlTerminarAdaptacion = () => void;

/** Cancela el job de adaptación: el poll recibe `cancelled` y limpia la entrada. */
export function cancelarAdaptacion(jobId: string): void {
  void apiJobCancel(jobId).catch(() => undefined);
}

function idEnBandeja(jobId: string): string {
  return `codificacion-adaptar-${jobId}`;
}

function entradaDe(clave: string): EntradaAdaptacion {
  const e = useAplicarAvisosStore.getState().porBase[clave];
  return {
    aplicando: e?.aplicando ?? false,
    jobId: e?.jobId ?? null,
    avance: e?.avance ?? null,
    archivos: e?.salida?.archivos ?? null,
    error: e?.error ?? "",
    entregaCerrada: false,
  };
}

/** Copia el estado de la entrada a la bandeja (la bandeja no tiene "Cancelar" ni "Reintentar" propios). */
function reflejarEnBandeja(clave: string, jobId: string): void {
  const estado = estadoDeAdaptacion(entradaDe(clave), { cancelar: () => cancelarAdaptacion(jobId) });
  if (estado.fase === "inactiva") {
    useBandejaEntregables.getState().quitar(idEnBandeja(jobId));
    return;
  }
  useBandejaEntregables.getState().actualizar(idEnBandeja(jobId), estado);
}

/** Sigue el job de una base hasta el final; la segunda llamada con el mismo job no hace nada. */
export function seguirAdaptacion(clave: string, jobId: string, alTerminar: AlTerminarAdaptacion): void {
  if (seguidos.has(jobId)) return;
  seguidos.add(jobId);
  const store = () => useAplicarAvisosStore.getState();
  useBandejaEntregables.getState().registrar({
    id: idEnBandeja(jobId),
    modulo: MODULO_PROCESAMIENTO,
    estado: { fase: "en_curso", titulo: TITULO_ADAPTACION, formato: "xlsx", porcentaje: null },
    inicio: Date.now(),
  });
  let detener: (() => void) | null = null;
  let terminado = false;
  const cerrar = (accion: () => void) => {
    if (terminado) return;
    terminado = true;
    accion();
    reflejarEnBandeja(clave, jobId);
    queueMicrotask(() => detener?.());
  };
  detener = iniciarJobPoll<unknown>(jobId, (update) => {
    if (update.failure) {
      const mensaje = update.failure.message;
      cerrar(() => store().fallar(clave, mensaje));
      return;
    }
    const snap = update.snapshot;
    if (!snap) return;
    if (snap.status === "running") {
      store().avanzar(clave, jobId, avanceDelJob(snap.progress));
      reflejarEnBandeja(clave, jobId);
    } else if (snap.status === "done") {
      const archivos = archivosDeAdaptacion(snap.result_data);
      cerrar(() => {
        if (archivos.length) {
          store().terminar(clave, { archivos });
          alTerminar();
        } else {
          store().fallar(clave, "La adaptación terminó sin devolver sus archivos. Reintenta.");
        }
      });
    } else if (snap.status === "error") {
      const mensaje = typeof snap.error === "string" && snap.error.trim()
        ? snap.error.trim()
        : "La adaptación terminó sin detalle del error. Reintenta.";
      cerrar(() => store().fallar(clave, mensaje));
    } else if (snap.status === "cancelled") {
      cerrar(() => store().cancelar(clave));
    }
  });
}

/** Sólo para tests: olvida los jobs seguidos. */
export function olvidarAdaptacionesSeguidas(): void {
  seguidos.clear();
}
