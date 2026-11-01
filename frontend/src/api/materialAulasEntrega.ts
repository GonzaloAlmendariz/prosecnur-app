// Etapa 3 (ADR 0122 §11): la entrega de aulas de Material a Monitoreo y las plantillas
// del equipo de aulas. El backend vive en api/R/collection_aulas_material.R:
//   GET  campaigns/aulas/entrega     recibo sellado y unidades entregadas (lectura pura)
//   POST campaigns/aulas/plantilla   {pieza: libro | disponibilidad} → file_id
import { apiFetch, handle, headers } from "./core";

export type EntregaDeAulas = {
  entregada: boolean;
  vigente: boolean;
  stale: boolean;
  desactualizada: boolean;
  /** Sello de la entrega (deployment_fingerprint), o "" sin entrega. */
  sello: string;
  entregadaEl: string;
  unidades: number;
};

export type PiezaDelEquipo = "libro" | "disponibilidad";
export type PlantillaDelEquipo = { file_id: string; filename: string };

type Registro = Record<string, unknown>;
const esRegistro = (v: unknown): v is Registro => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const escalar = (v: unknown): unknown => (Array.isArray(v) && v.length === 1 ? v[0] : v);
const texto = (v: unknown): string => {
  const x = escalar(v);
  return typeof x === "string" ? x : "";
};
const logico = (v: unknown): boolean => escalar(v) === true;

export function normalizarEntregaDeAulas(valor: unknown): EntregaDeAulas {
  const o = esRegistro(valor) ? valor : {};
  const recibo = esRegistro(o.handoff) ? o.handoff : {};
  const unidades = Array.isArray(o.unidades) ? o.unidades.length : 0;
  return {
    entregada: logico(o.entregada),
    vigente: logico(o.vigente),
    stale: logico(o.stale),
    desactualizada: logico(o.desactualizada),
    sello: texto(o.deployment_fingerprint),
    entregadaEl: texto(recibo.handed_off_at),
    unidades,
  };
}

export async function apiMaterialAulasEntrega(): Promise<EntregaDeAulas> {
  return normalizarEntregaDeAulas(await handle<unknown>(await apiFetch("/api/recopiladores/campaigns/aulas/entrega", { headers: headers() })));
}

export async function apiMaterialAulasPlantilla(pieza: PiezaDelEquipo): Promise<PlantillaDelEquipo> {
  const r = await handle<unknown>(
    await apiFetch("/api/recopiladores/campaigns/aulas/plantilla", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ pieza }),
    }),
  );
  const o = esRegistro(r) ? r : {};
  return { file_id: texto(o.file_id), filename: texto(o.filename) };
}
