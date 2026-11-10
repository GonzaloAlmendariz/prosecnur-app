// Las salidas del Paso 1 de Instrumento (ADR 0133, fase 5): el plan de
// limpieza en Excel y el paquete metodológico (PDF + R en un ZIP), cada uno con
// `useGeneracion` del kit y su contenedor en bloque bajo la fila de acciones.
//
// El paquete es un job que todavía no registra su ZIP en el file store (no
// trae `file_id`): mientras el motor no lo haga, se espera el job y se baja el
// ZIP del resultado como archivo local. Si un día el resultado trae `file_id`,
// se usa ése (con su copia junto al proyecto).

import { apiV2InstrumentoExportPlan, apiV2MethodologyBundleArchivo, apiV2MethodologyReportBundle } from "../../../api/validacion";
import { archivoDesdeRespuesta } from "../../../components/entregables/archivoDesdeRespuesta";
import { ArchivoLocal } from "../../../components/entregables/archivoLocal";
import { useGeneracion, type Generacion, type ResultadoGeneracion } from "../../../components/entregables/useGeneracion";
import { iniciarJobPoll } from "../../../hooks/useJob";
import { MODULO_PROCESAMIENTO, NOMBRE_PAQUETE, NOMBRE_PLAN, TITULO_PAQUETE, TITULO_PLAN, conNombre, nombreDeDisposicion } from "./modeloEntrega";

export type EntregaInstrumento = Generacion & { enCurso: boolean };

/** El `result_data` de un job terminado; rechaza si falla, se cancela o se pierde. */
export function esperarJob(jobId: string): Promise<unknown> {
  return new Promise((resolver, rechazar) => {
    let detener: (() => void) | null = null;
    let listo = false;
    const fin = (accion: () => void) => {
      if (listo) return;
      listo = true;
      accion();
      queueMicrotask(() => detener?.());
    };
    detener = iniciarJobPoll<unknown>(jobId, (update) => {
      if (update.failure) {
        const mensaje = update.failure.message;
        fin(() => rechazar(new Error(mensaje)));
        return;
      }
      const snap = update.snapshot;
      if (!snap) return;
      if (snap.status === "done") fin(() => resolver(snap.result_data));
      else if (snap.status === "cancelled") fin(() => rechazar(new Error("La generación se canceló.")));
      else if (snap.status === "error") {
        const mensaje = typeof snap.error === "string" && snap.error.trim() ? snap.error.trim() : "El trabajo terminó sin detalle del error. Reintenta.";
        fin(() => rechazar(new Error(mensaje)));
      }
    });
  });
}

export function useEntregasInstrumento(baseNombre: string | null): {
  plan: EntregaInstrumento;
  paquete: EntregaInstrumento;
  exportarPlan: () => Promise<ResultadoGeneracion>;
  generarPaquete: () => Promise<ResultadoGeneracion>;
} {
  const plan = useGeneracion({ titulo: TITULO_PLAN, modulo: MODULO_PROCESAMIENTO, formato: "xlsx", articulo: "el" });
  const paquete = useGeneracion({ titulo: TITULO_PAQUETE, modulo: MODULO_PROCESAMIENTO, formato: "zip", articulo: "el" });
  const exportarPlan = () => plan.ejecutar(async () => conNombre(await apiV2InstrumentoExportPlan(baseNombre), NOMBRE_PLAN));
  const generarPaquete = () => paquete.ejecutar(async () => {
    const { job_id: jobId } = await apiV2MethodologyReportBundle(baseNombre);
    const datos = await esperarJob(jobId);
    if (archivoDesdeRespuesta(datos).length) return datos;
    const { blob, disposicion } = await apiV2MethodologyBundleArchivo(jobId);
    return new ArchivoLocal(blob, nombreDeDisposicion(disposicion) ?? NOMBRE_PAQUETE);
  });
  return {
    plan: { ...plan, enCurso: plan.estado.fase === "en_curso" },
    paquete: { ...paquete, enCurso: paquete.estado.fase === "en_curso" },
    exportarPlan,
    generarPaquete,
  };
}
