// monitoreoAulasEntrega.ts — Monitoreo trae la entrega de Material a su plan
// (X8; ADR 0122 §11). Contrato: `api/R/monitoreo_aulas_entrega.R`.
//   GET  /api/monitoreo/aulas/entrega        estado, lectura pura
//   POST /api/monitoreo/aulas/entrega/traer  aplica la entrega vigente

import { apiFetch, handle, headers } from "./core";
import { enteroONulo, registro, texto } from "./normalizarR";

export type EstadoDeEntrega = "sin_entrega" | "desactualizada" | "por_traer" | "aplicada";

export type EntregaDeMaterial = {
  estado: EstadoDeEntrega;
  unidades: number;
  entregadaEn: string;
  filasDelPlan: number;
};

const ESTADOS: EstadoDeEntrega[] = ["sin_entrega", "desactualizada", "por_traer", "aplicada"];

export function normalizarEntregaDeMaterial(raw: unknown): EntregaDeMaterial {
  const r = registro(raw);
  const e = texto(r.estado) as EstadoDeEntrega;
  return {
    estado: ESTADOS.includes(e) ? e : "sin_entrega",
    unidades: enteroONulo(r.unidades) ?? 0,
    entregadaEn: texto(r.entregada_en),
    filasDelPlan: enteroONulo(r.filas_del_plan) ?? 0,
  };
}

export async function apiMonitoreoAulasEntrega(): Promise<EntregaDeMaterial> {
  return normalizarEntregaDeMaterial(await handle<unknown>(await apiFetch("/api/monitoreo/aulas/entrega", { headers: headers() })));
}

export async function apiMonitoreoAulasTraerEntrega(): Promise<{ actualizadas: number; agregadas: number; conservadas: number }> {
  const r = registro(await handle<unknown>(await apiFetch("/api/monitoreo/aulas/entrega/traer", {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: "{}",
  })));
  return { actualizadas: enteroONulo(r.actualizadas) ?? 0, agregadas: enteroONulo(r.agregadas) ?? 0, conservadas: enteroONulo(r.conservadas) ?? 0 };
}
