// monitoreoRechazos.ts — rechazo auditado de un paquete de subsanación sugerido
// (Monitoreo › Territorial › Control › Subsanaciones, §3.11).
//
// Contrato (`api/R/monitoreo_territorial_rechazos.R`):
//   GET  /api/monitoreo/territorial/subsanaciones/rechazos?phase=
//   POST /api/monitoreo/territorial/subsanaciones/rechazar
// El rechazo guarda nota, autor y fecha. `clave_paquete` identifica el paquete
// por lo que mueve; si el motor vuelve a sugerirlo, la UI lo marca.

import { apiFetch, handle, headers } from "./core";
import type { MonitoreoTerritorialOperationalAdjustment, MonitoreoTerritorialPhase } from "./monitoreo";
import { enteroONulo, lista, registro, texto } from "./normalizarR";

export type RechazoDeSubsanacion = {
  id: string;
  fase: string;
  clavePaquete: string;
  sugerenciaId: string;
  sourceBlockId: string;
  targetBlockId: string;
  sourceUmp: string;
  targetUmp: string;
  sex: string;
  ageGroup: string;
  casos: number | null;
  nota: string;
  autor: string;
  fecha: string;
};

/**
 * La misma receta que `monitoreo_territorial_rechazo_clave_paquete` en R:
 * bloque origen, bloque destino, sexo y edad de cada movimiento, ordenados.
 */
export function claveDePaquete(ajuste: MonitoreoTerritorialOperationalAdjustment): string {
  const movimientos = ajuste.adjustments?.length ? ajuste.adjustments : [ajuste];
  return movimientos
    .map((mov) => [
      String(mov.source_block_id || ajuste.source_block_id || "").trim(),
      String(mov.target_block_id || ajuste.target_block_id || "").trim(),
      String(mov.sex ?? "").trim().toLowerCase(),
      String(mov.age_group ?? "").trim().toLowerCase(),
    ].join("|"))
    .sort()
    .join(";");
}

function normalizarRechazo(crudo: Record<string, unknown>): RechazoDeSubsanacion {
  return {
    id: texto(crudo.id),
    fase: texto(crudo.phase),
    clavePaquete: texto(crudo.clave_paquete),
    sugerenciaId: texto(crudo.sugerencia_id),
    sourceBlockId: texto(crudo.source_block_id),
    targetBlockId: texto(crudo.target_block_id),
    sourceUmp: texto(crudo.source_ump),
    targetUmp: texto(crudo.target_ump),
    sex: texto(crudo.sex),
    ageGroup: texto(crudo.age_group),
    casos: enteroONulo(crudo.count),
    nota: texto(crudo.nota),
    autor: texto(crudo.autor),
    fecha: texto(crudo.fecha),
  };
}

export function normalizeRechazos(raw: unknown): RechazoDeSubsanacion[] {
  return lista(registro(raw).rechazos).map(normalizarRechazo).filter((rechazo) => rechazo.id && rechazo.clavePaquete);
}

export async function getMonitoreoTerritorialRechazos(phase?: MonitoreoTerritorialPhase): Promise<RechazoDeSubsanacion[]> {
  const url = `/api/monitoreo/territorial/subsanaciones/rechazos${phase ? `?phase=${encodeURIComponent(phase)}` : ""}`;
  return normalizeRechazos(await handle<unknown>(await apiFetch(url, { headers: headers() })));
}

export async function postMonitoreoTerritorialRechazar(input: {
  sugerencia: MonitoreoTerritorialOperationalAdjustment;
  nota: string;
  phase?: MonitoreoTerritorialPhase;
}): Promise<RechazoDeSubsanacion[]> {
  return normalizeRechazos(await handle<unknown>(await apiFetch("/api/monitoreo/territorial/subsanaciones/rechazar", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  })));
}
