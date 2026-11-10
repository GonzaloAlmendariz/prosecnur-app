// materialTerritorialPlan.ts — plan de campo y Hoja del día de la campaña territorial sobre
// la FOTO enviada (P6), con los mismos tipos y normalizador del plan de Hojas de ruta.
// Va en su propio módulo para no cerrar un ciclo de imports con hojasRuta.ts.
//
//   POST /api/recopiladores/campaigns/territorial/plan      {id, supuestos}
//   POST /api/recopiladores/campaigns/territorial/hoja-dia  {id, jornada, supuestos} → PDF

import { apiFetch, handle, headers } from "./core";
import { camposDeEntregable, type CamposDeEntregable } from "./jobs";
import { normalizarPlanCampo, type HojasRutaPlanCampo, type HojasRutaPlanSupuestos } from "./hojasRuta";

export async function apiMaterialTerritorialPlan(campaignId: string, supuestos: HojasRutaPlanSupuestos): Promise<HojasRutaPlanCampo> {
  return normalizarPlanCampo(
    await handle<unknown>(
      await apiFetch("/api/recopiladores/campaigns/territorial/plan", {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: campaignId, supuestos }),
      }),
    ),
  );
}

export async function apiMaterialTerritorialHojaDia(
  campaignId: string,
  jornada: string,
  supuestos: HojasRutaPlanSupuestos,
): Promise<{ file_id: string; filename: string } & CamposDeEntregable> {
  const r = await handle<unknown>(
    await apiFetch("/api/recopiladores/campaigns/territorial/hoja-dia", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id: campaignId, jornada, supuestos }),
    }),
  );
  const o = r && typeof r === "object" && !Array.isArray(r) ? (r as Record<string, unknown>) : {};
  const v = Array.isArray(o.file_id) ? o.file_id[0] : o.file_id;
  const file_id = typeof v === "string" ? v.trim() : "";
  if (!file_id) throw new Error("El backend no devolvió la hoja del día.");
  const n = Array.isArray(o.filename) ? o.filename[0] : o.filename;
  // El nombre y el meta del entregable (ADR 0133 §1): sin ellos el kit no sabe cómo se llama el PDF.
  return { ...camposDeEntregable(o), file_id, filename: typeof n === "string" ? n : "" };
}
