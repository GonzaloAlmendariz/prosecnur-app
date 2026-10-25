import { apiMonitoreoTerritorialOccurrencesSync } from "../../../../../api/monitoreo";
import {
  lanzarPorDefecto,
  type LanzadorDeActualizacion,
} from "../../../sync/ejecutarActualizacion";
import type { ProgresoDelSync } from "../../../sync/pasosDelSync";
import type { OcurrenciasDelPlan } from "./planTerritorial";

/**
 * Cómo lanza Territorial lo que pide su «Actualizar ▾».
 *
 * El Kobo de cada fase y la hoja de ruta van por el camino común
 * (`/api/monitoreo/sync` y `/api/monitoreo/sheets/sync`). Las ocurrencias de
 * campo no: el backend las lee en `/api/monitoreo/territorial/occurrences/sync`,
 * una llamada directa sin job. Antes el cuerpo las disparaba aparte, sin
 * esperar ni avisar, y un fallo se perdía; ahora van primero —el Plumber
 * mono-hilo ya las atendía antes que el job— y su resultado entra al recibo.
 *
 * Los pasos: las ocurrencias son el paso 1 y los del job (una fuente por paso
 * más el recálculo, de `monitoreo_sync_sources`) se corren uno. Mientras corren
 * las ocurrencias, el total se anticipa con la misma regla del motor (fuentes
 * + 1); cuando el job publica el suyo, manda el del job.
 */

type FilaDelResumen = { source_id?: string; source_label: string; mode: string; rows: number };
type ErrorDeFuente = { source_id?: string; source_label: string; message: string };

function filasDe(crudo: unknown): unknown[] {
  if (!crudo || typeof crudo !== "object") return [];
  return Array.isArray(crudo) ? crudo : Object.values(crudo as Record<string, unknown>);
}

export function crearLanzadorTerritorial(ocurrencias: OcurrenciasDelPlan | null): LanzadorDeActualizacion {
  return async (peticion, herramientas) => {
    if (peticion.tipo !== "sync" || !ocurrencias || !peticion.fuentes.includes(ocurrencias.id)) {
      return lanzarPorDefecto(peticion, herramientas);
    }
    const kobo = peticion.fuentes.filter((id) => id !== ocurrencias.id);
    const pasosPrevistos = kobo.length ? kobo.length + 2 : 1;
    herramientas.reportar({
      percent: 4,
      phase: "Ocurrencias",
      message: "Trayendo las ocurrencias de campo...",
      paso: 1,
      pasos: pasosPrevistos,
    });

    const resumen: FilaDelResumen[] = [];
    const errores: ErrorDeFuente[] = [];
    try {
      const traidas = await apiMonitoreoTerritorialOccurrencesSync({
        ...(ocurrencias.source_id ? { source_id: ocurrencias.source_id } : {}),
        ...(ocurrencias.asset_uid ? { asset_uid: ocurrencias.asset_uid } : {}),
      });
      resumen.push({ source_id: ocurrencias.id, source_label: ocurrencias.etiqueta, mode: "full", rows: Number(traidas.n_rows) });
    } catch (e) {
      // Sin token o sin formulario: el avance de Kobo sigue, y el recibo lo dice.
      errores.push({ source_id: ocurrencias.id, source_label: ocurrencias.etiqueta, message: (e as Error).message });
    }
    if (herramientas.cancelado()) throw new Error("La sincronización continúa en segundo plano.");
    if (!kobo.length) return { tipo: "sync", resultado: { sync_summary: resumen, errors: errores } };

    const correrUno = (progreso: ProgresoDelSync): ProgresoDelSync => (
      progreso.paso != null && progreso.pasos != null
        ? { ...progreso, paso: progreso.paso + 1, pasos: progreso.pasos + 1 }
        : progreso
    );
    const delJob = await lanzarPorDefecto(
      { ...peticion, fuentes: kobo },
      { ...herramientas, reportar: (progreso) => herramientas.reportar(correrUno(progreso)) },
    );
    const crudo = delJob.resultado && typeof delJob.resultado === "object" ? delJob.resultado as Record<string, unknown> : {};
    return {
      tipo: "sync",
      resultado: {
        ...crudo,
        sync_summary: [...resumen, ...filasDe(crudo.sync_summary)],
        errors: [...errores, ...(Array.isArray(crudo.errors) ? crudo.errors : [])],
      },
    };
  };
}
